import { samples } from './catalog.mjs';

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

export async function cloudDatabase(env) {
  const url = env.TURSO_DATABASE_URL?.trim(), authToken = env.TURSO_AUTH_TOKEN?.trim();
  if (!url || !authToken) throw new Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on Vercel.');
  const parsed = URL.parse(url);
  if (!parsed || !['libsql:', 'https:'].includes(parsed.protocol) || !parsed.hostname || parsed.username || parsed.password) throw new Error('TURSO_DATABASE_URL must be a remote libsql:// or HTTPS database URL.');
  const { createClient } = await import('@libsql/client/web');
  const client = createClient({url,authToken});
  return {
    get: async (sql,args = []) => (await client.execute({sql,args})).rows[0],
    all: async (sql,args = []) => (await client.execute({sql,args})).rows,
    run: async (sql,args = []) => (await client.execute({sql,args})).rowsAffected,
    batch: statements => client.batch(statements, 'write'),
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
