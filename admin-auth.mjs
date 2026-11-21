import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { allowedGoogleAccount, exchangeGoogleCode } from './google-auth.mjs';

const sessionLifetime = 8 * 60 * 60;
const flowLifetime = 5 * 60;
const sessionName = 'almaktab_session';
const flowName = 'almaktab_google_flow';
const statePattern = /^[a-zA-Z0-9_-]{43}$/;
const digest = value => createHash('sha256').update(value).digest();
const randomUrlToken = () => randomBytes(32).toString('base64url');
const equal = (a,b) => timingSafeEqual(digest(a),digest(b));
export const googleCallbackPath = '/api/admin/login/google/callback';

export const normalizeDigits = value => value.replace(/[٠-٩۰-۹]/g, digit => String(digit >= '۰' ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660));
export const emailOK = email => /^[^\s@<>?&#:]+@[a-z\d.-]+\.[a-z\d-]+$/i.test(email);

function parsedConfig({email,clientId,clientSecret,redirectUri} = {}) {
  if (!email || !emailOK(email) || !clientId || !clientSecret || !redirectUri) return null;
  const callback = URL.parse(redirectUri);
  if (!callback || callback.pathname !== googleCallbackPath || callback.search || callback.hash || callback.username || callback.password) return null;
  const loopback = ['localhost','127.0.0.1','[::1]'].includes(callback.hostname);
  if (callback.protocol !== 'https:' && !(loopback && callback.protocol === 'http:')) return null;
  return {email:email.toLowerCase(),clientId,clientSecret,redirectUri:callback.href,callback};
}

export function readAdminConfig(env) {
  const google = {email:env.ADMIN_GOOGLE_EMAIL?.trim(),clientId:env.GOOGLE_OAUTH_CLIENT_ID?.trim(),clientSecret:env.GOOGLE_OAUTH_CLIENT_SECRET?.trim(),redirectUri:env.GOOGLE_OAUTH_REDIRECT_URI?.trim()};
  if (!parsedConfig(google)) {
    console.warn('Admin sign-in disabled: configure ADMIN_GOOGLE_EMAIL, GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET and GOOGLE_OAUTH_REDIRECT_URI.');
    return {};
  }
  return {google};
}

function readCookie(req, name) {
  const pair = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return pair?.slice(name.length+1) || '';
}

export async function createAdminAuth({ db, google, googleExchange = exchangeGoogleCode, secure, clock = Date.now }) {
  const config = parsedConfig(google);
  const ready = Boolean(config && (!secure || config.callback.protocol === 'https:'));
  const identity = ready ? digest(JSON.stringify(['google-oidc-v1',config.email,config.clientId,config.clientSecret,config.callback.origin])).toString('hex') : 'disabled';
  if (db.local && (await db.get("SELECT value FROM settings WHERE key='admin_auth_identity'"))?.value !== identity) {
    await db.batch([
      {sql:"DELETE FROM sessions WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='admin_auth_identity' AND value=?)",args:[identity]},
      {sql:"INSERT OR REPLACE INTO settings VALUES ('admin_auth_identity',?)",args:[identity]},
    ]);
  }

  const correctHost = req => ready && req.headers.host?.toLowerCase() === config.callback.host;
  const secureFlag = secure || config?.callback.protocol === 'https:' ? '; Secure' : '';
  const sessionDigest = token => digest(`${identity}:${token}`).toString('hex');
  const sessionCookie = (token,age) => `${sessionName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureFlag}`;
  const flowCookie = (token,age) => `${flowName}=${token}; Path=/api/admin/login/google; HttpOnly; SameSite=Lax; Max-Age=${age}${secureFlag}`;
  const sessionKey = req => {
    const token = readCookie(req,sessionName);
    return /^[a-f0-9]{64}$/.test(token) ? sessionDigest(token) : null;
  };
  const signature = payload => createHmac('sha256',config.clientSecret).update(`almaktab-google-flow-v1:${identity}:${payload}`).digest('base64url');
  function readFlow(req) {
    const cookie = readCookie(req,flowName);
    if (cookie.length > 600) return null;
    const [payload,mac,...extra] = cookie.split('.');
    if (!payload || !mac || extra.length || !statePattern.test(mac) || !equal(signature(payload),mac)) return null;
    try {
      const flow = JSON.parse(Buffer.from(payload,'base64url').toString());
      if (flow.expires <= clock() || !statePattern.test(flow.state) || !statePattern.test(flow.nonce) || !statePattern.test(flow.verifier)) return null;
      return flow;
    } catch { return null; }
  }

  return {
    ready,
    correctHost,
    begin(req) {
      if (!correctHost(req)) return null;
      const flow = {state:randomUrlToken(),nonce:randomUrlToken(),verifier:randomUrlToken(),expires:clock()+flowLifetime*1000};
      const payload = Buffer.from(JSON.stringify(flow)).toString('base64url');
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      url.search = new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:'openid email',
        state:flow.state,nonce:flow.nonce,code_challenge:digest(flow.verifier).toString('base64url'),code_challenge_method:'S256',prompt:'select_account'}).toString();
      return {location:url.href,cookie:flowCookie(`${payload}.${signature(payload)}`,flowLifetime)};
    },
    async finish(req, params) {
      const flow = correctHost(req) && readFlow(req);
      const state = params.get('state');
      if (!flow || !state || params.getAll('state').length !== 1 || !statePattern.test(state) || !equal(flow.state,state)) return {status:'failed'};
      const expiredFlow = flowCookie('',0);
      if (params.has('error')) return {status:'cancelled',cookies:[expiredFlow]};
      const code = params.get('code');
      if (!code || params.getAll('code').length !== 1 || code.length > 2048) return {status:'failed',cookies:[expiredFlow]};
      let claims;
      try { claims = await googleExchange({code,verifier:flow.verifier,nonce:flow.nonce,config}); }
      catch { console.warn('Google OAuth login: code exchange or identity token verification failed.'); return {status:'failed',cookies:[expiredFlow]}; }
      if (!allowedGoogleAccount(claims,config.email)) return {status:'account',cookies:[expiredFlow]};
      const token = randomBytes(32).toString('hex'), time = clock();
      await db.batch([
        {sql:'DELETE FROM sessions WHERE token=? OR expires<=?',args:[sessionKey(req),time]},
        {sql:'INSERT INTO sessions VALUES (?,?)',args:[sessionDigest(token),time+sessionLifetime*1000]},
      ]);
      return {status:'ok',cookies:[sessionCookie(token,sessionLifetime),expiredFlow]};
    },
    async authenticated(req) {
      const token = sessionKey(req);
      return Boolean(correctHost(req) && token && await db.get('SELECT 1 FROM sessions WHERE token=? AND expires>?',[token,clock()]));
    },
    async logout(req) {
      await db.run('DELETE FROM sessions WHERE token=?',[sessionKey(req)]);
      return sessionCookie('',0);
    },
  };
}
