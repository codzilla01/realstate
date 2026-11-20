import { isIP } from 'node:net';
import { createHandler } from './application.mjs';
import { cloudDatabase } from './database.mjs';
import { mailErrorSummary, setupAdminMail } from './mail.mjs';

const routePattern = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/;
export function vercelPath(url) {
  const parsed = URL.parse(url, 'http://localhost');
  if (!parsed) return null;
  const { pathname, searchParams } = parsed;
  const route = ['/', '/api', '/api/', '/api/almaktab', '/api/almaktab.js'].includes(pathname) ? searchParams.get('__route') : pathname.startsWith('/api/') ? pathname.slice(5) : null;
  return route && route.length <= 240 && routePattern.test(route) ? `/api/${route}` : null;
}
function json(res, status, message) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify({error:message}));
}
const ip = req => {
  const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'];
  const address = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  return isIP(address) ? address : req.socket.remoteAddress;
};

async function initialize(env, defer) {
  const db = await cloudDatabase(env);
  let mail = {};
  const authSecret = env.AUTH_SECRET?.trim();
  if (authSecret && authSecret.length >= 32) {
    try { mail = await setupAdminMail(env); }
    catch (error) { console.warn(`Admin sign-in disabled: ${mailErrorSummary(error)}`); }
  } else {
    console.warn('Admin sign-in disabled: configure AUTH_SECRET with at least 32 characters.');
  }
  try {
    return await createHandler({
      ...mail, db, authSecret, defer, secure:true, clientIp:ip, seed:env.SEED_DEMO === 'true',
      onDeliveryError: error => console.error(`Admin email delivery failed: ${mailErrorSummary(error)}`),
    });
  } catch (error) { db.close(); throw error; }
}

export function createVercelHandler({ env = process.env, defer, init = initialize } = {}) {
  let pending, retryAt = 0;
  return async (req, res) => {
    const path = vercelPath(req.url);
    if (!path) return json(res,404,'المسار غير موجود.');
    if (!pending && Date.now() >= retryAt) {
      pending = Promise.resolve().then(() => init(env,defer)).catch(() => {
        console.error('Vercel API initialization failed. Check TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, and database availability.');
        retryAt = Date.now()+10_000;
        pending = undefined;
        return null;
      });
    }
    const handler = await pending;
    if (!handler) return json(res,503,'قاعدة بيانات Vercel غير متاحة. تحقّق من إعدادات قاعدة البيانات على الخادم.');
    return handler(req,res,path);
  };
}
