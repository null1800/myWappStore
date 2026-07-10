# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────
# MyWAppStore — Backend (NestJS) production image
#
# Build from the MONOREPO ROOT, not this directory:
#   docker build -f apps/backend/Dockerfile -t mywappstore-backend .
# (docker-compose.yml below already does this for you.)
#
# Uses `turbo prune` to extract only the backend's part of the workspace
# (its own files + whatever internal packages it actually depends on),
# so the install/build layers don't carry unrelated frontend code or deps.
# ─────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base

# ── 1. Prune the workspace down to just what the backend needs ────────────
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @my-wapp-store/backend --docker

# ── 2. Install deps + build ────────────────────────────────────────────────
FROM base AS installer
# openssl + libc6-compat: Prisma's query engine needs these on Alpine
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app

# Install first using only package.json files (pruned) — this layer is
# cached as long as no dependency actually changed, regardless of source edits
COPY --from=pruner /app/out/json/ .
RUN npm install

# Now bring in the real source and build
COPY --from=pruner /app/out/full/ .
RUN cd apps/backend && npx prisma generate
RUN npx turbo run build --filter=@my-wapp-store/backend

# ── 3. Minimal runtime image ───────────────────────────────────────────────
FROM base AS runner
RUN apk add --no-cache openssl
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nestjs

COPY --from=installer --chown=nestjs:nodejs /app .

USER nestjs
EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

# Entrypoint: waits for DB, runs migrations, then starts the app.
# Set SKIP_MIGRATE=1 or SKIP_DB_WAIT=1 to bypass individual steps
# (e.g. in a separate migration job in a CD pipeline).
COPY --from=installer --chown=nestjs:nodejs /app/apps/backend/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "apps/backend/dist/main.js"]
