import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudDatabase } from '../database.mjs';
import { databaseError } from '../cloud-database-errors.mjs';

const env = {TURSO_DATABASE_URL:'libsql://test-db.turso.io',TURSO_AUTH_TOKEN:'stub-token'};

test('invalid Turso URL and insecure transport are rejected before connecting', async () => {
  for (const url of ['http://test-db.turso.io','libsql://test-db.turso.io?tls=0','https://turso.tech/dashboard','https://user:password@test-db.turso.io']) {
    await assert.rejects(cloudDatabase({...env,TURSO_DATABASE_URL:url}),{code:'TURSO_URL_INVALID'});
  }
});

test('libSQL HTTP failures yield sanitized authorization and missing-database diagnostics', async () => {
  for (const [status,code] of [[401,'TURSO_ACCESS_DENIED'],[403,'TURSO_ACCESS_DENIED'],[404,'TURSO_DATABASE_NOT_FOUND']]) {
    const db = await cloudDatabase(env,async (request,options) => {
      if (request.method === 'GET') return new Response(null,{status:404});
      assert.equal(request.method,'POST');
      assert.equal(request.headers.get('authorization'),'Bearer stub-token');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response('sensitive provider detail',{status});
    });
    try {
      await assert.rejects(db.get('SELECT 1'),error => error.code === code && !error.message.includes('sensitive provider detail'));
    } finally { db.close(); }
  }
});

test('read-only tokens and unexpected network errors are classified without leaking raw messages', () => {
  assert.equal(databaseError({code:'SQLITE_READONLY_DBMOVED'}).code,'TURSO_ACCESS_DENIED');
  const error = databaseError(new Error('sensitive provider detail'));
  assert.equal(error.code,'TURSO_UNAVAILABLE');
  assert.doesNotMatch(error.message,/sensitive provider detail/);
});
