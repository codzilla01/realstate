import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const sessionLifetime = 8 * 60 * 60;
const sessionName = 'almaktab_session';
const passwordSalt = 'almaktab-admin-password-v1';
const passwordBytes = 32;
const digest = value => createHash('sha256').update(value).digest();
const randomToken = () => randomBytes(32).toString('hex');
const equal = (a,b) => a.length === b.length && timingSafeEqual(a,b);

export const normalizeDigits = value => value.replace(/[٠-٩۰-۹]/g, digit => String(digit >= '۰' ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660));
export const emailOK = email => /^[^\s@<>?&#:]+@[a-z\d.-]+\.[a-z\d-]+$/i.test(email);

export function readAdminConfig(env) {
  const username = env.ADMIN_USERNAME?.trim();
  const password = env.ADMIN_PASSWORD;
  if (!username || username.length > 100 || typeof password !== 'string' || password.length < 12 || password.length > 1024) {
    console.warn('Admin sign-in disabled: set ADMIN_USERNAME and an ADMIN_PASSWORD of at least 12 characters.');
    return {};
  }
  return { credentials:{username,password} };
}

function readCookie(req, name) {
  const pair = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return pair?.slice(name.length+1) || '';
}

export async function createAdminAuth({ db, credentials, secure, clock = Date.now }) {
  const username = typeof credentials?.username === 'string' ? credentials.username.trim() : '';
  const password = credentials?.password;
  const ready = Boolean(username && username.length <= 100 && typeof password === 'string' && password.length >= 12 && password.length <= 1024);
  const expectedUsername = digest(username);
  const passwordKey = ready ? Buffer.from(await scrypt(password,passwordSalt,passwordBytes,{N:16384,r:8,p:1,maxmem:64*1024*1024})) : Buffer.alloc(passwordBytes);
  const identity = ready ? digest(Buffer.concat([Buffer.from('almaktab-password-session-v1:'),expectedUsername,passwordKey])).toString('hex') : 'disabled';

  // Revoke persisted sessions immediately whenever the configured username or password changes.
  if ((await db.get("SELECT value FROM settings WHERE key='admin_auth_identity'"))?.value !== identity) {
    await db.batch([
      {sql:'DELETE FROM sessions'},
      {sql:"INSERT OR REPLACE INTO settings VALUES ('admin_auth_identity',?)",args:[identity]},
    ]);
  }

  const sessionDigest = token => digest(`${identity}:${token}`).toString('hex');
  const secureFlag = secure ? '; Secure' : '';
  const sessionCookie = (token,age) => `${sessionName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureFlag}`;
  const sessionKey = req => {
    const token = readCookie(req,sessionName);
    return /^[a-f0-9]{64}$/.test(token) ? sessionDigest(token) : null;
  };

  return {
    ready,
    async login(inputUsername,inputPassword) {
      if (!ready || typeof inputUsername !== 'string' || inputUsername.length > 100 || typeof inputPassword !== 'string' || inputPassword.length > 1024) return false;
      const [candidateUsername,candidatePassword] = await Promise.all([
        Promise.resolve(digest(inputUsername)),
        scrypt(inputPassword,passwordSalt,passwordBytes,{N:16384,r:8,p:1,maxmem:64*1024*1024}),
      ]);
      return equal(expectedUsername,candidateUsername) && equal(passwordKey,Buffer.from(candidatePassword));
    },
    async createSession(req) {
      const token = randomToken(), time = clock();
      await db.batch([
        {sql:'DELETE FROM sessions WHERE token=? OR expires<=?',args:[sessionKey(req),time]},
        {sql:'INSERT INTO sessions VALUES (?,?)',args:[sessionDigest(token),time+sessionLifetime*1000]},
      ]);
      return sessionCookie(token,sessionLifetime);
    },
    async authenticated(req) {
      const token = sessionKey(req);
      return Boolean(token && await db.get('SELECT 1 FROM sessions WHERE token=? AND expires>?',[token,clock()]));
    },
    async logout(req) {
      await db.run('DELETE FROM sessions WHERE token=?',[sessionKey(req)]);
      return sessionCookie('',0);
    },
  };
}
