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
import { google, fakeGoogleExchange, testFetch, login, testHost } from '../test-support/google.mjs';

async function listen(handler) {
  const server = createServer(handler);
  server.listen(0,'127.0.0.1'); await once(server,'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    base,
    fetch: (route,init) => testFetch(base+route,init),
    close: () => new Promise(resolve => server.close(resolve)),
  };
}
const post = (data,cookie,origin) => ({method:'POST',headers:{'content-type':'application/json', ...(cookie && {cookie}), ...(origin && {origin})},body:JSON.stringify(data)});

test('the deployed entry is loadable by the CommonJS launcher', () => {
  const require = createRequire(import.meta.url);
  const route = require('../api/almaktab.js');
  assert.equal(typeof route.default, 'function');
});

test('rewritten Vercel URLs keep the full API path and cannot route to local files', () => {
  assert.equal(vercelPath('/api/almaktab.js?__route=admin/login'),'/api/admin/login');
  assert.equal(vercelPath('/api/almaktab.js?__route=admin%2Fproperties%2Fdraft-1'),'/api/admin/properties/draft-1');
  assert.equal(vercelPath('/api/site?__route=admin/data'),'/api/site');
  assert.equal(vercelPath('/api/almaktab.js?__route=../server.mjs'),null);
  assert.equal(vercelPath('/admin'),null);
});

test('Vercel instances share catalog, inquiries and Google-authenticated sessions', async () => {
  const dir = await mkdtemp(join(tmpdir(),'almaktab-vercel-'));
  const dbPath = join(dir,'shared.sqlite'), connections = [], instances = [];
  try {
    const getInstance = async () => {
      // Exercise the async adapter contract using two independent database connections.
      const local = localDatabase(dbPath);
      connections.push(local);
      const db = Object.fromEntries(['get','all','run','batch'].map(name => [name, async (...args) => local[name](...args)]));
      const options = { db, google, googleExchange:fakeGoogleExchange, seed:true, secure:true };
      const handler = createVercelHandler({init:() => createHandler(options)});
      const instance = await listen(handler);
      instances.push(instance);
      return instance;
    };
    const first = await getInstance(), second = await getInstance();
    const site = await (await first.fetch('/api/almaktab.js?__route=site')).json();
    assert.equal(site.properties.length,3);
    const inquiry = await first.fetch('/api/almaktab.js?__route=inquiries',post({name:'عميل تجريبي',phone:'+971 50 555 5555',propertyId:site.properties[0].id},undefined,`https://${testHost}`));
    assert.equal(inquiry.status,201);
    const rewritten = instance => (path,init) => {
      const [route,query] = path.split('?');
      return instance.fetch(`/api/almaktab.js?__route=${route.slice(5)}${query ? `&${query}` : ''}`,init);
    };
    const session = await login(rewritten(first),rewritten(second));
    for (const instance of [first,second]) {
      const admin = await (await instance.fetch('/api/almaktab.js?__route=admin/data',{headers:{cookie:session}})).json();
      assert.equal(admin.leads[0].property_id,site.properties[0].id);
    }
    assert.equal((await second.fetch('/api/almaktab.js?__route=admin/logout',post({},session,`https://${testHost}`))).status,200);
    assert.equal((await first.fetch('/api/almaktab.js?__route=admin/data',{headers:{cookie:session}})).status,401);
  } finally {
    await Promise.all(instances.map(instance => instance.close()));
    for (const connection of connections) connection.close();
    await rm(dir,{recursive:true,force:true});
  }
});

test('Vercel reports missing Turso settings on cold start and during retry backoff', async () => {
  const instance = await listen(createVercelHandler({env:{TURSO_DATABASE_URL:'libsql://example.turso.io'}}));
  try {
    for (const path of ['/api/site','/api/admin/data']) {
      const response = await instance.fetch(path);
      assert.equal(response.status,503);
      assert.equal(response.headers.get('cache-control'),'no-store');
      const payload = await response.json();
      assert.equal(payload.code,'TURSO_CONFIG_MISSING');
      assert.deepEqual(payload.missing,['TURSO_AUTH_TOKEN']);
      assert.doesNotMatch(payload.error,/example\.turso\.io/);
    }
  } finally { await instance.close(); }
});
