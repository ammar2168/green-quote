# syntax=docker/dockerfile:1

# Targets: `runner` (default) is the app server; `tools` runs migrations and
# scripts against the database.

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

FROM deps AS tools
COPY . .
CMD ["pnpm", "db:migrate"]

FROM deps AS builder
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 \
  NEXT_OUTPUT_STANDALONE=1
# Placeholders: route modules throw at load without these. Real values come at runtime.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
  SESSION_SECRET=build-time-placeholder \
  pnpm build

FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0
RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# The project has no public/ directory. If one is added, copy it here too
# (`/app/public ./public`): the standalone output leaves it out.
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server.js"]
