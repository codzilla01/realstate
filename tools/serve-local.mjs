import { fileURLToPath } from 'node:url';
import { createApp } from '../local-server.mjs';
import { mailErrorSummary, setupAdminMail } from '../mail.mjs';

process.umask(0o077);
const production = process.env.NODE_ENV === 'production';
let mail = {};
try { mail = await setupAdminMail(process.env); }
catch (error) { console.warn(`Admin sign-in disabled: ${mailErrorSummary(error)} The public site is still available.`); }
const app = await createApp({
  dbPath: process.env.DATABASE_PATH || fileURLToPath(new URL('../data/almaktab.sqlite', import.meta.url)),
  adminEmail: mail.adminEmail, deliverCode: mail.deliverCode,
  authSecret: process.env.AUTH_SECRET?.trim() || undefined,
  onDeliveryError: error => console.error(`Admin email delivery failed: ${mailErrorSummary(error)}`),
  secure: process.env.COOKIE_SECURE === 'true' || production,
  seed: process.env.SEED_DEMO ? process.env.SEED_DEMO === 'true' : !production,
});
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Almaktab listening on port ${port}`));
