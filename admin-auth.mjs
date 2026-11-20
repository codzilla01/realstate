import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const requestCooldown = 60;
export const codeLifetime = 300;
const sessionLifetime = 8 * 60 * 60;
const sessionName = 'almaktab_session';
const challengeName = 'almaktab_login_challenge';
export const normalizeDigits = value => value.replace(/[٠-٩۰-۹]/g, digit => String(digit >= '۰' ? digit.charCodeAt(0) - 0x06f0 : digit.charCodeAt(0) - 0x0660));
export const emailOK = email => /^[^\s@<>?&#:]+@[a-z\d.-]+\.[a-z\d-]+$/i.test(email);
const digest = value => createHash('sha256').update(value).digest();
const randomToken = () => randomBytes(32).toString('hex');
function readCookie(req, name) {
  const pair = req.headers.cookie?.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  const token = pair?.slice(name.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

export function createAdminAuth({ db, adminEmail = '', deliverCode, onDeliveryError = () => console.error('Admin login email delivery failed. Check the SMTP service configuration and logs.'), secure, clock = Date.now }) {
  const email = adminEmail.trim().toLowerCase();
  if (email && (email.length > 180 || !emailOK(email))) throw new Error('ADMIN_EMAIL must be a valid email address');
  const ready = Boolean(email && typeof deliverCode === 'function');
  const identity = ready ? digest(`email-otp-v1:${email}`).toString('hex') : 'disabled';
  const initialize = db.prepare('SELECT value FROM settings WHERE key=?');
  if (initialize.get('admin_auth_identity')?.value !== identity) {
    db.exec('BEGIN IMMEDIATE');
    try {
      if (initialize.get('admin_auth_identity')?.value !== identity) {
        db.exec('DELETE FROM sessions');
        db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run('admin_auth_identity', identity);
      }
      db.exec('COMMIT');
    } catch (err) { db.exec('ROLLBACK'); throw err; }
  }

  const key = randomBytes(32);
  const challenges = new Map();
  const sends = [];
  const emailDigest = digest(email);
  const matchesEmail = value => timingSafeEqual(digest(value.trim().toLowerCase()), emailDigest);
  const codeDigest = (token, code) => createHmac('sha256', key).update(`${token}:${code}`).digest();
  const sessionDigest = token => digest(`${identity}:${token}`).toString('hex');
  const cookie = (name, token, age) => `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const sessionKey = req => {
    const token = readCookie(req, sessionName);
    return token ? sessionDigest(token) : null;
  };
  const deleteSession = db.prepare('DELETE FROM sessions WHERE token=?');
  const liveSession = db.prepare('SELECT 1 FROM sessions WHERE token=? AND expires>?');

  return {
    ready,
    requestCode(req, submittedEmail) {
      const time = clock(), token = readCookie(req, challengeName) || randomToken();
      for (const [id, challenge] of challenges) if (challenge.expires <= time) challenges.delete(id);
      while (sends.length && sends[0] <= time - 15 * 60_000) sends.shift();
      const wait = time - (sends.at(-1) ?? -Infinity);
      if (ready && matchesEmail(submittedEmail) && wait >= requestCooldown * 1000 && sends.length < 5) {
        const previous = challenges.get(token);
        let code, hash;
        do {
          code = String(randomInt(1_000_000)).padStart(6, '0');
          hash = codeDigest(token, code);
        } while (previous && timingSafeEqual(hash, previous.hash));
        const challenge = { hash, expires: time + codeLifetime * 1000, attempts: 0 };
        challenges.set(token, challenge);
        sends.push(time);
        // Return the same response for unrelated addresses and SMTP failures. Do not log codes or addresses.
        Promise.resolve().then(() => deliverCode({ to: email, code, expiresIn: codeLifetime })).catch(error => {
          if (challenges.get(token) === challenge) challenges.delete(token);
          onDeliveryError(error);
        });
      }
      return cookie(challengeName, token, codeLifetime);
    },
    verifyCode(req, submittedEmail, code) {
      const token = readCookie(req, challengeName);
      const challenge = challenges.get(token);
      const time = clock();
      if (!ready || !challenge || challenge.expires <= time) { if (challenge) challenges.delete(token); return null; }
      challenge.attempts++;
      const valid = timingSafeEqual(codeDigest(token, code), challenge.hash) && matchesEmail(submittedEmail);
      if (valid || challenge.attempts >= 5) challenges.delete(token);
      if (!valid) return null;
      const previous = sessionKey(req);
      if (previous) deleteSession.run(previous);
      db.prepare('DELETE FROM sessions WHERE expires<=?').run(time);
      const session = randomToken();
      db.prepare('INSERT INTO sessions VALUES (?,?)').run(sessionDigest(session), time + sessionLifetime * 1000);
      return [cookie(sessionName, session, sessionLifetime), cookie(challengeName, '', 0)];
    },
    authenticated(req) {
      const token = sessionKey(req);
      return Boolean(ready && token && liveSession.get(token, clock()));
    },
    logout(req) {
      deleteSession.run(sessionKey(req));
      challenges.delete(readCookie(req, challengeName));
      return [cookie(sessionName, '', 0), cookie(challengeName, '', 0)];
    },
  };
}
