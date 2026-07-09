#!/bin/sh
# entrypoint.sh — runs inside the production backend container before `node dist/main.js`
#
# Responsibilities:
#   1. Wait for the database to accept connections (avoids startup-race crashes
#      when the container starts before the DB pooler is ready, e.g. cold starts)
#   2. Run `prisma migrate deploy` to apply any pending migrations atomically
#      before the app begins serving requests
#   3. Exec into the actual Node process (PID 1 stays as the app, not this shell)
#
# Set SKIP_MIGRATE=1 to skip migration (useful in read-only replicas or
# if you're running migrations out-of-band via a separate job).

set -e

echo "[entrypoint] Starting MyWAppStore backend…"

# ── 1. Wait for DB ──────────────────────────────────────────────────────────
# Uses node (already in the image) so we don't need curl/wget/pg_isready
# as separate dependencies. Tries every 2 seconds for up to 60 seconds.

if [ -z "$SKIP_DB_WAIT" ]; then
  echo "[entrypoint] Waiting for database connection…"
  node -e "
const { Client } = require('pg');
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) { console.error('[entrypoint] DIRECT_URL / DATABASE_URL not set'); process.exit(1); }

const maxAttempts = 30;
let attempts = 0;

async function wait() {
  while (attempts < maxAttempts) {
    attempts++;
    const client = new Client({ connectionString: url, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      console.log('[entrypoint] Database ready after', attempts, 'attempt(s)');
      process.exit(0);
    } catch (err) {
      console.log('[entrypoint] DB not ready yet (' + attempts + '/' + maxAttempts + '):', err.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('[entrypoint] Database unreachable after', maxAttempts, 'attempts. Aborting.');
  process.exit(1);
}
wait();
"
fi

# ── 2. Run migrations ────────────────────────────────────────────────────────
if [ -z "$SKIP_MIGRATE" ]; then
  echo "[entrypoint] Running database migrations…"
  npx prisma migrate deploy
  echo "[entrypoint] Migrations complete."
else
  echo "[entrypoint] SKIP_MIGRATE=1 — skipping migrations."
fi

# ── 3. Start the application ─────────────────────────────────────────────────
echo "[entrypoint] Starting application on port ${PORT:-3001}…"
exec "$@"
