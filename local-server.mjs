import { createServer } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHandler } from './application.mjs';
import { localDatabase } from './local-database.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const paths = new Map(Object.entries({ '/': 'index.html', '/index.html': 'index.html', '/admin': 'admin.html', '/admin.html': 'admin.html', '/styles.css': 'styles.css', '/admin.css': 'admin.css', '/script.js': 'script.js', '/admin.js': 'admin.js', '/ui.js': 'ui.js' }));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };

function staticPage(req, res, path, secure) {
  const asset = /^\/(images\/[\w.-]+\.(?:jpe?g|png|webp)|fonts\/[\w.-]+\.woff2)$/i.exec(path);
  const file = paths.get(path) || (asset && `public/${asset[1]}`);
  const full = file && resolve(root, file);
  const stat = full && statSync(full, {throwIfNoEntry:false});
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  const frame = secure && file === 'admin.html' ? "; frame-ancestors 'none'" : '';
  res.setHeader('Content-Security-Policy', `default-src 'self'; img-src 'self' https:; object-src 'none'; base-uri 'none'; form-action 'self'${frame}`);
  const canRead = req.method === 'GET' || req.method === 'HEAD';
  if (!canRead || !stat?.isFile()) {
    res.writeHead(canRead ? 404 : 405, {'Content-Type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({error:canRead ? 'الصفحة غير موجودة.' : 'طريقة غير مدعومة.'}));
  }
  res.writeHead(200, {'Content-Type':mime[extname(file)], 'Content-Length':stat.size, 'Cache-Control':asset ? 'public, max-age=86400' : 'no-cache'});
  return req.method === 'HEAD' ? res.end() : createReadStream(full).on('error', () => res.destroy()).pipe(res);
}

export async function createApp({ dbPath = ':memory:', ...options } = {}) {
  const db = localDatabase(dbPath);
  let handler;
  try { handler = await createHandler({ ...options, db }); }
  catch (error) { db.close(); throw error; }
  const server = createServer((req, res) => {
    const url = URL.parse(req.url, 'http://localhost');
    if (!url) { res.writeHead(400); return res.end(); }
    if (url.pathname.startsWith('/api/')) return handler(req,res,url.pathname);
    try { return staticPage(req,res,url.pathname,options.secure); }
    catch (error) { console.error(error); if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  server.on('close', () => db.close());
  return server;
}
