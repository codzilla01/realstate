import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const sessionLifetime = 8 * 60 * 60;
const sessionName = 'almaktab_session';
const usernamePattern = /^[a-z0-9_.-]{3,64}$/;
const hashPattern = /^scrypt:([a-f0-9]{32}):([a-f0-9]{128})$/;
const derive = promisify(scrypt);
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const digest = value => createHash('sha256').update(value).digest();
const normalizeUsername = value => typeof value === 'string' ? value.trim().toLowerCase() : '';

export const normalizeDigits = value => value.replace(/[٠-٩۰-۹]/g, digit => String(digit >= '۰' ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660));
export const emailOK = email => /^[^\s@<>?&#:]+@[a-z\d.-]+\.[a-z\d-]+$/i.test(email);

export async function hashAdminPassword(password) {
  if (typeof password !== 'string' || password.length < 14 || password.length > 256 || !/\S/.test(password)) throw new Error('Use a unique password between 14 and 256 characters.');
  const salt = randomBytes(16);
  const hash = await derive(password, salt, 64, scryptOptions);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function readAdminConfig(env) {
  const adminUsername = normalizeUsername(env.ADMIN_USERNAME);
  const adminPasswordHash = env.ADMIN_PASSWORD_HASH?.trim() || '';
  if (!usernamePattern.test(adminUsername) || !hashPattern.test(adminPasswordHash)) {
    console.warn('Admin sign-in disabled: set a valid ADMIN_USERNAME and generate ADMIN_PASSWORD_HASH with npm run admin:hash-password.');
    return {};
  }
  return {adminUsername,adminPasswordHash};
}

function readSession(req) {
  const pair = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${sessionName}=`));
  const token = pair?.slice(sessionName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export async function createAdminAuth({ db, adminUsername = '', adminPasswordHash = '', secure, clock = Date.now }) {
  const username = normalizeUsername(adminUsername);
  const parsedHash = hashPattern.exec(adminPasswordHash);
  const ready = Boolean(usernamePattern.test(username) && parsedHash);
  const identity = ready ? digest(`username-password-v1\0${username}\0${adminPasswordHash}`).toString('hex') : 'disabled';
  if (db.local && (await db.get("SELECT value FROM settings WHERE key='admin_auth_identity'"))?.value !== identity) {
    await db.batch([
      {sql:"DELETE FROM sessions WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='admin_auth_identity' AND value=?)",args:[identity]},
      {sql:"INSERT OR REPLACE INTO settings VALUES ('admin_auth_identity',?)",args:[identity]},
    ]);
  }

  const expectedUsername = digest(username);
  const salt = ready && Buffer.from(parsedHash[1],'hex');
  const expectedHash = ready && Buffer.from(parsedHash[2],'hex');
  const sessionDigest = token => digest(`${identity}:${token}`).toString('hex');
  const cookie = (token, age) => `${sessionName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const sessionKey = req => {
    const token = readSession(req);
    return token ? sessionDigest(token) : null;
  };

  return {
    ready,
    async login(req, input) {
      const {username: inputUsername, password} = input;
      if (!ready || typeof inputUsername !== 'string' || inputUsername.length > 64 || typeof password !== 'string' || password.length > 256) return null;
      const actualHash = await derive(password,salt,64,scryptOptions);
      const usernameMatches = timingSafeEqual(expectedUsername,digest(normalizeUsername(inputUsername)));
      const passwordMatches = timingSafeEqual(expectedHash,actualHash);
      if (!usernameMatches || !passwordMatches) return null;
      const token = randomBytes(32).toString('hex'), time = clock();
      await db.batch([
        {sql:'DELETE FROM sessions WHERE token=? OR expires<=?',args:[sessionKey(req),time]},
        {sql:'INSERT INTO sessions VALUES (?,?)',args:[sessionDigest(token),time+sessionLifetime*1000]},
      ]);
      return cookie(token,sessionLifetime);
    },
    async authenticated(req) {
      const token = sessionKey(req);
      return Boolean(ready && token && await db.get('SELECT 1 FROM sessions WHERE token=? AND expires>?',[token,clock()]));
    },
    async logout(req) {
      await db.run('DELETE FROM sessions WHERE token=?',[sessionKey(req)]);
      return cookie('',0);
    },
  };
}
