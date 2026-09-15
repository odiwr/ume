# Ume

**A 24/7 Discord music bot that never leaves the room, with a shared library your server curates on the web.**

Ume sits in one voice channel around the clock: it follows when it is moved, pauses when nobody is listening and resumes when someone comes back. Members build flat **playlists** on the web from two kinds of music: files they drag in (normalized to Opus by the worker) and songs they **add from a link** (YouTube, SoundCloud, Bandcamp, Audius, Mixcloud, Vimeo, the Internet Archive, or a direct audio file), which the worker's link extractor fetches and normalizes the same way. Every track shows who added it. Access is governed by real permissions (Owner / Master / Servant / Peon, mapped from Discord roles or granted by invite), storage is sold in four flat tiers through Stripe, and idle free workspaces are cleaned up automatically after 60 days.

The product decisions, and the reasoning behind them, live in [`docs/PLAN_REVIEW.md`](docs/PLAN_REVIEW.md). Read it before changing behaviour. The link extractor is **on by default** by the founder's decision and ships with guardrails (rights attestation, hash-wide takedowns, a global kill switch, an off-datacenter extractor pattern). It is never described as a converter.

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/PLAN_REVIEW.md`](docs/PLAN_REVIEW.md) | The product decision record: what was kept, changed, added, and why. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Processes, data flows (claim, upload, link extraction, sweep, purge), roles, invites, Stripe, job queues, security model. |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Production setup end to end: Discord, Google, Neon, R2, Stripe, Resend, Vercel, Railway/Fly, the residential extractor, DMCA, bot verification, go-live checklist. |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Runbooks: leaked token, stuck purge, lost access, link extraction failing, storage, Neon PITR, monitoring, cost, turning the extractor off. |
| [`packages/db/README.md`](packages/db/README.md) | Schema overview, the three ids of a server, migration workflow. |
| [`apps/web/README.md`](apps/web/README.md) | Route map for the web app and where the library code lives. |
| [`apps/bot/README.md`](apps/bot/README.md), [`apps/worker/README.md`](apps/worker/README.md) | Bot and worker internals, environment tables, Docker notes. |
| [`CLAUDE.md`](CLAUDE.md) | Conventions for anyone (human or AI) working in this repo. |

## Architecture

```mermaid
flowchart LR
  subgraph Discord
    G[(Guild / voice channel)]
    U1[Members]
  end

  subgraph Web["apps/web · Next.js 16 on Vercel"]
    UI[App Router UI]
    SA[Server Actions + Route Handlers]
    AUTH[Better Auth<br/>Discord + Google]
  end

  subgraph Bot["apps/bot · discord.js 14 (Railway / Fly)"]
    GW[Gateway + slash commands<br/>~ alias]
    VOICE[@discordjs/voice player<br/>streams stored Ogg/Opus]
  end

  subgraph Worker["apps/worker · pg-boss consumers (Railway / Fly + optional residential instance)"]
    TX[transcode-upload<br/>ffmpeg → 128 kbps Opus, loudnorm]
    LX[extract-link<br/>yt-dlp or Cobalt → same pipeline<br/>gated by link_extract]
    SWEEP[inactivity-sweep · expire-things<br/>reconcile-storage · purge-workspace]
    MAIL[send-email]
  end

  PG[(Postgres on Neon<br/>app tables + pgboss schema)]
  R2[(Cloudflare R2<br/>ws/&lt;id&gt;/tracks/*.opus)]
  STRIPE[Stripe]
  RESEND[Resend]
  SITES[YouTube · SoundCloud · Bandcamp<br/>Audius · Mixcloud · Vimeo · archive.org]

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
  LX -- fetch audio --> SITES
  LX --> R2
  SWEEP -- DM / channel notices (REST) --> Discord
  MAIL --> RESEND
  SA <--> STRIPE
  STRIPE -- webhook --> SA
```

Three long-lived processes share one Postgres database and one object store. There is no Redis and no inter-process HTTP; the processes coordinate through rows and pg-boss jobs.

- **Web** (`apps/web`): marketing pages, sign-in, the `/app/<umeId>` dashboard, the `/ceo` console, Stripe, the DMCA form, and every privileged mutation. Authorization is checked server-side on every server action and route handler.
- **Bot** (`apps/bot`): one gateway connection and one voice connection per claimed server. It issues claim tokens (`/reload`), enforces confirmation codes for `/reset` and `/purge`, records "add from link" entries, and streams pre-encoded Opus with zero transcoding.
- **Worker** (`apps/worker`): pg-boss consumers for transcoding, link extraction (behind the `link_extract` flag, the workspace switch and the Owner's rights attestation), inactivity notices and purges, storage reconciliation, and email. A second worker instance can consume only `extract-link` from a residential connection.

Shared packages carry the contracts: roles and capabilities, token generation and hashing, the command list, plans, link parsing, job names and payloads, the Drizzle schema and queries, the storage key layout, and email templates.

## Monorepo map

```
ume/
├── apps/
│   ├── web/          Next.js 16 App Router: (marketing), (auth), (app) dashboard, (ceo) console, api/ routes
│   ├── bot/          discord.js 14 + @discordjs/voice 0.19 (tsx in dev, tsup → dist/ in prod, Dockerfile)
│   └── worker/       pg-boss job runner: ffmpeg, yt-dlp or Cobalt, sweeps, purge, email (Dockerfile)
├── packages/
│   ├── shared/       @ume/shared — constants, ids, roles/caps, tokens, discord helpers, link parser, plans, zod schemas, commands, jobs
│   ├── db/           @ume/db — Drizzle schema, relations, migrations (drizzle/), query helpers (getAccess, claimToken, logAudit, flags, …)
│   ├── storage/      @ume/storage — S3/R2 client, presigned URLs, key layout under ws/<workspaceId>/
│   └── email/        @ume/email — Resend sender (dry-run without a key) + templates
├── docs/             PLAN_REVIEW, ARCHITECTURE, DEPLOY, OPERATIONS
├── .github/          CI: typecheck, build, Docker image builds (no push)
├── .env.example      Every environment variable, documented
├── .nvmrc            Node 22
├── pnpm-workspace.yaml, turbo.json, tsconfig.base.json, .prettierrc, .editorconfig
└── package.json      Root scripts (dev:*, build, typecheck, db:*, format); packageManager pnpm@12
```

## Quickstart (local development on a Mac)

Requirements: Node 22 (`.nvmrc`), pnpm 12, a Postgres you can reach, `ffmpeg` (with libopus) for the worker, `yt-dlp` if you want link extraction locally. No Docker needed.

```bash
# 1. Toolchain
nvm use                                  # reads .nvmrc → Node 22 (or: brew install node@22)
corepack enable && corepack prepare pnpm@12.4.1 --activate   # matches "packageManager" in package.json
brew install ffmpeg yt-dlp               # worker only; yt-dlp only matters for link extraction

# 2. Environment
git clone https://github.com/odiwr/ume.git && cd ume
cp .env.example .env                     # one file at the repo root; all three apps read it
#   fill in DISCORD_* (docs/DEPLOY.md §1), BETTER_AUTH_SECRET (openssl rand -base64 32),
#   DATABASE_URL, and S3_* if you want uploads to work

# 3. Postgres — pick one
#   a) Neon (free tier): create a project, paste the pooled URL into DATABASE_URL and the direct URL into DATABASE_URL_DIRECT
#   b) local: brew install postgresql@17 && brew services start postgresql@17 && createdb ume
#      DATABASE_URL=postgres://$USER@localhost:5432/ume

# 4. Install
pnpm install

# 5. Schema
pnpm db:push                             # local dev: sync the schema straight from src/schema
#   or, for a shared/production database:
#   pnpm db:generate && DATABASE_URL="$DATABASE_URL_DIRECT" pnpm db:migrate

# 6. Run the three processes (three terminals)
pnpm dev:web                             # http://localhost:3000
pnpm --filter @ume/bot register          # register slash commands (instant when DISCORD_DEV_GUILD_ID is set)
pnpm dev:bot
pnpm dev:worker                          # logs a YouTube ToS warning at boot while link_extract is on; that is expected

# 7. Verify
pnpm typecheck
pnpm build
```

Sign in at `http://localhost:3000/login` with Discord. To claim a server you need a Discord application with the bot invited to a test server ([`docs/DEPLOY.md`](docs/DEPLOY.md), section 1); without one you can still build the UI against an empty database. Stripe and Resend are optional locally: emails print to stdout without `RESEND_API_KEY`, and the Billing page reports Stripe as unconfigured without `STRIPE_SECRET_KEY`.

### Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm typecheck` | `tsc --noEmit` in every package and app (Turborepo, cached). |
| `pnpm build` | `next build` for the web, `tsup` bundles for the bot and worker. |
| `pnpm dev` | All three apps under the Turborepo TUI (or use the `dev:*` scripts separately). |
| `pnpm --filter @ume/bot register` | PUT the slash command set generated from `COMMANDS` (idempotent). |
| `pnpm db:push` / `db:generate` / `db:migrate` / `db:studio` | Drizzle Kit against `DATABASE_URL` (see [`packages/db/README.md`](packages/db/README.md)). |
| `pnpm format` | Prettier over ts/tsx/md/json/yaml/css. |
| `cd apps/web && pnpm exec tsc --noEmit` | Typecheck one app directly. `pnpm --filter @ume/web lint` runs eslint. |

## Environment variables

Copy `.env.example` to `.env` at the repo root; all three apps read the same file (`next.config.ts` loads it with dotenv, the bot and worker scripts pass `--env-file`). Production values live in each host's secret store, never in git.

| Variable | Used by | Where to get it |
| --- | --- | --- |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | web, bot, worker | Your public web origin, no trailing slash (`http://localhost:3000` locally, `https://ume.app` in production). The bot and worker build dashboard links from it. |
| `DATABASE_URL` | web (and bot/worker/migrations fallback) | Neon **pooled** connection string, or your local Postgres URL. The pg-boss queue lives in the same database. |
| `DATABASE_URL_DIRECT` | bot, worker, migrations | Neon **direct** (non-pooled) connection string. `directDatabaseUrl()` falls back to `DATABASE_URL` when unset. Optional locally. |
| `BETTER_AUTH_SECRET` | web | `openssl rand -base64 32`. Rotating it signs everyone out. |
| `BETTER_AUTH_URL` | web | Same as `APP_URL`. |
| `DISCORD_CLIENT_ID`, `NEXT_PUBLIC_DISCORD_CLIENT_ID` | web, bot | Discord Developer Portal → your application → General Information → Application ID. The public one builds the "Add to Discord" URL. |
| `DISCORD_CLIENT_SECRET` | web | Developer Portal → OAuth2 → Client Secret ("Sign in with Discord"). |
| `DISCORD_BOT_TOKEN` | bot, worker, web | Developer Portal → Bot → Reset Token. Shown once; treat like a password. The bot uses it for the gateway; the worker for DM and channel notices over REST; the web for server-side guild, role, channel and member lookups (claiming, role mapping, invite guild checks, Settings channel pickers). |
| `DISCORD_MESSAGE_CONTENT_INTENT` | bot | `false` unless you enabled the privileged Message Content intent in the portal. Only affects `~` commands in server channels; slash commands and DMs never need it. |
| `DISCORD_DEV_GUILD_ID` | bot (`register`) | Right-click your test server → Copy Server ID (Developer Mode). Registers commands to one guild instantly instead of the global rollout (up to an hour). |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | web | Google Cloud Console → APIs & Services → Credentials → OAuth client (Web application). |
| `CEO_EMAILS` | web | Comma-separated Google account emails allowed into `/ceo`. Nobody else can open it. |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | web, bot, worker | Cloudflare R2 → bucket + API token. Endpoint `https://<accountid>.r2.cloudflarestorage.com`, region `auto`. Any S3-compatible store works. |
| `S3_PUBLIC_BASE_URL` | web, worker | Optional public origin for cover images (R2 custom domain or `r2.dev` subdomain). Audio is never public. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | web | Stripe Dashboard → Developers → API keys / Webhooks. Use test keys locally with `stripe listen`. |
| `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO` | web | Stripe → Product catalog → the `price_…` id of each monthly price (plans in `packages/shared/src/plans.ts`). |
| `RESEND_API_KEY`, `EMAIL_FROM` | web, bot, worker | Resend → API Keys, after verifying the sending domain. Without a key, emails are printed to stdout. |
| `CRON_SECRET` | web | Reserved for `/api/cron/*` (Vercel Cron sends `Authorization: Bearer …`). The worker schedules every sweep itself through pg-boss; no cron route ships today. |
| `FFMPEG_PATH` | worker | Path to `ffmpeg` built with libopus (`ffmpeg` on PATH by default). `ffprobe` is expected next to it; `FFPROBE_PATH` overrides. |
| `WORKER_QUEUES` | worker | Comma list of queues this instance consumes; empty = all. Set `extract-link` on a second worker running from a residential connection. |
| `EXTRACTOR_PROVIDER` | worker | `ytdlp` (local binary, default) or `cobalt` (self-hosted Cobalt API). |
| `YTDLP_PATH`, `YTDLP_COOKIES`, `YTDLP_EXTRA_ARGS` | worker | Binary path, optional Netscape cookies file from a logged-in browser session, extra argv appended before the URL (for example `--extractor-args` or a PO-token provider). |
| `COBALT_API_URL`, `COBALT_API_KEY` | worker | Base URL of your Cobalt instance and its API key (sent as `Authorization: Api-Key …`). |
| `LOG_LEVEL` | bot, worker | pino level (`info`, `debug`, …). |
| `NEXT_PUBLIC_DISCORD_SUPPORT_INVITE`, `NEXT_PUBLIC_GITHUB_URL` | web, bot | Public footer links; the bot shows the support invite in some error replies. Optional. |
| `DMCA_AGENT_NAME`, `DMCA_AGENT_EMAIL`, `DMCA_AGENT_ADDRESS` | web | Must match your registration in the U.S. Copyright Office DMCA agent directory. Shown on `/dmca`. |

Read by code but not listed in `.env.example`: `FFPROBE_PATH` (worker, see above) and `DB_POOL_MODE=serverless` (`@ume/db`, shrinks the pool to 3 connections outside Vercel).

## Contributing

- Product behaviour is decided in `docs/PLAN_REVIEW.md`; change the document before changing the behaviour.
- Conventions for code, authorization and Next.js 16 gotchas are in [`CLAUDE.md`](CLAUDE.md). Prettier: no semicolons, single quotes, width 100.
- CI runs `pnpm typecheck`, `pnpm build` (with placeholder env) and builds both Docker images without pushing, on every push to `main` and every pull request.
- Never commit `.env`. `.env.example` is the only env file in git.
- The user-facing word for a collection of tracks is "playlist". The link feature is "add a song from a link", never a converter.

## License

MIT, copyright Bill Odiwuor Kawaka 2026. See [`LICENSE`](LICENSE).
