import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../local-server.mjs';

const adminEmail = 'admin@example.com';
const requestCode = '/api/admin/login/request-code', verifyCode = '/api/admin/login/verify-code';
const cookiePair = cookie => cookie.split(';')[0];
const listing = {title:'دار النخيل', type:'villa', city:'dubai', district:'البراري', price:5000000, beds:4, baths:5, area:520, status:'available', image:'/images/palm.jpg', description:'دار معاصرة', featured:true, published:false};
const person = {name:'عميل اختبار', phone:'+971 50 555 5555', email:'test@example.com', message:'موعد لمعاينة المنزل'};
async function start(options = {}) {
  const outbox = [];
  const server = await createApp({ adminEmail, deliverCode: async message => { outbox.push(message); }, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    outbox,
    close: () => new Promise(resolve => server.close(resolve)),
    req: async (path, { method = 'GET', data, cookie, headers = {} } = {}) => {
      const res = await fetch(base + path, { method, headers: { ...headers, ...(cookie && { Cookie:cookie }), ...(data && { 'Content-Type':'application/json' }) }, ...(data && { body:JSON.stringify(data) }) });
      return { res, json: res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text() };
    },
  };
}
async function issue(app, email = adminEmail, challenge) {
  const {res, json} = await app.req(requestCode, {method:'POST', cookie:challenge, data:{email}});
  assert.equal(res.status, 202);
  assert.deepEqual(json, {ok:true, retryAfter:60, expiresIn:300});
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /^almaktab_login_challenge=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=300/);
  return { cookie:cookiePair(cookie), headers:cookie };
}
async function login(app) {
  const {cookie:challenge} = await issue(app);
  const code = app.outbox.at(-1).code;
  assert.match(code, /^\d{6}$/);
  const {res} = await app.req(verifyCode, {method:'POST', cookie:challenge, data:{email:adminEmail,code}});
  assert.equal(res.status, 200);
  const cookies = res.headers.getSetCookie();
  assert.match(cookies[0], /^almaktab_session=.*HttpOnly; SameSite=Strict/);
  assert.match(cookies[1], /^almaktab_login_challenge=; .*Max-Age=0/);
  return cookiePair(cookies[0]);
}

test('publishing integrates the public catalog with the admin pipeline and persists data', async () => {
  const dir = await mkdtemp(join(tmpdir(),'almaktab-test-'));
  const dbPath = join(dir,'test.sqlite');
  let app;
  try {
    app = await start({ dbPath, seed:false });
    const {req} = app, cookie = await login(app);
    const draft = await req('/api/admin/properties', {method:'POST', cookie, data:listing});
    assert.equal(draft.res.status, 201);
    const id = draft.json.id, path = `/api/admin/properties/${id}`;
    assert.equal((await req(path, {cookie})).json.title, listing.title);
    assert.equal((await req(path)).res.status, 401);
    assert.equal((await req('/api/site')).json.properties.length, 0);
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,propertyId:id}})).res.status, 409);
    assert.equal((await req(path, {method:'PUT',cookie,data:{...listing,published:true}})).res.status, 200);
    assert.equal((await req('/api/site')).json.properties[0].id, id);
    const inquiry = await req('/api/inquiries', {method:'POST',data:{...person,propertyId:id}});
    assert.equal(inquiry.res.status, 201); assert.match(inquiry.json.reference, /^[A-F0-9]{8}$/);
    const lead = (await req('/api/admin/data',{cookie})).json.leads[0];
    assert.equal(lead.property_title, listing.title); assert.equal(lead.stage, 'new');
    assert.equal((await req(`/api/admin/leads/${lead.id}`,{method:'PATCH',cookie,data:{stage:'scheduled'}})).res.status, 400);
    assert.equal((await req(`/api/admin/leads/${lead.id}`,{method:'PATCH',cookie,data:{stage:'scheduled',scheduledAt:'2030-06-25T12:00',notes:'تم التنسيق'}})).res.status, 200);
    const editorial = {headline:'عنوان جديد\nسطر ثانٍ',intro:'وصف الصفحة الجديد',email:'info@example.com',phone:''};
    assert.equal((await req('/api/admin/site',{method:'PUT',cookie,data:editorial})).res.status, 200);
    assert.deepEqual((await req('/api/site')).json.site, editorial);
    await req(path, {method:'PUT',cookie,data:{...listing,published:true,status:'reserved'}});
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,propertyId:id}})).res.status, 409);
    await req(path, {method:'PUT',cookie,data:listing});
    assert.equal((await req('/api/site')).json.properties.length, 0);
    await app.close(); app = null;
    app = await start({dbPath,seed:false});
    const saved = (await app.req('/api/admin/data',{cookie})).json;
    assert.equal(saved.properties[0].published, 0); assert.equal(saved.leads[0].stage, 'scheduled');
    assert.equal(saved.leads[0].notes, 'تم التنسيق');
  } finally { if (app) await app.close(); await rm(dir,{recursive:true,force:true}); }
});

