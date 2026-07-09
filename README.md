# MyWAppStore

A multi-tenant SaaS commerce platform enabling Zambian businesses to receive orders through WhatsApp. Built as a TypeScript monorepo with NestJS (backend), Next.js 16 (frontend), Prisma, and Supabase.

---

## Quick start (development)

```bash
git clone https://github.com/null1800/myWappStore.git
cd myWappStore

# 1. Install all workspace dependencies
npm install

# 2. Copy and fill in backend env
cp apps/backend/.env.example apps/backend/.env
# Edit apps/backend/.env — at minimum set DATABASE_URL, DIRECT_URL,
# NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, JWT_REFRESH_SECRET

# 3. Copy frontend env
cp apps/frontend/.env.example apps/frontend/.env
# Edit NEXT_PUBLIC_API_URL if your backend runs on a non-default port

# 4. Generate Prisma client and run migrations
cd apps/backend
npx prisma generate
npx prisma migrate deploy   # applies all pending migrations
npx prisma db execute --file prisma/rls-policies.sql  # RLS (run once)
cd ../..

# 5. Start dev servers (both apps in parallel via Turborepo)
npm run dev
```

Backend: http://localhost:3001  
Frontend: http://localhost:3000  
Health: http://localhost:3001/api/v1/health

---

## Architecture

```
myWappStore/
├── apps/
│   ├── backend/     NestJS API (port 3001)
│   └── frontend/    Next.js 16 (port 3000)
├── packages/
│   └── types/       Shared TypeScript types
├── docker-compose.yml
└── turbo.json
```

**Database:** Supabase-hosted Postgres (no local Postgres container — both apps connect to Supabase directly).  
**Auth:** Supabase Auth handles password hashing and email verification; NestJS issues its own HS256 JWTs for API access.  
**Email:** Resend (staff invitations). Supabase handles auth emails (verify, password reset).  
**Payments:** Paystack (ZMW, Zambia).  
**Storage:** Supabase Storage (product images, logos — uploaded directly from frontend with a signed URL).

---

## Environment variables

### Backend (`apps/backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase pooler connection string (port 6543, pgbouncer=true) |
| `DIRECT_URL` | ✅ | Direct Supabase connection string (port 5432, for migrations) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Service role key (never expose to client) |
| `JWT_SECRET` | ✅ | 64-byte random hex — `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | ✅ | Different 64-byte random hex |
| `JWT_EXPIRES_IN` | | Access token lifetime (default: `1h`) |
| `JWT_REFRESH_EXPIRES_IN` | | Refresh token lifetime (default: `7d`) |
| `NODE_ENV` | | `development` / `production` |
| `PORT` | | API port (default: `3001`) |
| `FRONTEND_URL` | | Used for CORS and email redirect links |
| `LOG_LEVEL` | | `error` / `warn` / `log` / `debug` (default: `warn` in prod) |
| `RESEND_API_KEY` | | Resend API key for staff invitation emails |
| `EMAIL_FROM` | | Sender address for staff invitation emails |
| `PAYSTACK_SECRET_KEY` | | Paystack secret key for subscription billing |

### Frontend (`apps/frontend/.env`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | | Backend API URL (default: `http://localhost:3001/api/v1`) |

> `NEXT_PUBLIC_API_URL` is **baked in at build time** — rebuild the image when changing it.

---

## Production deployment (Docker)

### First-time setup

```bash
# 1. Copy and fill in environment files
cp apps/backend/.env.example apps/backend/.env
# ... fill in all [required] values

# 2. Build and start (backend runs migrations on first start via entrypoint.sh)
docker compose up --build -d

# 3. Apply RLS policies (one-time, in Supabase SQL Editor)
# Copy and run: apps/backend/prisma/rls-policies.sql
```

### Deploy an update

```bash
git pull
docker compose up --build -d --no-deps backend
# Migrations run automatically via entrypoint.sh
# Frontend can be rebuilt independently if only UI changed:
docker compose up --build -d --no-deps frontend
```

### Migration-only (separate job)

```bash
# Skip auto-migration in entrypoint and run manually
docker compose run --rm -e SKIP_MIGRATE=1 backend \
  npx prisma migrate deploy
```

### Health checks

- **Backend liveness:** `GET /api/v1/health` — confirms the Node process is up
- **Backend readiness:** `GET /api/v1/health/ready` — confirms DB connection is live
- **Frontend liveness:** `GET /api/health` — Next.js server is responding

---

## Database migrations

Migrations live in `apps/backend/prisma/migrations/`. Always use `migrate deploy` in production (not `migrate dev`).

```bash
# Create a new migration (development only)
cd apps/backend
npx prisma migrate dev --name describe_your_change

# Apply pending migrations to production
npx prisma migrate deploy

# Check migration status
npx prisma migrate status
```

> **Never delete migration files** after they've been applied to any environment. Prisma uses them to verify schema consistency.

---

## Plans and limits

Plans are defined in `apps/backend/src/billing/plans.ts` — single source of truth.

| | Free | Starter | Pro |
|---|---|---|---|
| Products | 10 | 100 | Unlimited |
| Staff | 0 | 3 | Unlimited |
| Orders/month | 50 | 500 | Unlimited |
| Report history | 7 days | 30 days | 90 days |
| Variants | ❌ | ✅ | ✅ |
| Reports | ❌ | ✅ | ✅ |
| Monthly price | Free | ZMW 149 | ZMW 349 |

To change a limit: edit `plans.ts` and deploy. No migration needed.

### Paystack setup

1. Create a [Paystack](https://paystack.com) account and verify your Zambian business
2. Copy your secret key from the Paystack dashboard → Settings → API Keys
3. Set `PAYSTACK_SECRET_KEY` in your backend env
4. In Paystack dashboard → Settings → Webhooks, add: `https://yourdomain.com/api/v1/billing/webhook`
5. Test with Paystack's test keys first; switch to live keys for production

---

## Common operational tasks

### Reset a merchant's password (via Supabase)
Use the Supabase dashboard → Authentication → Users → find the user → send password reset.

### Revoke all sessions for a user
```sql
UPDATE refresh_tokens SET revoked_at = NOW()
WHERE user_id = 'user-uuid-here' AND revoked_at IS NULL;
```

### Check subscription status for a tenant
```sql
SELECT t.slug, t.plan, s.status, s.current_period_end
FROM tenants t
LEFT JOIN subscriptions s ON s.tenant_id = t.id
WHERE t.slug = 'store-slug-here';
```

### Manually expire a subscription (downgrade to free)
```sql
-- Update both tables atomically
BEGIN;
UPDATE subscriptions SET plan = 'free', status = 'expired' WHERE tenant_id = 'uuid';
UPDATE tenants SET plan = 'free' WHERE id = 'uuid';
COMMIT;
```

---

## Project structure (backend)

```
apps/backend/src/
├── auth/          Registration, login, JWT, refresh tokens, email verify, password reset
├── billing/       Plans, Paystack integration, subscription lifecycle, plan enforcement
├── common/        Guards, decorators, filters, interceptors, cache service
├── customers/     Customer profiles and order history
├── health/        Liveness and readiness probes
├── orders/        Checkout, order management, WhatsApp link generation
├── prisma/        PrismaService with slow-query logging
├── products/      Products, categories, variants, inventory
├── reports/       Sales, product, customer, and operational reports
├── staff/         Invite, manage, and deactivate team members
└── stores/        Store settings, public storefront API
```

---

## CI

GitHub Actions runs on every push to `main` and on all PRs:
- Backend: type-check + unit tests (Jest)
- Frontend: type-check
- Docker: compose config validation

See `.github/workflows/ci.yml`.
