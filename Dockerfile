# syntax=docker/dockerfile:1.7

# Production image for the VPS deployment. Vercel keeps using its own builder;
# `output: "standalone"` is only enabled when BUILD_TARGET=docker (see
# next.config.ts), so this image never changes how Vercel builds the app.

FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 \
    TZ=Asia/Jakarta
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates openssl tzdata \
 && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# Dependencies (dev + prod, needed to compile the app)
# ---------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
ENV NODE_ENV=production \
    BUILD_TARGET=docker

# `prisma generate` loads prisma.config.ts, which requires DATABASE_URL even
# though generation itself never connects. Runtime uses the real value.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, and
# next.config.ts reads S3_PUBLIC_URL to build the next/image allow-list.
# They are passed by the deploy workflow from GitHub Environment variables.
ARG NEXT_PUBLIC_APP_URL=""
ARG NEXT_PUBLIC_API_URL=""
ARG NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=""
ARG NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=""
ARG S3_PUBLIC_URL=""
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=${NEXT_PUBLIC_MIDTRANS_CLIENT_KEY} \
    NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION=${NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION} \
    S3_PUBLIC_URL=${S3_PUBLIC_URL}

RUN npm run build

# ---------------------------------------------------------------------------
# Runtime (Next.js standalone server)
# ---------------------------------------------------------------------------
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

# ---------------------------------------------------------------------------
# Migration image (one-shot `prisma migrate deploy`).
# Separate target so the runtime image stays small and the Prisma CLI is
# available only where migrations actually run.
# ---------------------------------------------------------------------------
FROM base AS migrate
WORKDIR /app
ENV NODE_ENV=production

# The migration image deliberately installs only the Prisma CLI + dotenv
# (which prisma.config.ts imports) instead of the whole application dependency
# tree. Versions are read from package-lock.json so they cannot drift from the
# client used by the app.
COPY package-lock.json ./
RUN PRISMA_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/prisma'].version")" \
 && DOTENV_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/dotenv'].version")" \
 && npm init -y >/dev/null \
 && npm install --no-audit --no-fund "prisma@${PRISMA_VERSION}" "dotenv@${DOTENV_VERSION}" \
 && npm cache clean --force >/dev/null 2>&1

COPY prisma.config.ts ./
COPY prisma ./prisma

CMD ["npx", "prisma", "migrate", "deploy"]
