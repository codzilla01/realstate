import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localDatabase } from '../local-database.mjs';
import { createHandler } from '../application.mjs';
import { createVercelHandler, vercelPath } from '../vercel-handler.mjs';
import { setupAdminMail, mailErrorSummary } from '../mail.mjs';

async function listen(handler) {
  const server = createServer(handler);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    fetch: (route,init) => fetch(base+route,init),
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
const cookiePair = response => response.headers.getSetCookie()[0]?.split(';')[0];
const adminEmail = 'admin@example.com';
const post = (data,cookie,origin) => ({method:'POST',headers:{'content-type':'application/json', ...(cookie && {cookie}), ...(origin && {origin})},body:JSON.stringify(data)});

test('the deployed entry is loadable by the CommonJS launcher', () => {
  const require = createRequire(import.meta.url);
  const route = require('../api/almaktab.js');
  assert.equal(typeof route.default, 'function');
});

test('rewritten Vercel URLs keep the full API path and cannot route to local files', () => {
  assert.equal(vercelPath('/api/almaktab.js?__route=admin/login/request-code'),'/api/admin/login/request-code');
  assert.equal(vercelPath('/api/almaktab.js?__route=admin%2Fproperties%2Fdraft-1'),'/api/admin/properties/draft-1');
  assert.equal(vercelPath('/api/site?__route=admin/data'),'/api/site');
  assert.equal(vercelPath('/api/almaktab.js?__route=../server.mjs'),null);
  assert.equal(vercelPath('/admin'),null);
});

test('Vercel instances share catalog, inquiries, OTP and session state; concurrent reuse fails', async () => {
  const dir = await mkdtemp(join(tmpdir(),'almaktab-vercel-'));
  const dbPath = join(dir,'shared.sqlite'), connections = [], instances = [], outbox = [], background = [];
  try {
    const getInstance = async () => {
      // Exercise the async adapter contract using two independent database connections.
      const local = localDatabase(dbPath);
      connections.push(local);
      const db = Object.fromEntries(['get','all','run','batch'].map(name => [name, async (...args) => local[name](...args)]));
      const options = { db, adminEmail, deliverCode: async message => outbox.push(message), authSecret:'test-secret-not-used-outside-this-file-9c1f483', seed:true, secure:true };
      const handler = createVercelHandler({defer:task => background.push(task), init:(_env,defer) => createHandler({...options,defer})});
      const instance = await listen(handler);
      instances.push(instance);
      return instance;
    };
    const first = await getInstance(), second = await getInstance();
    const site = await (await first.fetch('/api/almaktab.js?__route=site')).json();
    assert.equal(site.properties.length,3);
    const inquiry = await first.fetch('/api/almaktab.js?__route=inquiries',post({name:'عميل تجريبي',phone:'+971 50 555 5555',propertyId:site.properties[0].id},undefined,first.base));
    assert.equal(inquiry.status,201);
    const request = await first.fetch('/api/almaktab.js?__route=admin/login/request-code',post({email:adminEmail},undefined,first.base));
    assert.equal(request.status,202);
    assert.match(request.headers.get('set-cookie'),/; Secure$/);
    assert.equal(background.length,1);
    await Promise.all(background);
    const challenge = cookiePair(request), code = outbox[0].code;
    const response = await Promise.all([first,second].map(instance => instance.fetch('/api/almaktab.js?__route=admin/login/verify-code',post({email:adminEmail,code},challenge,instance.base))));
    assert.deepEqual(response.map(res => res.status).sort(),[200,401]);
    const session = cookiePair(response.find(res => res.ok));
    for (const instance of [first,second]) {
      const admin = await (await instance.fetch('/api/almaktab.js?__route=admin/data',{headers:{cookie:session}})).json();
      assert.equal(admin.leads[0].property_id,site.properties[0].id);
    }
    assert.equal((await second.fetch('/api/almaktab.js?__route=admin/logout',post({},session,second.base))).status,200);
    assert.equal((await first.fetch('/api/almaktab.js?__route=admin/data',{headers:{cookie:session}})).status,401);
  } finally {
    await Promise.all(instances.map(instance => instance.close()));
    for (const connection of connections) connection.close();
    await rm(dir,{recursive:true,force:true});
  }
});

test('Resend uses a server-side HTTPS request for approved-recipient mail and sanitizes failures', async () => {
  const env = {ADMIN_EMAIL:adminEmail,MAIL_FROM:'desk@example.com',RESEND_API_KEY:'test-secret'};
  const sent = [];
  const mailer = await setupAdminMail(env,async (url,init) => { sent.push({url,...init,body:JSON.parse(init.body)}); return new Response('{}'); });
  await mailer.deliverCode({to:'other@example.com',code:'123456',expiresIn:300});
  await mailer.sendTest();
  assert.equal(sent[0].url,'https://api.resend.com/emails');
  assert.deepEqual(sent[0].body.to,[adminEmail]);
  assert.match(sent[0].body.text,/123456/);
  assert.doesNotMatch(sent[1].body.text,/123456/);
  assert.equal(sent[0].headers.Authorization,'Bearer test-secret');
  const failing = await setupAdminMail(env,async () => new Response('private diagnostic',{status:401}));
  await assert.rejects(failing.sendTest(), error => /RESEND_API_KEY/.test(mailErrorSummary(error)) && !mailErrorSummary(error).includes('private diagnostic'));
});
