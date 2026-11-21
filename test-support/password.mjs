import assert from 'node:assert/strict';
import { request } from 'node:http';

export const credentials = {username:'office-admin',password:'A-very-long-test-password-42'};
export const testHost = 'almaktab.example.test';
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

export async function login(fetchRoute) {
  const response = await fetchRoute('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(credentials)});
  assert.equal(response.status,200);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie,/^almaktab_session=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Strict; Max-Age=28800/);
  return cookiePair(cookie);
}
