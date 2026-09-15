# Ume

**A 24/7 Discord music bot that never leaves the room, with a shared library your server curates on the web.**

Ume sits in one voice channel around the clock (it follows when moved and auto-pauses when nobody is listening). Server members build flat "playlists" of music on [ume.app](https://ume.app): drag-and-drop uploads that are normalized to Opus, plus YouTube links kept as metadata-only entries. Every track shows who added it. Access is governed by real permissions (Owner / Master / Servant / Peon, mapped from Discord roles or granted by invite), storage is sold in four flat tiers, and idle free workspaces are cleaned up automatically.

The product decisions, and the reasoning behind them, live in [`docs/PLAN_REVIEW.md`](docs/PLAN_REVIEW.md). Read it before changing behaviour.

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/PLAN_REVIEW.md`](docs/PLAN_REVIEW.md) | The product decision record: what was kept, changed, added, and why. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Processes, data flows, job queues, security model. |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Step-by-step production setup: Discord, Google, Neon, R2, Stripe, Resend, Vercel, Railway/Fly, DMCA, bot verification. |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Runbooks for incidents, restores, monitoring and cost. |
| [`packages/db/README.md`](packages/db/README.md) | Schema overview and the migration workflow. |
| [`apps/web/README.md`](apps/web/README.md) | Route map for the web app. |
| `apps/bot/README.md`, `apps/worker/README.md` | Bot and worker internals (written alongside their code). |
| [`CLAUDE.md`](CLAUDE.md) | Conventions for anyone (human or AI) working in this repo. |

## Architecture

```mermaid
flowchart LR
  subgraph Discord
    G[(Guild / voice channel)]
    U1[Members]
  end

  subgraph Web["apps/web — Next.js 16 on Vercel"]
    UI[App Router UI]
    SA[Server Actions + Route Handlers]
    AUTH[Better Auth<br/>Discord + Google]
  end

  subgraph Bot["apps/bot — discord.js 14 (Railway / Fly)"]
    GW[Gateway + slash commands]
    VOICE[@discordjs/voice player<br/>streams stored Opus]
  end

  subgraph Worker["apps/worker — pg-boss (Railway / Fly)"]
    TX[transcode-upload<br/>ffmpeg → 128 kbps Opus]
    YT[ingest-youtube<br/>flag-gated]
    SWEEP[inactivity-sweep · expire-things<br/>reconcile-storage · purge-workspace]
    MAIL[send-email]
  end

  PG[(Postgres on Neon<br/>app tables + pg-boss queue)]
  R2[(Cloudflare R2<br/>ws/&lt;id&gt;/tracks/*.opus)]
  STRIPE[Stripe]
  RESEND[Resend]

  U1 -- browser --> UI
  UI --> SA --> PG
  AUTH --> PG
  SA -- presigned PUT --> R2
  SA -- enqueue --> PG
  U1 -- /play, /add, /reload --> GW
  GW --> PG
  VOICE -- GET object --> R2
  VOICE --> G
  PG -- jobs --> Worker
  TX <--> R2
  MAIL --> RESEND
  SA <--> STRIPE
  STRIPE -- webhook --> SA
```

Three long-lived processes share one Postgres and one object store:

- **Web** (`apps/web`): the dashboard, marketing pages, auth, Stripe, and every privileged mutation. Authorization is checked server-side on every server action and route handler.
- **Bot** (`apps/bot`): one gateway connection, one voice connection per claimed server. It issues claim tokens (`/reload`), enforces confirmation codes for `/reset` and `/purge`, and streams pre-encoded Opus with zero transcoding.
- **Worker** (`apps/worker`): pg-boss consumers for transcoding, YouTube ingest (behind the `youtube_ingest` flag), inactivity notices and purges, storage reconciliation, and email.

Shared packages carry the contracts: roles and capabilities, token generation and hashing, the command list, plans, job names and payloads, the Drizzle schema and queries, the storage key layout, and email templates.

## Monorepo map

```
ume/
├── apps/
│   ├── web/          Next.js 16 App Router (marketing, auth, /app dashboard, /ceo console, API routes)
│   ├── bot/          discord.js 14 + @discordjs/voice 0.19 (tsx in dev, tsup → dist/ in prod)
│   └── worker/       pg-boss job runner (ffmpeg, yt-dlp, sweeps, email)
├── packages/
│   ├── shared/       @ume/shared — constants, ids, roles/caps, tokens, discord helpers, plans, zod schemas, commands, jobs
│   ├── db/           @ume/db — Drizzle schema, relations, migrations, query helpers (getAccess, claimToken, logAudit, …)
│   ├── storage/      @ume/storage — S3/R2 client, presigned URLs, key layout
│   └── email/        @ume/email — Resend sender (dry-run without a key) + templates
├── docs/             PLAN_REVIEW, ARCHITECTURE, DEPLOY, OPERATIONS
├── .github/          CI (typecheck, build, Docker image builds)
├── .env.example      Every environment variable, documented
├── pnpm-workspace.yaml, turbo.json, tsconfig.base.json
└── package.json      Root scripts (dev:*, build, typecheck, db:*)
```

## Quickstart (local development on a Mac)

Requirements: Node 22 (see `.nvmrc`), pnpm 12, a Postgres you can reach, `ffmpeg` with libopus for the worker. No Docker needed.

```bash
# 1. Toolchain
nvm install && nvm use          # reads .nvmrc → Node 22
npm i -g pnpm                   # pnpm 12 (package.json pins the exact version via packageManager)

# 2. Clone and configure
git clone https://github.com/odiwr/ume.git && cd ume
cp .env.example .env            # fill in the values you have; everything degrades gracefully

# 3. Postgres — pick one
#    a) Neon free tier: create a project, paste the pooled URL into DATABASE_URL
#       and the direct URL into DATABASE_URL_DIRECT
#    b) Local:
brew install postgresql@17 && brew services start postgresql@17
createdb ume                    # DATABASE_URL=postgres://$USER@localhost:5432/ume

# 4. Worker tools (only needed to transcode uploads locally)
brew install ffmpeg             # includes libopus
brew install yt-dlp             # only used when the youtube_ingest flag is ON

# 5. Install and create the schema
pnpm install
pnpm db:push                    # dev: sync schema straight from the Drizzle definitions
#   prod / shared DBs: pnpm db:generate (write a migration) then pnpm db:migrate (apply)

# 6. Run the three processes (three terminals)
pnpm dev:web                    # http://localhost:3000
pnpm --filter @ume/bot register # register slash commands (instant if DISCORD_DEV_GUILD_ID is set)
pnpm dev:bot
pnpm dev:worker
```

Sign in at `http://localhost:3000/login` with Discord. To claim a server locally you need a Discord application with the bot invited to a test server (see [`docs/DEPLOY.md`](docs/DEPLOY.md), section 1); without one you can still build the UI against an empty database.

### Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` in every package and app (Turborepo, cached). |
| `pnpm build` | `next build` for the web, `tsup` for the bot and worker. |
| `pnpm dev` | All three apps under the Turborepo TUI (or use the `dev:*` scripts separately). |
| `pnpm db:push` / `db:generate` / `db:migrate` / `db:studio` | Drizzle Kit against `DATABASE_URL`. |
| `pnpm format` | Prettier over ts/tsx/md/json/yaml/css. |
| `cd apps/web && pnpm exec tsc --noEmit` | Typecheck one app directly. |

## Environment variables

Copy `.env.example` to `.env` at the repo root; all three apps read the same file (`next.config.ts` and the `--env-file` flags point at it). Production values live in each host's secret store, never in git.

| Variable | Used by | Where to get it |
| --- | --- | --- |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | web, bot, worker | Your public web origin, no trailing slash (`http://localhost:3000` locally, `https://ume.app` in production). |
| `DATABASE_URL` | web (and bot/worker fallback) | Neon **pooled** connection string, or your local Postgres URL. |
| `DATABASE_URL_DIRECT` | bot, worker, migrations | Neon **direct** (non-pooled) connection string. pg-boss and long-lived processes want a real session. Optional locally. |
| `BETTER_AUTH_SECRET` | web | `openssl rand -base64 32`. Rotating it signs everyone out. |
| `BETTER_AUTH_URL` | web | Same as `APP_URL`. |
| `DISCORD_CLIENT_ID`, `NEXT_PUBLIC_DISCORD_CLIENT_ID` | web, bot | Discord Developer Portal → your application → General Information → Application ID. |
| `DISCORD_CLIENT_SECRET` | web | Developer Portal → OAuth2 → Client Secret (used for "Sign in with Discord"). |
| `DISCORD_BOT_TOKEN` | bot | Developer Portal → Bot → Reset Token. Shown once. Treat like a password. |
| `DISCORD_MESSAGE_CONTENT_INTENT` | bot | `false` unless you enabled the privileged Message Content intent in the portal. Only affects `~` commands in server channels; slash commands and DMs never need it. |
| `DISCORD_DEV_GUILD_ID` | bot (`register`) | Right-click your test server → Copy Server ID (Developer Mode). Registers commands to one guild instantly instead of the ~1 h global rollout. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | web | Google Cloud Console → APIs & Services → Credentials → OAuth client (Web application). |
| `CEO_EMAILS` | web | Comma-separated Google account emails allowed into `/ceo`. Nobody else can open it. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | web, bot, worker | Cloudflare R2 → bucket + API token. Endpoint is `https://<accountid>.r2.cloudflarestorage.com`, region `auto`. Any S3-compatible store works. |
| `S3_PUBLIC_BASE_URL` | web | Optional public domain for cover images (R2 custom domain or `r2.dev` subdomain). |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | web | Stripe Dashboard → Developers → API keys / Webhooks. Use test keys locally with `stripe listen`. |
| `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO` | web | Stripe → Product catalog → the `price_…` id of each monthly price. |
| `RESEND_API_KEY`, `EMAIL_FROM` | web, worker | Resend → API Keys, after verifying your sending domain. Without a key, emails are printed to stdout. |
| `CRON_SECRET` | web | Any long random string. Vercel Cron sends it as `Authorization: Bearer …` to `/api/cron/*`. |
| `FFMPEG_PATH`, `YTDLP_PATH`, `YTDLP_COOKIES` | worker | Binary paths (`ffmpeg`, `yt-dlp` on PATH by default). Cookies file only matters when YouTube ingest is on and the worker runs from a datacenter IP. |
| `LOG_LEVEL` | bot, worker | pino level (`info`, `debug`, …). |
| `NEXT_PUBLIC_DISCORD_SUPPORT_INVITE`, `NEXT_PUBLIC_GITHUB_URL` | web | Public footer links. Optional. |
| `DMCA_AGENT_NAME`, `DMCA_AGENT_EMAIL`, `DMCA_AGENT_ADDRESS` | web | Must match your registration in the U.S. Copyright Office DMCA agent directory. Shown on `/dmca`. |

## Contributing

- Product behaviour is decided in `docs/PLAN_REVIEW.md`; change the document before changing the behaviour.
- Conventions for code, authorization and Next.js 16 gotchas are in [`CLAUDE.md`](CLAUDE.md).
- CI runs `pnpm typecheck`, `pnpm build`, and builds both Docker images on every push and pull request.
- Never commit `.env`. `.env.example` is the only env file in git.

## License

MIT, copyright Bill Odiwuor Kawaka 2026. See [`LICENSE`](LICENSE).
