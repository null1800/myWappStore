# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────
# MyWAppStore — Frontend (Next.js) production image
#
# Build from the MONOREPO ROOT:
#   docker build -f apps/frontend/Dockerfile -t mywappstore-frontend \
#     --build-arg NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1 .
# (docker-compose.yml below already does this for you.)
#
# NEXT_PUBLIC_* vars are baked in at build time, not read at runtime — they
# must be passed as build args, not just environment variables on the
# container.
# ─────────────────────────────────────────────────────────────────────────

FROM node:22-alpine AS base

# ── 1. Prune the workspace down to just what the frontend needs ───────────
FROM base AS pruner
WORKDIR /app
RUN npm install -g turbo@^2
COPY . .
RUN turbo prune @my-wapp-store/frontend --docker

# ── 2. Install deps + build ────────────────────────────────────────────────
FROM base AS installer
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY --from=pruner /app/out/json/ .
RUN npm install

COPY --from=pruner /app/out/full/ .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
# Disable telemetry during the image build
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx turbo run build --filter=@my-wapp-store/frontend

# ── 3. Minimal runtime image ───────────────────────────────────────────────
# `output: "standalone"` in next.config.ts gives us a self-contained server
# bundle with a pruned node_modules — no need to copy the full install.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# NOTE: in a monorepo, Next.js mirrors the workspace path inside
# .next/standalone, so the server entrypoint ends up at
# apps/frontend/server.js rather than ./server.js. If `next build` ever
# changes this layout, `docker compose build frontend` will fail fast on
# a missing-file COPY — check `.next/standalone` to confirm the path.
COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=installer --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/frontend/server.js"]
