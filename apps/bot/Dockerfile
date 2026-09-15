# syntax=docker/dockerfile:1.7
# Ume bot — build from the REPO ROOT so workspace packages are in context:
#   docker build -f apps/bot/Dockerfile -t ume-bot .
# Railway / Fly: set the Dockerfile path to apps/bot/Dockerfile and the context to "/".
#
# The bot streams stored Ogg/Opus straight to Discord, so this image has no ffmpeg,
# no yt-dlp and no native Opus encoder. Node 22 provides the AES-GCM voice encryption.

ARG PNPM_VERSION=12.4.1

# ---------- base: Node 22 + pnpm ----------
FROM node:22-bookworm-slim AS base
ARG PNPM_VERSION
RUN npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# ---------- build: install every workspace dep and bundle ----------
FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps/bot ./apps/bot
RUN pnpm install --frozen-lockfile --filter @ume/bot...
RUN pnpm --filter @ume/bot build

# ---------- runtime: only the bot's own production deps ----------
# tsup inlines @ume/* (and their deps: drizzle-orm, postgres, @aws-sdk, resend), so the
# runtime image needs just discord.js, @discordjs/voice, pg-boss and pino.
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY packages/storage/package.json packages/storage/
COPY packages/email/package.json packages/email/
COPY apps/bot/package.json apps/bot/
RUN pnpm install --frozen-lockfile --prod --filter @ume/bot
COPY --from=build /app/apps/bot/dist ./apps/bot/dist

ENV LOG_LEVEL=info
USER node
# The trailing sleep keeps a crashing container alive for 30 s so a restart loop cannot
# burn through Discord's daily IDENTIFY budget (see docs/DEPLOY.md). A healthy bot never
# reaches it.
CMD ["sh", "-c", "node apps/bot/dist/index.js; sleep 30"]
