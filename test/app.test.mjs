import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../local-server.mjs';
import { google, fakeGoogleExchange, testFetch, startPath, callbackPath, begin, login } from '../test-support/google.mjs';

const listing = {title:'دار النخيل', type:'villa', city:'dubai', district:'البراري', price:5000000, beds:4, baths:5, area:520, status:'available', image:'/images/palm.jpg', description:'دار معاصرة', featured:true, published:false};
const person = {name:'عميل اختبار', phone:'+971 50 555 5555', email:'test@example.com', message:'موعد لمعاينة المنزل'};
async function start(options = {}) {
  const server = await createApp({ google, googleExchange:fakeGoogleExchange, ...options });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    fetch: (route,init) => testFetch(base+route,init),
    close: () => new Promise(resolve => server.close(resolve)),
    req: async (path, { method = 'GET', data, cookie, headers = {} } = {}) => {
      const res = await testFetch(base + path, { method, headers: { ...headers, ...(cookie && { Cookie:cookie }), ...(data && { 'Content-Type':'application/json' }) }, ...(data && { body:JSON.stringify(data) }) });
      return { res, json: res.headers.get('content-type')?.includes('application/json') ? await res.json() : await res.text() };
    },
  };
}
test('publishing integrates the public catalog with the admin pipeline and persists data', async () => {
  const dir = await mkdtemp(join(tmpdir(),'almaktab-test-'));
  const dbPath = join(dir,'test.sqlite');
  let app;
  try {
    app = await start({ dbPath, seed:false });
    const {req} = app, cookie = await login(app.fetch);
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
    assert.match(adminPage.json, /href="\/api\/admin\/login\/google"/);
    assert.doesNotMatch(adminPage.json, /one-time-code|scrypt:|current-password/);
    assert.equal((await req('/application.mjs')).res.status, 404);
    assert.equal((await req('/local-server.mjs')).res.status, 404);
    assert.equal((await req('/api/site')).json.properties.length, 3);
    assert.equal((await req('/api/admin/data')).res.status, 401);
    assert.equal((await req('/api/admin/logout',{method:'POST',data:{},headers:{Origin:'https://other.example'}})).res.status,403);
    const cookie = await login(app.fetch);
    assert.equal((await req('/api/admin/properties',{method:'POST',cookie,data:{...listing,image:'javascript:alert(1)'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,preferredDate:'2030-02-31'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,phone:'not a number'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:person})).res.status, 201);
    assert.equal((await req('/api/admin/logout',{method:'POST',cookie,data:{}})).res.status, 200);
    assert.equal((await req('/api/admin/data',{cookie})).res.status, 401);
  } finally { await app.close(); }
});

test('Google sign-in rejects unverified or unauthorized accounts and the old password endpoint', async () => {
  const app = await start();
  try {
    const {req} = app;
    assert.deepEqual((await req('/api/admin/login/status')).json,{configured:true,onConfiguredHost:true});
    assert.deepEqual((await req('/api/admin/login/status',{headers:{host:'preview.example'}})).json,{configured:true,onConfiguredHost:false});
    assert.equal((await req(startPath,{headers:{host:'preview.example'}})).res.headers.get('location'),'/admin?login=unavailable');
    for (const code of ['other','unverified']) {
      const flow = await begin(app.fetch);
      const result = await req(`${callbackPath}?code=${code}&state=${flow.auth.searchParams.get('state')}`,{cookie:flow.cookie});
      assert.equal(result.res.headers.get('location'),'/admin?login=account');
      assert.doesNotMatch(result.res.headers.get('set-cookie'),/almaktab_session/);
    }
    const cookie = await login(app.fetch);
    assert.equal((await req('/api/admin/login',{method:'POST',cookie,data:{username:'admin',password:'not-accepted'}})).res.status,404);
    assert.equal((await req('/api/admin/data',{cookie,headers:{host:'preview.example'}})).res.status,401);
  } finally { await app.close(); }
});

test('OAuth flow checks browser cookie, signed state, nonce, PKCE and expiry', async () => {
  let now = Date.now(), exchange;
  const app = await start({authClock:() => now,googleExchange:async data => { exchange = data; return fakeGoogleExchange(data); }});
  try {
    const flow = await begin(app.fetch), state = flow.auth.searchParams.get('state');
    const callback = `${callbackPath}?code=permitted&state=${state}`;
    for (const cookie of ['',`${flow.cookie.slice(0,-1)}!`]) {
      const rejected = await app.req(callback,{cookie});
      assert.equal(rejected.res.headers.get('location'),'/admin?login=failed');
    }
    assert.equal((await app.req(`${callback}&state=${state}`,{cookie:flow.cookie})).res.headers.get('location'),'/admin?login=failed');
    assert.equal(exchange,undefined);
    const accepted = await app.req(callback,{cookie:flow.cookie});
    assert.equal(accepted.res.headers.get('location'),'/admin');
    assert.equal(exchange.nonce,flow.auth.searchParams.get('nonce'));
    assert.equal(flow.auth.searchParams.get('code_challenge_method'),'S256');
    assert.equal(flow.auth.searchParams.get('code_challenge'),createHash('sha256').update(exchange.verifier).digest('base64url'));
    assert.equal(flow.auth.searchParams.get('scope'),'openid email');
    assert.equal(flow.auth.searchParams.get('redirect_uri'),google.redirectUri);
    now += 5*60_000;
    assert.equal((await app.req(callback,{cookie:flow.cookie})).res.headers.get('location'),'/admin?login=failed');
  } finally { await app.close(); }
});

test('Google login initiation is rate limited', async () => {
  const app = await start();
  try {
    for (let i=0;i<20;i++) assert.match((await app.req(startPath)).res.headers.get('location'),/^https:\/\/accounts\.google\.com/);
    assert.equal((await app.req(startPath)).res.headers.get('location'),'/admin?login=limited');
  } finally { await app.close(); }
});

test('the admin session expires after eight hours', async () => {
  let time = Date.now();
  const app = await start({authClock:() => time});
  try {
    const cookie = await login(app.fetch);
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,200);
    time += 8 * 60 * 60 * 1000;
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,401);
  } finally { await app.close(); }
});

test('an unconfigured server exposes the public catalog but denies admin login', async () => {
  const app = await start({google:undefined});
  try {
    assert.equal((await app.req('/api/site')).res.status,200);
    assert.deepEqual((await app.req('/api/admin/login/status')).json, {configured:false,onConfiguredHost:false});
    assert.equal((await app.req('/tools/hash-admin-password.mjs')).res.status,404);
    const result = await app.req(startPath);
    assert.equal(result.res.headers.get('location'),'/admin?login=unavailable');
    assert.equal(result.res.headers.get('set-cookie'),null);
  } finally { await app.close(); }
});

test('changing the approved account revokes local sessions without changing site data', async () => {
  const dir = await mkdtemp(join(tmpdir(),'almaktab-auth-'));
  const dbPath = join(dir,'test.sqlite');
  let app;
  try {
    app = await start({dbPath,seed:false});
    const cookie = await login(app.fetch);
    await app.close(); app = null;
    app = await start({dbPath,seed:false});
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,200);
    await app.close(); app = null;
    app = await start({dbPath,seed:false,google:{...google,email:'replacement@gmail.com'}});
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,401);
    await app.close(); app = null;
    app = await start({dbPath,seed:false});
    assert.equal((await app.req('/api/admin/data',{cookie})).res.status,401);
  } finally { if (app) await app.close(); await rm(dir,{recursive:true,force:true}); }
});
