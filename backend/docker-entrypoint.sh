#!/bin/sh
set -e

# The shipped schema has no migration history yet, so the container syncs the
# database with the Prisma schema on boot. Once you generate and commit real
# migrations (`npx prisma migrate dev --name init`), set
# PRISMA_SYNC=migrate to use `prisma migrate deploy` instead.
PRISMA_SYNC="${PRISMA_SYNC:-push}"

echo "[entrypoint] waiting for the database..."
node -e '
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const started = Date.now();
(async () => {
  for (;;) {
    try { await prisma.$queryRaw`SELECT 1`; break; }
    catch (e) {
      if (Date.now() - started > 60000) { console.error("Database not reachable"); process.exit(1); }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  await prisma.$disconnect();
  console.log("[entrypoint] database is reachable");
})();
'

if [ "$PRISMA_SYNC" = "migrate" ]; then
  echo "[entrypoint] applying migrations..."
  npx prisma migrate deploy
else
  echo "[entrypoint] syncing schema with the database..."
  npx prisma db push --skip-generate
fi

if [ "${SEED_ON_START:-false}" = "true" ]; then
  echo "[entrypoint] seeding demo data..."
  node prisma/seed.js
fi

echo "[entrypoint] starting the API..."
exec "$@"
