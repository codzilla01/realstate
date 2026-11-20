import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.mjs';

const password = 'test-only-long-admin-secret';
const listing = {title:'دار النخيل', type:'villa', city:'dubai', district:'البراري', price:5000000, beds:4, baths:5, area:520, status:'available', image:'/images/palm.jpg', description:'دار معاصرة', featured:true, published:false};
const person = {name:'عميل اختبار', phone:'+971 50 555 5555', email:'test@example.com', message:'موعد لمعاينة المنزل'};
async function start(options = {}) {
  const server = createApp({ password, ...options });
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
async function login(app) {
  const {res} = await app.req('/api/admin/login', { method:'POST', data:{password} });
  assert.equal(res.status, 200);
  const cookie = res.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly; SameSite=Strict/);
  return cookie.split(';')[0];
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
    const saved = (await app.req('/api/admin/data',{cookie:await login(app)})).json;
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
    assert.equal((await req('/server.mjs')).res.status, 404);
    assert.equal((await req('/api/site')).json.properties.length, 3);
    assert.equal((await req('/api/admin/data')).res.status, 401);
    assert.equal((await req('/api/admin/login',{method:'POST',data:{password:'wrong'}})).res.status, 401);
    assert.equal((await req('/api/admin/login',{method:'POST',data:{password},headers:{Origin:'https://example.com'}})).res.status, 403);
    const {res} = await req('/api/admin/login',{method:'POST',data:{password}});
    assert.match(res.headers.get('set-cookie'), /; Secure$/);
    const cookie = res.headers.get('set-cookie').split(';')[0];
    assert.equal((await req('/api/admin/properties',{method:'POST',cookie,data:{...listing,image:'javascript:alert(1)'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,preferredDate:'2030-02-31'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:{...person,phone:'not a number'}})).res.status, 400);
    assert.equal((await req('/api/inquiries',{method:'POST',data:person})).res.status, 201);
    assert.equal((await req('/api/admin/logout',{method:'POST',cookie,data:{}})).res.status, 200);
    assert.equal((await req('/api/admin/data',{cookie})).res.status, 401);
  } finally { await app.close(); }
});
