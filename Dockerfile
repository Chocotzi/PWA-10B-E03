# syntax=docker/dockerfile:1
# Semana 10 · Tarea 1 (Cleber): imagen multi-etapa reproducible, sin privilegios y con sonda de salud.
# Fija Node 20 (acorde a .nvmrc y engines de package.json) sobre Debian Bookworm slim.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund

FROM node:20-bookworm-slim AS builder
WORKDIR /app
ARG APP_REVISION=local
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.mjs tsconfig.json ./
COPY scripts ./scripts
COPY public ./public
COPY src ./src
RUN npm run build && node scripts/write-release-meta.mjs --revision "$APP_REVISION"

FROM node:20-bookworm-slim AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ARG APP_REVISION=local
LABEL org.opencontainers.image.title="pwa-inspecciones-laboratorio" \
      org.opencontainers.image.description="PWA de inspecciones de laboratorio con datos sinteticos" \
      org.opencontainers.image.revision="${APP_REVISION}"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --chown=node:node package.json next.config.mjs ./
COPY --chown=node:node scripts/lib/import-ts.mjs ./scripts/lib/import-ts.mjs
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/public ./public
COPY --chown=node:node --from=builder /app/.next ./.next

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "node_modules/next/dist/bin/next", "start"]

