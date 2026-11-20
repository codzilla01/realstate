import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../local-server.mjs';
import { hashAdminPassword } from '../admin-auth.mjs';

const credentials = {username:'office-admin',password:'test-password-only-ليس-للإنتاج'};
const adminPasswordHash = await hashAdminPassword(credentials.password);
const loginPath = '/api/admin/login';
const cookiePair = cookie => cookie.split(';')[0];
const listing = {title:'دار النخيل', type:'villa', city:'dubai', district:'البراري', price:5000000, beds:4, baths:5, area:520, status:'available', image:'/images/palm.jpg', description:'دار معاصرة', featured:true, published:false};
const person = {name:'عميل اختبار', phone:'+971 50 555 5555', email:'test@example.com', message:'موعد لمعاينة المنزل'};
async function start(options = {}) {
  const server = await createApp({ adminUsername:credentials.username, adminPasswordHash, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    close: () => new Promise(resolve => server.close(resolve)),
    req: async (path, { method = 'GET', data, cookie, headers = {} } = {}) => {
      const res = await fetch(base + path, { method, headers: { ...headers, ...(cookie && { Cookie:cookie }), ...(data && { 'Content-Type':'application/json' }) }, ...(data && { body:JSON.stringify(data) }) });
      return { res, json: res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text() };
    },
  };
}
const loginRequest = (app, data = credentials, cookie) => app.req(loginPath,{method:'POST',data,cookie});
async function login(app) {
  const {res,json} = await loginRequest(app);
  assert.equal(res.status,200);
  assert.deepEqual(json,{ok:true});
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie,/^almaktab_session=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800/);
  return cookiePair(cookie);
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
    const adminPage = await req('/admin');
    assert.equal(adminPage.res.status, 200);
    assert.match(adminPage.json, /method="post" action="\/api\/admin\/login"/);
    assert.match(adminPage.json, /autocomplete="current-password"/);
    assert.doesNotMatch(adminPage.json, /one-time-code|scrypt:/);
    assert.equal((await req('/application.mjs')).res.status, 404);
    assert.equal((await req('/local-server.mjs')).res.status, 404);
    assert.equal((await req('/api/site')).json.properties.length, 3);
    assert.equal((await req('/api/admin/data')).res.status, 401);
    assert.equal((await req(loginPath,{method:'POST',data:credentials,headers:{Origin:'https://example.com'}})).res.status,403);
    const {res} = await loginRequest(app);
    assert.equal(res.status,200);
    assert.match(res.headers.get('set-cookie'),/; Secure$/);
    const cookie = cookiePair(res.headers.get('set-cookie'));
    assert.equal((await req('/api/admin/properties',{method:'POST',cookie,data:{...listing,image:'javascript:alert(1)'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,preferredDate:'2030-02-31'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,phone:'not a number'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:person})).res.status, 201);
    assert.equal((await req('/api/admin/logout',{method:'POST',cookie,data:{}})).res.status, 200);
    assert.equal((await req('/api/admin/data',{cookie})).res.status, 401);
  } finally { await app.close(); }
});

test('login rejects wrong usernames and passwords with the same response, and rotates sessions', async () => {
  const app = await start();
  try {
    const {req} = app;
    assert.deepEqual((await req('/api/admin/login/status')).json,{configured:true});
    const wrongUser = await loginRequest(app,{...credentials,username:'wrong-user'});
    const wrongPassword = await loginRequest(app,{...credentials,password:adminPasswordHash});
    assert.equal(wrongUser.res.status,401);
    assert.equal(wrongPassword.res.status,401);
    assert.deepEqual(wrongPassword.json,wrongUser.json);
    assert.equal(wrongPassword.res.headers.get('set-cookie'),null);
    const oldCookie = await login(app);
    const renewed = await loginRequest(app,{...credentials,username:credentials.username.toUpperCase()},oldCookie);
    assert.equal(renewed.res.status,200);
    const current = cookiePair(renewed.res.headers.get('set-cookie'));
    assert.notEqual(oldCookie,current);
    assert.equal((await req('/api/admin/data',{cookie:oldCookie})).res.status,401);
    assert.equal((await req('/api/admin/data',{cookie:current})).res.status,200);
    assert.equal((await req('/api/admin/login/request-code',{method:'POST',cookie:current,data:{}})).res.status,404);
    assert.equal((await req('/api/admin/login/verify-code',{method:'POST',cookie:current,data:{}})).res.status,404);
  } finally { await app.close(); }
});

test('the login rate limit rejects requests beyond ten attempts', async () => {
  const app = await start();
  try {
    for (let i=0;i<10;i++) assert.equal((await loginRequest(app,{})).res.status,401);
    assert.equal((await loginRequest(app)).res.status,429);
  } finally { await app.close(); }
});

test('the admin session expires after eight hours', async () => {
  let time = Date.now();
  const app = await start({authClock:() => time});
  try {
    const cookie = await login(app);
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,200);
    time += 8 * 60 * 60 * 1000;
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,401);
  } finally { await app.close(); }
});

test('an unconfigured server exposes the public catalog but denies admin login', async () => {
  const app = await start({adminPasswordHash:''});
  try {
    assert.equal((await app.req('/api/site')).res.status,200);
    assert.deepEqual((await app.req('/api/admin/login/status')).json, {configured:false});
    assert.equal((await app.req('/tools/hash-admin-password.mjs')).res.status,404);
    const result = await loginRequest(app);
    assert.equal(result.res.status,503);
    assert.equal(result.res.headers.get('set-cookie'),null);
  } finally { await app.close(); }
});

test('rotating the password revokes local sessions without changing site data', async () => {
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
    app = await start({dbPath,seed:false,adminPasswordHash:await hashAdminPassword('new-test-admin-password')});
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,401);
    await app.close(); app = null;
    app = await start({dbPath,seed:false});
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,401);
  } finally { if (app) await app.close(); await rm(dir,{recursive:true,force:true}); }
});

test('the password hash is salted and rejects short passwords', async () => {
  await assert.rejects(hashAdminPassword('weak'),/14/);
  const another = await hashAdminPassword(credentials.password);
  assert.match(another,/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  assert.notEqual(another,adminPasswordHash);
});