test('public files, safe validation, and session boundaries', async () => {
  const app = await start({secure:true});
  try {
    const {req} = app;
    assert.equal((await req('/')).res.status, 200);
    assert.equal((await req('/admin')).res.status, 200);
    assert.equal((await req('/application.mjs')).res.status, 404);
    assert.equal((await req('/local-server.mjs')).res.status, 404);
    assert.equal((await req('/api/site')).json.properties.length, 3);
    assert.equal((await req('/api/admin/data')).res.status, 401);
    assert.equal((await req(requestCode,{method:'POST',data:{email:adminEmail},headers:{Origin:'https://example.com'}})).res.status, 403);
    assert.equal((await req('/api/admin/login',{method:'POST',data:{password:'legacy'}})).res.status, 401);
    const challenge = await issue(app);
    assert.match(challenge.headers, /; Secure$/);
    const {res} = await req(verifyCode,{method:'POST',cookie:challenge.cookie,data:{email:adminEmail,code:app.outbox[0].code}});
    assert.equal(res.status, 200);
    assert.match(res.headers.getSetCookie()[0], /; Secure$/);
    const cookie = cookiePair(res.headers.getSetCookie()[0]);
    assert.equal((await req('/api/admin/properties',{method:'POST',cookie,data:{...listing,image:'javascript:alert(1)'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,preferredDate:'2030-02-31'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,phone:'not a number'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:person})).res.status, 201);
    assert.equal((await req('/api/admin/logout',{method:'POST',cookie,data:{}})).res.status, 200);
    assert.equal((await req('/api/admin/data',{cookie})).res.status, 401);
  } finally { await app.close(); }
});

test('only the configured email gets a code; verification requires the same browser and is single-use', async () => {
  const app = await start();
  try {
    const {req, outbox} = app;
    assert.deepEqual((await req('/api/admin/login/status')).json, {configured:true});
    const foreignChallenge = await issue(app, 'visitor@example.com');
    assert.equal(outbox.length, 0);
    const {cookie} = await issue(app, adminEmail.toUpperCase());
    assert.deepEqual(outbox.map(mail => mail.to), [adminEmail]);
    const code = outbox[0].code;
    const verify = (challenge, email, supplied) => req(verifyCode,{method:'POST',cookie:challenge,data:{email,code:supplied}});
    assert.equal((await verify(undefined, adminEmail, code)).res.status, 401);
    assert.equal((await verify(foreignChallenge.cookie, adminEmail, code)).res.status, 401);
    assert.equal((await verify(cookie, 'visitor@example.com', code)).res.status, 401);
    const localized = code.replace(/\d/g, n => '٠١٢٣٤٥٦٧٨٩'[Number(n)]);
    assert.equal((await verify(cookie, adminEmail, localized)).res.status, 200);
    assert.equal((await verify(cookie, adminEmail, code)).res.status, 401);
  } finally { await app.close(); }
});

test('cooldown, resend rotation, expiry, and the five-attempt limit', async () => {
  let time = Date.now();
  const app = await start({authClock:() => time});
  try {
    const {req,outbox} = app;
    const {cookie} = await issue(app);
    await issue(app, adminEmail, cookie);
    assert.equal(outbox.length,1);
    time += 60_000;
    await issue(app, adminEmail, cookie);
    assert.equal(outbox.length,2);
    const verify = code => req(verifyCode,{method:'POST',cookie,data:{email:adminEmail,code}});
    assert.notEqual(outbox[0].code, outbox[1].code);
    for (let tries = 0; tries < 5; tries++) assert.equal((await verify(outbox[0].code)).res.status,401);
    assert.equal((await verify(outbox[1].code)).res.status,401);
    time += 60_000;
    await issue(app, adminEmail, cookie);
    assert.equal(outbox.length,3);
    time += 300_000;
    assert.equal((await verify(outbox[2].code)).res.status,401);
  } finally { await app.close(); }
});

test('an unconfigured server exposes the public catalog but does not issue login codes', async () => {
  const app = await start({adminEmail:'',deliverCode:undefined});
  try {
    assert.equal((await app.req('/api/site')).res.status,200);
    assert.deepEqual((await app.req('/api/admin/login/status')).json, {configured:false});
    assert.equal((await app.req('/check-mail.mjs')).res.status,404);
    const result = await app.req(requestCode,{method:'POST',data:{email:adminEmail}});
    assert.equal(result.res.status,503);
    assert.equal(result.res.headers.get('set-cookie'),null);
  } finally { await app.close(); }
});

test('changing the configured email revokes sessions, even if the original address is restored', async () => {
  const dir = await mkdtemp(join(tmpdir(),'almaktab-auth-'));
  const dbPath = join(dir,'test.sqlite');
  let app;
  try {
    app = await start({dbPath,seed:false});
    const cookie = await login(app);
    await app.close(); app = null;
    app = await start({dbPath,seed:false});
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,200);
    await app.close(); app = null;
    app = await start({dbPath,seed:false,adminEmail:'replacement@example.com'});
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,401);
    await app.close(); app = null;
    app = await start({dbPath,seed:false});
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,401);
  } finally { if (app) await app.close(); await rm(dir,{recursive:true,force:true}); }
});

test('SMTP delivery errors are reported only on the server', async () => {
  const errors = [];
  const deliveryError = Object.assign(new Error('provider-only diagnostic'), {code:'EAUTH'});
  const app = await start({deliverCode: async () => { throw deliveryError; }, onDeliveryError: error => errors.push(error)});
  try {
    await issue(app);
    assert.deepEqual(errors, [deliveryError]);
  } finally { await app.close(); }
});
