import assert from 'node:assert/strict';
import { request } from 'node:http';
import { googleCallbackPath } from '../admin-auth.mjs';

export const testHost = 'almaktab.example.test';
export const google = {email:'test-admin@gmail.com',clientId:'example-google-client-id',clientSecret:'example-google-client-secret',redirectUri:`https://${testHost}${googleCallbackPath}`};
export const fakeGoogleExchange = async ({code,config}) => ({sub:'google-user-1',email_verified:code !== 'unverified',email:code === 'other' ? 'another@gmail.com' : config.email});
export const startPath = '/api/admin/login/google';
export const callbackPath = googleCallbackPath;
export const cookiePair = value => value?.split(';',1)[0];

export function testFetch(url, init = {}) {
  return new Promise((resolve,reject) => {
    const req = request(url,{method:init.method,headers:{host:testHost,...init.headers}},res => {
      const parts = [];
      res.on('error',reject);
      res.on('data',part => parts.push(part));
      res.on('end',() => {
        const headers = new Headers();
        for (let i=0;i<res.rawHeaders.length;i+=2) headers.append(res.rawHeaders[i],res.rawHeaders[i+1]);
        resolve(new Response(Buffer.concat(parts),{status:res.statusCode,headers}));
      });
    });
    req.on('error',reject);
    req.end(init.body);
  });
}

export async function begin(fetchRoute, session) {
  const response = await fetchRoute(startPath,{headers:session ? {cookie:session} : {}});
  assert.equal(response.status,303);
  assert.match(response.headers.get('location'),/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie,/HttpOnly; SameSite=Lax; Max-Age=300/);
  return {auth:new URL(response.headers.get('location')),cookie:cookiePair(cookie)};
}

export async function login(fetchRoute, completeRoute = fetchRoute, session) {
  const flow = await begin(fetchRoute,session);
  const response = await completeRoute(`${callbackPath}?code=permitted&state=${flow.auth.searchParams.get('state')}`,{headers:{cookie:[flow.cookie,session].filter(Boolean).join('; ')}});
  assert.equal(response.status,303);
  assert.equal(response.headers.get('location'),'/admin');
  assert.match(response.headers.getSetCookie()[0],/^almaktab_session=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure$/);
  assert.match(response.headers.getSetCookie()[1],/SameSite=Lax; Max-Age=0/);
  return cookiePair(response.headers.getSetCookie()[0]);
}
