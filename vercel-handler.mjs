import { isIP } from 'node:net';
import { createHandler } from './application.mjs';
import { cloudDatabase } from './database.mjs';
import { readAdminConfig } from './admin-auth.mjs';
import { databaseError, databaseErrorBody } from './cloud-database-errors.mjs';

const routePattern = /^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/;
export function vercelPath(url) {
  const parsed = URL.parse(url, 'http://localhost');
  if (!parsed) return null;
  const { pathname, searchParams } = parsed;
  const route = ['/', '/api', '/api/', '/api/almaktab', '/api/almaktab.js'].includes(pathname) ? searchParams.get('__route') : pathname.startsWith('/api/') ? pathname.slice(5) : null;
  return route && route.length <= 240 && routePattern.test(route) ? `/api/${route}` : null;
}
function json(res, status, payload) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(payload));
}
const ip = req => {
  const forwarded = req.headers['x-vercel-forwarded-for'] || req.headers['x-real-ip'];
  const address = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : '';
  return isIP(address) ? address : req.socket.remoteAddress;
};

async function initialize(env) {
  const db = await cloudDatabase(env);
  try {
    return await createHandler({
      ...readAdminConfig(env), db, secure:true, clientIp:ip, seed:env.SEED_DEMO === 'true',
    });
  } catch (error) { db.close(); throw error; }
}

export function createVercelHandler({ env = process.env, init = initialize } = {}) {
  let pending, failure, retryAt = 0;
  return async (req, res) => {
    const path = vercelPath(req.url);
    if (!path) return json(res,404,{error:'المسار غير موجود.'});
    if (!pending && Date.now() >= retryAt) {
      pending = Promise.resolve().then(() => init(env)).catch(error => {
        failure = databaseError(error);
        console.error('Vercel database initialization:', failure.code, ...failure.missing);
        retryAt = Date.now()+10_000;
        pending = undefined;
        return null;
      });
    }
    const handler = await pending;
    if (!handler) return json(res,503,databaseErrorBody(failure));
    return handler(req,res,path);
  };
}
