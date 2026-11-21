import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPair, SignJWT } from 'jose';
import { allowedGoogleAccount, exchangeGoogleCode, verifyGoogleIdToken } from '../google-auth.mjs';

const claims = {sub:'test-google-id',email:'owner@gmail.com',email_verified:true,nonce:'example-flow',azp:'expected-client'};

test('Google JWT verification checks signature, issuer, audience, nonce, and authorized party', async () => {
  const {privateKey,publicKey} = await generateKeyPair('RS256');
  const sign = (payload,issuer='https://accounts.google.com',audience='expected-client') => new SignJWT(payload)
    .setProtectedHeader({alg:'RS256'}).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime('5m').sign(privateKey);
  const opts = {clientId:'expected-client',nonce:'example-flow',keys:publicKey};
  const token = await sign(claims);
  assert.equal((await verifyGoogleIdToken(token,opts)).sub,claims.sub);
  await assert.rejects(verifyGoogleIdToken(token,{...opts,nonce:'different-flow'}));
  await assert.rejects(verifyGoogleIdToken(await sign({...claims,azp:'other-client'}),opts));
  await assert.rejects(verifyGoogleIdToken(await sign(claims,'https://other.example'),opts));
  await assert.rejects(verifyGoogleIdToken(await sign(claims,undefined,'other-client'),opts));
  const {publicKey:otherKey} = await generateKeyPair('RS256');
  await assert.rejects(verifyGoogleIdToken(token,{...opts,keys:otherKey}));
});

test('allowlist requires verified Gmail or an authoritative Workspace account', () => {
  assert.equal(allowedGoogleAccount(claims,'owner@gmail.com'),true);
  assert.equal(allowedGoogleAccount({...claims,email_verified:false},'owner@gmail.com'),false);
  const workspace = {...claims,email:'owner@example.com'};
  assert.equal(allowedGoogleAccount(workspace,'owner@example.com'),false);
  assert.equal(allowedGoogleAccount({...workspace,hd:'example.com'},'owner@example.com'),true);
  assert.equal(allowedGoogleAccount({...workspace,hd:'other.example'},'owner@example.com'),false);
});

test('OAuth code and verifier are exchanged only at Google and invalid responses fail closed', async () => {
  const config = {clientId:'stub-id',clientSecret:'stub-secret',redirectUri:'https://example.test/api/admin/login/google/callback'};
  const fetcher = async (url,options) => {
    assert.equal(url,'https://oauth2.googleapis.com/token');
    assert.equal(options.method,'POST');
    assert.equal(options.redirect,'error');
    assert.equal(options.body.get('code_verifier'),'pkce-test');
    assert.equal(options.body.get('redirect_uri'),config.redirectUri);
    return new Response('{}',{status:200});
  };
  await assert.rejects(exchangeGoogleCode({code:'test-code',verifier:'pkce-test',nonce:'test-nonce',config,fetcher}),/ID token/);
});
