import { createHash, randomUUID } from 'node:crypto';
import { CloudDatabaseError, databaseErrorBody } from './cloud-database-errors.mjs';
import { initializeDatabase, propertyArgs, saveProperty } from './database.mjs';
import { createAdminAuth, googleCallbackPath, emailOK, normalizeDigits } from './admin-auth.mjs';
import { cities, types, statuses, stages, samples, siteDefaults } from './catalog.mjs';


const fail = (status, message) => Object.assign(new Error(message), { status });
const now = () => new Date().toISOString();
const clean = (value, max, min = 0) => {
  if (value == null && min === 0) return '';
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) throw fail(400, 'تحقق من الحقول المطلوبة وطول النص.');
  return value.trim();
};
const oneOf = (value, list) => {
  if (!list.includes(value)) throw fail(400, 'اختر قيمة صالحة من القائمة.');
  return value;
};
const number = (value, max, min = 0) => {
  if (value === '' || value == null || typeof value === 'boolean' || !['number', 'string'].includes(typeof value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) throw fail(400, 'تحقق من القيم الرقمية.');
  return Number(value);
};
const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
const dateInUAE = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const phoneOK = phone => /^\+?[\d ()-]+$/.test(phone) && phone.replace(/\D/g, '').length >= 7;
const imageOK = path => /^\/images\/[\w.-]+\.(jpe?g|webp|png)$/i.test(path) || (() => { try { const u = new URL(path); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } })();

export async function createHandler({ db, google, googleExchange, authClock, clientIp = req => req.socket.remoteAddress, seed = true, secure = false } = {}) {
  await initializeDatabase(db, seed);
  const set = (key,value) => db.run('INSERT OR REPLACE INTO settings VALUES (?,?)',[key,value]);
  const get = key => db.get('SELECT value FROM settings WHERE key=?',[key]);
  const properties = published => db.all(`SELECT * FROM properties ${published ? 'WHERE published=1' : ''} ORDER BY featured DESC,updated_at DESC`);
  const property = id => db.get('SELECT * FROM properties WHERE id=?',[id]);
  const leads = () => db.all('SELECT leads.*, properties.title AS property_title FROM leads LEFT JOIN properties ON properties.id=leads.property_id ORDER BY created_at DESC');
  const site = async () => ({ ...siteDefaults, ...JSON.parse((await get('site'))?.value || '{}') });
  const adminAuth = await createAdminAuth({ db, google, googleExchange, secure, clock: authClock });
  const sampleIds = new Set(samples.map(p => p.id));
  const withDemoFlag = p => ({ ...p, demo: sampleIds.has(p.id) });
  async function limit(req, scope, max, period) {
    const time = Date.now(), key = createHash('sha256').update(`${scope}:${clientIp(req) || 'unknown'}`).digest('hex');
    if (Math.random() < 0.02) await db.run('DELETE FROM rate_limits WHERE expires<=?', [time]);
    const row = await db.get(`INSERT INTO rate_limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET
      count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,
      expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END
      WHERE expires<=? OR count<? RETURNING count`, [key,time+period,time,time,time,max]);
    if (!row) throw fail(429, 'محاولات كثيرة. يُرجى المحاولة لاحقًا.');
  }
  async function body(req) {
    if (req.headers['content-type']?.split(';')[0] !== 'application/json') throw fail(415, 'صيغة الطلب غير مدعومة.');
    let size = 0; const parts = [];
    if (Number(req.headers['content-length']) > 32_768) { req.resume(); throw fail(413, 'حجم الطلب أكبر من المسموح.'); }
    for await (const part of req.iterator({ destroyOnReturn: false })) {
      size += part.length;
      if (size > 32_768) { req.resume(); throw fail(413, 'حجم الطلب أكبر من المسموح.'); }
      parts.push(part);
    }
    try { const parsed = JSON.parse(Buffer.concat(parts).toString('utf8')); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error(); return parsed; }
    catch { throw fail(400, 'تعذر قراءة الطلب.'); }
  }
  const json = (res, status, payload) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(payload)); };
  return async (req, res, routeOverride) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'self'");
    try {
      const path = routeOverride || new URL(req.url, 'http://localhost').pathname;
      const method = req.method;
      if (method !== 'GET') {
        const origin = req.headers.origin;
        const requestOrigin = origin ? URL.parse(origin) : null;
        if (origin && (!requestOrigin || !['https:', 'http:'].includes(requestOrigin.protocol) || requestOrigin.host !== req.headers.host)) throw fail(403, 'مصدر الطلب غير مسموح.');
        if (req.headers['sec-fetch-site'] === 'cross-site') throw fail(403, 'مصدر الطلب غير مسموح.');
      }
      if (path === '/api/site' && method === 'GET') {
        const [content, published] = await Promise.all([site(), properties(true)]);
        return json(res, 200, { site: content, properties: published.map(withDemoFlag) });
      }
      if (path === '/api/inquiries' && method === 'POST') {
        await limit(req, 'inquiries', 15, 600_000);
        const input = await body(req);
        if (input.website) throw fail(400, 'تعذر قبول الطلب.');
        const id = randomUUID(), propertyId = clean(input.propertyId, 70) || null;
        const listing = propertyId && await property(propertyId);
        if (propertyId && (!listing?.published || listing.status !== 'available')) throw fail(409, 'هذا العقار غير متاح للمعاينة حاليًا.');
        const name = clean(input.name, 90, 2), phone = normalizeDigits(clean(input.phone, 30, 7)), email = clean(input.email, 180);
        const date = clean(input.preferredDate, 10);
        if (!phoneOK(phone) || (email && !emailOK(email))) throw fail(400, 'تحقق من رقم الهاتف والبريد الإلكتروني.');
        if (date && (!validDate(date) || date < dateInUAE())) throw fail(400, 'اختر تاريخًا صالحًا اليوم أو بعده.');
        await db.run('INSERT INTO leads VALUES (?,?,?,?,?,?,?,?,?,?,?)',[id,propertyId,name,phone,email,date,clean(input.message,1800),'new','','',now()]);
        return json(res, 201, { reference: id.split('-')[0].toUpperCase() });
      }
      if (method === 'GET' && path === '/api/admin/login/status') return json(res,200,{configured:adminAuth.ready,onConfiguredHost:adminAuth.correctHost(req)});
      if (method === 'GET' && (path === '/api/admin/login/google' || path === googleCallbackPath)) {
        res.setHeader('Referrer-Policy','no-referrer');
        const redirect = (location,cookies) => {
          if (cookies) res.setHeader('Set-Cookie',cookies);
          res.writeHead(303,{Location:location,'Cache-Control':'no-store'});
          return res.end();
        };
        if (!adminAuth.correctHost(req)) return redirect('/admin?login=unavailable');
        if (path === googleCallbackPath) {
          const result = await adminAuth.finish(req,new URL(req.url,'http://localhost').searchParams);
          return redirect(result.status === 'ok' ? '/admin' : `/admin?login=${result.status}`,result.cookies);
        }
        try { await limit(req,'admin-google-start',20,900_000); }
        catch (error) { if (error.status === 429) return redirect('/admin?login=limited'); throw error; }
        const start = adminAuth.begin(req);
        return redirect(start.location,start.cookie);
      }
      if (path.startsWith('/api/admin/')) {
        res.setHeader('Content-Security-Policy', `${res.getHeader('Content-Security-Policy')}; frame-ancestors 'none'`);
        if (!await adminAuth.authenticated(req)) throw fail(401, 'سجّل الدخول للوصول إلى لوحة الإدارة.');
        if (path === '/api/admin/logout' && method === 'POST') {
          res.setHeader('Set-Cookie', await adminAuth.logout(req));
          return json(res, 200, { ok: true });
        }
        if (path === '/api/admin/data' && method === 'GET') {
          const [list, inquiries, content] = await Promise.all([properties(false), leads(), site()]);
          return json(res, 200, { properties: list, leads: inquiries, site: content });
        }
        const p = /^\/api\/admin\/properties(?:\/([\w-]+))?$/.exec(path);
        if (p) {
          const id = p[1];
          const existing = id && await property(id);
          if (id && !existing) throw fail(404, 'لم يُعثر على العقار.');
          if (id && method === 'GET') return json(res, 200, withDemoFlag(existing));
          if ((!id && method === 'POST') || (id && method === 'PUT')) {
            const inData = await body(req);
            const image = clean(inData.image, 1500);
            if (image && !imageOK(image)) throw fail(400, 'أدخل رابط صورة HTTPS صالحًا.');
            const row = { id: id || randomUUID(), title: clean(inData.title, 120, 2), type: oneOf(inData.type, types), city: oneOf(inData.city, cities), district: clean(inData.district, 90, 2), price: number(inData.price, 10_000_000_000, 1), beds: number(inData.beds, 50), baths: number(inData.baths, 50), area: number(inData.area, 10_000_000, 1), image, description: clean(inData.description, 3000), status: oneOf(inData.status, statuses), featured: inData.featured === true ? 1 : 0, published: inData.published === true ? 1 : 0, updated_at: now() };
            await db.run(saveProperty, propertyArgs(row)); return json(res, id ? 200 : 201, row);
          }
        }
        const l = /^\/api\/admin\/leads\/([\w-]+)$/.exec(path);
        if (l && method === 'PATCH') {
          const data = await body(req), stage = oneOf(data.stage, stages), schedule = clean(data.scheduledAt, 16);
          if ((stage === 'scheduled' && !schedule) || (schedule && (!validDate(schedule.slice(0, 10)) || !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/.test(schedule)))) throw fail(400, 'أدخل تاريخ ووقت المعاينة.');
          const changes = await db.run('UPDATE leads SET stage=?,notes=?,scheduled_at=? WHERE id=?',[stage,clean(data.notes,3000),schedule,l[1]]);
          if (!changes) throw fail(404, 'لم يُعثر على الطلب.');
          return json(res, 200, { ok: true });
        }
        if (path === '/api/admin/site' && method === 'PUT') {
          const data = await body(req), email = clean(data.email, 180), phone = normalizeDigits(clean(data.phone, 30));
          if ((email && !emailOK(email)) || (phone && !phoneOK(phone))) throw fail(400, 'تحقق من بيانات التواصل.');
          await set('site', JSON.stringify({ headline: clean(data.headline, 100, 3), intro: clean(data.intro, 230, 3), email, phone }));
          return json(res, 200, await site());
        }
      }
      throw fail(404, 'المسار غير موجود.');
    } catch (e) {
      if (res.headersSent || res.destroyed) return;
      if (e instanceof CloudDatabaseError) {
        console.error('Database request failed:', e.code);
        return json(res,503,databaseErrorBody(e));
      }
      if (!e.status) console.error(e);
      json(res, e.status || 500, { error: e.status ? e.message : 'تعذر إكمال العملية. حاول مرة أخرى.' });
    }
  };
}
