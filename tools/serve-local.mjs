import { fileURLToPath } from 'node:url';
import { createApp } from '../local-server.mjs';
import { readAdminConfig } from '../admin-auth.mjs';

process.umask(0o077);
const production = process.env.NODE_ENV === 'production';
const app = await createApp({
  dbPath: process.env.DATABASE_PATH || fileURLToPath(new URL('../data/almaktab.sqlite', import.meta.url)),
  ...readAdminConfig(process.env),
  secure: process.env.COOKIE_SECURE === 'true' || production,
  seed: process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : !production,
});
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Almaktab listening on port ${port}`));
