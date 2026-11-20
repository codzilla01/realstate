import { samples } from './catalog.mjs';
import { CloudDatabaseError, databaseError } from './cloud-database-errors.mjs';

const schema = [
  'CREATE TABLE IF NOT EXISTS properties (id TEXT PRIMARY KEY, title TEXT NOT NULL, type TEXT NOT NULL, city TEXT NOT NULL, district TEXT NOT NULL, price INTEGER NOT NULL, beds INTEGER NOT NULL, baths INTEGER NOT NULL, area INTEGER NOT NULL, image TEXT NOT NULL, description TEXT NOT NULL, featured INTEGER NOT NULL, status TEXT NOT NULL, published INTEGER NOT NULL, updated_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, property_id TEXT REFERENCES properties(id), name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, preferred_date TEXT NOT NULL, message TEXT NOT NULL, stage TEXT NOT NULL, notes TEXT NOT NULL, scheduled_at TEXT NOT NULL, created_at TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS leads_stage_created ON leads(stage, created_at)',
  'CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS rate_limit_expiry ON rate_limits(expires)',
];
export const propertyFields = ['id','title','type','city','district','price','beds','baths','area','image','description','featured','status','published','updated_at'];
export const saveProperty = `INSERT INTO properties (${propertyFields.join(',')}) VALUES (${propertyFields.map(() => '?').join(',')}) ON CONFLICT(id) DO UPDATE SET ${propertyFields.slice(1).map(k => `${k}=excluded.${k}`).join(',')}`;
export const propertyArgs = row => propertyFields.map(key => row[key]);

export async function cloudDatabase(env, fetcher = globalThis.fetch) {
  const url = env.TURSO_DATABASE_URL?.trim(), authToken = env.TURSO_AUTH_TOKEN?.trim();
  const missing = [...(!url ? ['TURSO_DATABASE_URL'] : []), ...(!authToken ? ['TURSO_AUTH_TOKEN'] : [])];
  if (missing.length) throw new CloudDatabaseError('TURSO_CONFIG_MISSING', missing);
  const parsed = URL.parse(url);
  if (!parsed || !['libsql:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) {
    throw new CloudDatabaseError('TURSO_URL_INVALID');
  }
  const { createClient } = await import('@libsql/client/web');
  const client = createClient({url,authToken,fetch: async (request,options) => {
    const timeout = AbortSignal.timeout(8000);
    const original = options?.signal ?? request.signal;
    const signal = original ? AbortSignal.any([original,timeout]) : timeout;
    const response = await fetcher(request,{...options,signal});
    // Hrana uses unauthenticated GETs to discover the protocol; only classify errors from SQL requests.
    if ((options?.method ?? request.method) === 'POST' && [401,403,404].includes(response.status)) {
      void response.body?.cancel().catch(() => {});
      throw databaseError({status:response.status});
    }
    return response;
  }});
  const query = async run => { try { return await run(); } catch (error) { throw databaseError(error); } };
  const execute = (sql,args) => query(() => client.execute({sql,args}));
  return {
    get: async (sql,args = []) => (await execute(sql,args)).rows[0],
    all: async (sql,args = []) => (await execute(sql,args)).rows,
    run: async (sql,args = []) => (await execute(sql,args)).rowsAffected,
    batch: statements => query(() => client.batch(statements, 'write')),
    close: () => client.close(),
  };
}

export async function initializeDatabase(db, seed) {
  await db.batch(schema.map(sql => ({sql})));
  if (seed && !await db.get("SELECT 1 FROM settings WHERE key='seeded'")) {
    const sql = `INSERT OR IGNORE INTO properties (${propertyFields.join(',')}) SELECT ${propertyFields.map(() => '?').join(',')} WHERE NOT EXISTS (SELECT 1 FROM settings WHERE key='seeded')`;
    const statements = samples.map((p,i) => ({sql,args:propertyArgs({...p,status:'available',published:1,updated_at:`2025-01-0${3-i}T00:00:00.000Z`})}));
    await db.batch([...statements,{sql:"INSERT OR IGNORE INTO settings VALUES ('seeded','1')"}]);
  }
}
