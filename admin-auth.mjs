import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';

export const requestCooldown = 60;
export const codeLifetime = 300;
const sessionLifetime = 8 * 60 * 60;
const sendWindow = 15 * 60_000;
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

export async function createAdminAuth({ db, adminEmail = '', deliverCode, onDeliveryError = () => console.error('Admin login email delivery failed.'), secure, clock = Date.now, authSecret, defer }) {
  const email = adminEmail.trim().toLowerCase();
  if (email && (email.length > 180 || !emailOK(email))) throw new Error('ADMIN_EMAIL must be a valid email address');
  const ready = Boolean(email && typeof deliverCode === 'function');
  const identity = ready ? digest(`email-otp-v1:${email}${authSecret ? `:${authSecret}` : ''}`).toString('hex') : 'disabled';
  if (db.local && (await db.get("SELECT value FROM settings WHERE key='admin_auth_identity'"))?.value !== identity) {
    await db.batch([
      {sql:"DELETE FROM sessions WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='admin_auth_identity' AND value=?)",args:[identity]},
      {sql:"DELETE FROM login_challenges WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='admin_auth_identity' AND value=?)",args:[identity]},
      {sql:"INSERT OR REPLACE INTO settings VALUES ('admin_auth_identity',?)",args:[identity]},
    ]);
  }

  const key = authSecret || randomBytes(32);
  const emailDigest = digest(email);
  const matchesEmail = value => timingSafeEqual(digest(value.trim().toLowerCase()), emailDigest);
  const codeDigest = (token, code) => createHmac('sha256', key).update(`${token}:${code}`).digest('hex');
  const sessionDigest = token => digest(`${identity}:${token}`).toString('hex');
  const cookie = (name, token, age) => `${name}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const sessionKey = req => {
    const token = readCookie(req, sessionName);
    return token ? sessionDigest(token) : null;
  };

  async function reserveCode(challenge, time) {
    const reserved = await db.run(`INSERT INTO login_deliveries (id,identity,sent_at)
      SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM login_deliveries WHERE identity=? AND sent_at>?)
      AND (SELECT COUNT(*) FROM login_deliveries WHERE identity=? AND sent_at>?) < 5`,
      [randomToken(),identity,time,identity,time-requestCooldown*1000,identity,time-sendWindow]);
    if (!reserved) return null;
    const previous = await db.get('SELECT hash FROM login_challenges WHERE token=?',[challenge]);
    let code, hash;
    do {
      code = String(randomInt(1_000_000)).padStart(6, '0');
      hash = codeDigest(challenge,code);
    } while (previous?.hash === hash);
    await db.batch([
      {sql:'DELETE FROM login_challenges WHERE expires<=?',args:[time]},
      {sql:'DELETE FROM login_deliveries WHERE sent_at<=?',args:[time-sendWindow]},
      {sql:'INSERT OR REPLACE INTO login_challenges VALUES (?,?,?,0)',args:[challenge,hash,time+codeLifetime*1000]},
    ]);
    return {challenge,hash,code};
  }
  async function deliver(record) {
    if (!record) return;
    const {challenge,hash,code} = record;
    try { await deliverCode({to:email,code,expiresIn:codeLifetime}); }
    catch (error) {
      onDeliveryError(error);
      try { await db.run('DELETE FROM login_challenges WHERE token=? AND hash=?',[challenge,hash]); }
      catch { console.error('Could not discard the undelivered admin challenge.'); }
    }
  }

  return {
    ready,
    async requestCode(req, submittedEmail) {
      const time = clock(), token = readCookie(req, challengeName) || randomToken();
      // Vercel keeps the lookup and delivery alive with waitUntil without varying the response by address.
      const issue = () => ready && matchesEmail(submittedEmail) ? reserveCode(sessionDigest(token),time) : null;
      if (defer) {
        defer(Promise.resolve().then(issue).then(deliver).catch(() => console.error('Could not prepare an admin code. Check database availability.')));
      } else {
        const record = await issue();
        void deliver(record);
      }
      return cookie(challengeName, token, codeLifetime);
    },
    async verifyCode(req, submittedEmail, code) {
      const token = readCookie(req, challengeName), time = clock();
      if (!ready || !token) return null;
      const challenge = sessionDigest(token), hash = matchesEmail(submittedEmail) ? codeDigest(challenge,code) : '';
      // The same atomic write consumes a correct code or counts a wrong attempt, across all instances.
      const row = await db.get(`UPDATE login_challenges SET attempts=CASE WHEN hash=? THEN 5 ELSE attempts+1 END
        WHERE token=? AND expires>? AND attempts<5 RETURNING hash`, [hash,challenge,time]);
      if (!row || row.hash !== hash) return null;
      const session = randomToken();
      await db.batch([
        {sql:'DELETE FROM sessions WHERE token=? OR expires<=?', args:[sessionKey(req),time]},
        {sql:'INSERT INTO sessions VALUES (?,?)', args:[sessionDigest(session),time+sessionLifetime*1000]},
      ]);
      return [cookie(sessionName, session, sessionLifetime), cookie(challengeName, '', 0)];
    },
    async authenticated(req) {
      const token = sessionKey(req);
      return Boolean(ready && token && await db.get('SELECT 1 FROM sessions WHERE token=? AND expires>?',[token,clock()]));
    },
    async logout(req) {
      const token = readCookie(req, challengeName);
      await db.batch([
        {sql:'DELETE FROM sessions WHERE token=?',args:[sessionKey(req)]},
        {sql:'DELETE FROM login_challenges WHERE token=?',args:[token && sessionDigest(token)]},
      ]);
      return [cookie(sessionName, '', 0), cookie(challengeName, '', 0)];
    },
  };
}
