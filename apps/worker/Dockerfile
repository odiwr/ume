# syntax=docker/dockerfile:1.7
# Ume worker — build from the REPO ROOT so workspace packages are in context:
#   docker build -f apps/worker/Dockerfile -t ume-worker .
# Railway / Fly: set the Dockerfile path to apps/worker/Dockerfile and the context to "/".

ARG PNPM_VERSION=12.4.1

# ---------- base: Node 22 + ffmpeg (libopus) + python3 + curl + yt-dlp ----------
FROM node:22-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 curl ca-certificates \
 && curl -fsSL https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp \
 && rm -rf /var/lib/apt/lists/*
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------- build: install every workspace dep and bundle ----------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile --filter @ume/worker...
RUN pnpm --filter @ume/worker build

# ---------- runtime: only the worker's own production deps ----------
# tsup inlines @ume/* (and their deps: drizzle-orm, postgres, @aws-sdk, resend), so the
# runtime image needs just pg-boss, pino, execa, file-type and music-metadata.
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/storage/package.json packages/storage/
COPY packages/email/package.json packages/email/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --prod --filter @ume/worker
COPY --from=build /app/apps/worker/dist ./apps/worker/dist

# WORKER_QUEUES (empty = all) and EXTRACTOR_PROVIDER (ytdlp | cobalt) are set per deployment.
ENV FFMPEG_PATH=ffmpeg \
    YTDLP_PATH=/usr/local/bin/yt-dlp \
    EXTRACTOR_PROVIDER=ytdlp \
    LOG_LEVEL=info
# yt-dlp updates itself into its own directory only if writable; keep it root-owned and let
# the image rebuild pick up new releases instead.
USER node
CMD ["node", "apps/worker/dist/index.js"]
