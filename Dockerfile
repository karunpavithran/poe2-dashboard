# syntax=docker/dockerfile:1
# Multi-stage build for the whole workspace. Debian (glibc) base, not Alpine:
# better-sqlite3 and esbuild/tsx ship linux-arm64 glibc prebuilds, so the image
# builds on a Raspberry Pi (or under buildx emulation) without a compiler.

FROM node:22-bookworm-slim AS build
WORKDIR /app

# Manifests first so the npm ci layer caches across source-only changes.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY server/package.json server/
COPY client/package.json client/
RUN --mount=type=cache,target=/root/.npm npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY server server
COPY client client
RUN npm run build -w client
# Runtime keeps only production deps (tsx is one: the server and the shared
# package run as TypeScript straight from source).
RUN npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    DB_PATH=/data/poe2-dashboard.db \
    CLIENT_DIST=/app/client/dist
WORKDIR /app

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json package.json
COPY --from=build /app/packages/shared packages/shared
COPY --from=build /app/server server
COPY --from=build /app/client/dist client/dist

# The SQLite volume mount point, writable by the unprivileged user.
RUN mkdir /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=60s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

WORKDIR /app/server
# Boot: seed atlas strategies if the table is empty (idempotent, includes
# migrations), then start the server (which migrates again — a no-op — and
# rehydrates the economy snapshot from the volume).
CMD ["sh", "-c", "node --import tsx/esm scripts/seed-atlas.ts && node --import tsx/esm src/index.ts"]
