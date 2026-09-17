# Deploying Ume

For the latest verified configuration and remaining blockers, see [DEPLOY_STATUS.md](DEPLOY_STATUS.md). Run `pnpm deploy:check` before a production deployment; it reports missing configuration without printing secrets. Domains in the examples below must be replaced with the confirmed domain you own.

This is the full path from an empty account to a running product. Do the sections in order the first time; each one produces environment variables that later sections consume. The variable names match `.env.example` exactly.

Hosting shape (decided in [`PLAN_REVIEW.md`](PLAN_REVIEW.md)): web on **Vercel**, bot and worker on **Railway or Fly.io** (built remotely from the Dockerfiles in `apps/bot` and `apps/worker`, so no Docker on your Mac), Postgres on **Neon**, files on **Cloudflare R2**, payments on **Stripe**, email on **Resend**, and, because the link extractor is on by default, an optional second worker on a **residential connection**.

Contents

1. [Discord application and bot](#1-discord-application-and-bot)
2. [Google OAuth (CEO console)](#2-google-oauth-ceo-console)
3. [Postgres on Neon](#3-postgres-on-neon)
4. [Cloudflare R2](#4-cloudflare-r2)
5. [Stripe](#5-stripe)
6. [Resend](#6-resend)
7. [Web on Vercel](#7-web-on-vercel)
8. [Bot and worker on Railway or Fly.io](#8-bot-and-worker-on-railway-or-flyio)
9. [The residential extractor](#9-the-residential-extractor)
10. [DMCA agent registration](#10-dmca-agent-registration)
11. [Discord bot verification (100 servers)](#11-discord-bot-verification-100-servers)
12. [Go-live checklist](#12-go-live-checklist)

---

## 1. Discord application and bot

### 1.1 Create the application under a Team

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and turn on two-factor authentication on your Discord account first (Settings → My Account). Verification and privileged intents are refused without it.
2. **Teams → New Team**. Name it (for example "Ume"). Every team member must also have 2FA.
3. **Applications → New Application**. Name it `Ume`, and pick the team as the owner (or transfer it later under General Information → App Team). Team ownership is a hard requirement for bot verification, so do it now rather than at 100 servers.
4. **General Information**: upload `apps/web/public/brand/ume-artwork.png` as the icon, write a one-line description, and fill in **Terms of Service URL** `https://ume.app/terms` and **Privacy Policy URL** `https://ume.app/privacy` (both pages ship with the web app).
5. Copy the **Application ID** → `DISCORD_CLIENT_ID` and `NEXT_PUBLIC_DISCORD_CLIENT_ID`.

### 1.2 Bot token and intents

1. **Bot** tab → **Reset Token** → copy it once → `DISCORD_BOT_TOKEN`. It is never shown again. If it leaks, see the runbook in [`OPERATIONS.md`](OPERATIONS.md#rotate-a-leaked-bot-token). The bot needs it for the gateway; the worker needs it too, for DM and channel notices over the REST API.
2. Turn **Public Bot** on (anyone can install it) and **Requires OAuth2 Code Grant** off.
3. **Privileged Gateway Intents: none are required.** The bot subscribes to `Guilds`, `GuildVoiceStates`, `GuildMessages` and `DirectMessages`, all unprivileged. Slash commands, voice presence, `~` commands in DMs and every notice work without a privileged intent.
   - Turn **Message Content Intent** on only if you want `~` prefix commands to work inside server text channels (they always work in DMs). Then set `DISCORD_MESSAGE_CONTENT_INTENT=true` for the bot. An application below 10,000 reachable users can simply toggle the intent on; above that, Discord reviews the request and expects a justification, and prefix bots are pushed toward slash commands. The recommended default is to leave it off.

### 1.3 OAuth2 (Sign in with Discord)

1. **OAuth2** tab → copy the **Client Secret** → `DISCORD_CLIENT_SECRET`.
2. **Redirects** → add `<APP_URL>/api/auth/callback/discord` for every environment you run, for example:
   - `http://localhost:3000/api/auth/callback/discord`
   - `https://ume.app/api/auth/callback/discord`
   - one per Vercel preview domain you care about (or skip Discord sign-in on previews)
3. Scopes are requested by the app (`identify email guilds`, configured in `apps/web/src/lib/auth.ts`); nothing to set here.

### 1.4 Install settings (adding the bot to servers)

**Installation** tab:

- **Installation Contexts**: Guild Install only (Ume has no user-install mode).
- **Install Link**: Discord Provided Link, or leave it unset and use the URL the web app generates.
- **Default Install Settings → Guild Install**:
  - Scopes: `bot`, `applications.commands`
  - Permissions: **View Channels, Send Messages, Embed Links, Read Message History, Connect, Speak, Use Application Commands**

`botInviteUrl(clientId, guildId?)` in `@ume/shared` encodes exactly these scopes and permissions (permissions integer `2150714368`), so the "Add to Discord" buttons on the site never drift from this list. Do not grant Administrator: the bot does not need it and reviewers flag it. The optional "Now playing" voice channel status line additionally needs _Set Voice Channel Status_ in the home channel and is skipped silently without it.

### 1.5 Register slash commands

Slash commands are generated from `COMMANDS` in `packages/shared/src/commands.ts`. Register them after every change to that file:

```bash
# local: instant registration to one test server
DISCORD_DEV_GUILD_ID=<your test server id> pnpm --filter @ume/bot register

# production: global registration (propagates within about an hour)
pnpm --filter @ume/bot register
```

The script reads `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID` from the root `.env`. When `DISCORD_DEV_GUILD_ID` is set it registers guild commands (instant, only visible in that server); when unset it registers global commands. `PUT` replaces the whole set, so it is idempotent. Privileged commands (`/reload`, `/reset`, `/purge`) are registered with `default_member_permissions: ManageGuild` so non-admins do not see them, and the bot re-checks owner/Administrator on every invocation anyway. `playlist` and `query` options offer autocomplete.

To get a server id: Discord → User Settings → Advanced → Developer Mode, then right-click the server → Copy Server ID.

---

## 2. Google OAuth (CEO console)

Google sign-in is the only way into `/ceo`, and an optional sign-in for everyone else.

1. [Google Cloud Console](https://console.cloud.google.com/) → create a project (for example `ume-prod`).
2. **Google Auth Platform → Branding** (the OAuth consent screen): User type **External**, app name `Ume`, support email, the logo, authorized domain `ume.app`, links to `https://ume.app/privacy` and `https://ume.app/terms`. Scopes: `openid`, `email`, `profile` (non-sensitive; no verification needed). Publish the app so that accounts outside your test users can sign in. While it is in "Testing", add your CEO email as a test user.
3. **Clients → Create client** → **Web application**:
   - Authorized JavaScript origins: `http://localhost:3000`, `https://ume.app`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`, `https://ume.app/api/auth/callback/google`
4. Copy the client id and secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
5. Set `CEO_EMAILS` to the comma-separated Google addresses allowed into the console. `requireCeo()` additionally requires a Google-provider account row and a verified email, so a Discord account with the same email cannot get in.

---

## 3. Postgres on Neon

One database serves the app tables and the pg-boss job queue (no Redis).

1. [Neon](https://neon.tech) → New project. Region: **US East (N. Virginia)** to sit next to Vercel's `iad1` and the bot's region. Postgres 17.
2. On the project dashboard → **Connect** → copy two connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`. Used by the web app on Vercel, where many short-lived functions each open a connection. `@ume/db` sets `prepare: false` so prepared statements work through PgBouncer.
   - **Direct** (no `-pooler`) → `DATABASE_URL_DIRECT`. Used by the bot, the worker, the web app's pg-boss producer, and migrations. pg-boss and Drizzle's migrator want a real session (advisory locks, long transactions), which transaction pooling breaks. `directDatabaseUrl()` in `@ume/shared` falls back to `DATABASE_URL` when the direct one is unset.
   - Append `?sslmode=require` if your copied string lacks it.
3. Apply the schema. Migrations live in `packages/db/drizzle/` and are committed to git. If that folder is still empty (fresh checkout of a repo that has only been `db:push`ed), generate the first migration before deploying: `pnpm db:generate`, review the SQL, commit it.

   ```bash
   # from the repo root, with DATABASE_URL pointing at the DIRECT string
   DATABASE_URL="$DATABASE_URL_DIRECT" pnpm db:migrate
   ```

   `pnpm db:push` is for local development only; it bypasses migration files. The full workflow is in [`packages/db/README.md`](../packages/db/README.md). The `pgboss` schema is created by the worker on its first start; it is not part of Drizzle's snapshot.

4. Turn on **Point-in-time restore** (Settings → Storage → History retention; 7 days on the free tier, more on paid). It is the backup strategy; see [`OPERATIONS.md`](OPERATIONS.md#restore-from-neon-point-in-time-recovery).
5. Optional but recommended for production: create a branch called `staging` for Vercel preview deployments and point preview env vars at it, so previews never touch production rows.

---

## 4. Cloudflare R2

R2 has zero egress fees, which matters for a bot that streams audio all day.

1. Cloudflare dashboard → **R2 Object Storage → Create bucket**. Name `ume` (→ `S3_BUCKET`), location hint **North America East**. Keep it private.
2. **Manage R2 API Tokens → Create API token**: permission **Object Read & Write**, scoped to the `ume` bucket only, no TTL. Copy the **Access Key ID** and **Secret Access Key** → `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. The page also shows the S3 endpoint `https://<accountid>.r2.cloudflarestorage.com` → `S3_ENDPOINT`. Set `S3_REGION=auto`.
3. **CORS.** Browsers upload straight to R2 with a presigned `PUT`; the web server never sees the bytes. That only works if the bucket allows the browser origin. Bucket → **Settings → CORS policy → Edit** and paste:

   ```json
   [
     {
       "AllowedOrigins": ["https://ume.app", "http://localhost:3000"],
       "AllowedMethods": ["PUT", "GET", "HEAD"],
       "AllowedHeaders": ["Content-Type", "Content-Length", "x-amz-meta-*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   Add your Vercel preview origin(s) if you test uploads on previews. `Content-Type` must be in `AllowedHeaders` because the presigned URL is signed for the specific content type and length the browser announced (`presignUpload(key, contentType, contentLength)`), and the browser sends that header. Without this rule uploads fail with an opaque CORS error in the console and nothing in server logs.

4. **Public covers (optional).** Track and playlist covers can be served without presigning. Bucket → **Settings → Public access**: either enable the `r2.dev` subdomain (rate-limited, fine for launch) or connect a custom domain such as `cdn.ume.app`. Put the resulting origin in `S3_PUBLIC_BASE_URL`. Audio is never public; the bot fetches it with credentials and the web app hands out short-lived presigned download URLs.
5. **Lifecycle rules (recommended).** Bucket → Settings → Object lifecycle rules: prefix `ws/`, **abort incomplete multipart uploads** after 1 day. Originals under `uploads/` are deleted by the worker after a successful transcode, and the daily `reconcile-storage` job removes uploads that never finished (pending for 24 h) and fails transcodes stuck for 6 h, so no expiry rule is needed for them.

Key layout, for reference (`packages/storage/src/keys.ts`): `ws/<workspaceId>/uploads/<trackId>/<file>` (original, temporary), `ws/<workspaceId>/tracks/<trackId>.opus`, `ws/<workspaceId>/covers/<trackId>.jpg`, `ws/<workspaceId>/playlists/<playlistId>.jpg`. A purge is one prefix delete.

---

## 5. Stripe

Plans are defined once in `packages/shared/src/plans.ts` (Plus $4 / 10 GB, Pro $12 / 50 GB, Studio $35 / 250 GB, monthly, per workspace). Stripe only needs matching prices.

1. Stripe Dashboard (start in **test mode**) → **Product catalog → Add product**, three times:
   | Product                                                                                                                                                                                                                                    | Price      | Billing            |
   | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | ------------------ |
   | Ume Plus                                                                                                                                                                                                                                   | $4.00 USD  | Recurring, monthly |
   | Ume Pro                                                                                                                                                                                                                                    | $12.00 USD | Recurring, monthly |
   | Ume Studio                                                                                                                                                                                                                                 | $35.00 USD | Recurring, monthly |
   | Copy each price id (`price_…`) → `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO`. The webhook maps a subscription back to a plan by comparing its price id with these three variables, so they must be set on the web host. |
2. **Developers → API keys** → Secret key → `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**: URL `<APP_URL>/api/stripe/webhook`, events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.paused`
   - `customer.subscription.resumed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

   Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`. The handler verifies the signature, records every event id in `stripe_events` before acting (so Stripe's retries are idempotent), and retrieves the subscription fresh rather than trusting the payload.

4. **Settings → Billing → Customer portal**: turn it on, allow customers to **update payment methods**, **cancel subscriptions**, and **switch plans** between the three prices. Set the business name and the link back to `https://ume.app`. The dashboard's "Manage billing" button opens this portal, and existing subscribers change plans through it (deep-linked into the plan-change confirmation).
5. **Settings → Billing → Subscriptions and emails**: enable failed-payment emails and Smart Retries. `past_due` keeps the paid plan; when a subscription is deleted the webhook downgrades the workspace to Free. Over-quota workspaces become read-only for uploads and extractions and are never purged for being over quota.
6. Local development:

   ```bash
   brew install stripe/stripe-cli/stripe && stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   # prints a whsec_… for your .env; test card: 4242 4242 4242 4242
   ```

7. Going live: repeat steps 1–4 in **live mode** (products, prices, keys and webhook secrets are all separate), set the live values on Vercel, and activate the account (business details, bank account, tax settings).

---

## 6. Resend

Transactional email only: invites, inactivity notices, purge confirmations, token-rotation alerts, quota warnings. Without `RESEND_API_KEY` the sender prints the message to stdout, which is what you want locally. In production (`NODE_ENV=production`) a missing key makes every send fail with `email_not_configured`: invites show "Email is not configured", the worker `send-email` job retries and logs, and nothing is recorded as sent.

1. [Resend](https://resend.com) → **Domains → Add domain** → `ume.app` (or a subdomain such as `mail.ume.app` to keep your root domain's reputation separate). Region: US East.
2. Add the DNS records Resend shows, at your DNS provider (Cloudflare if the domain is there):
   - **DKIM**: one TXT at `resend._domainkey` (the long `p=…` key).
   - **SPF**: an MX and a TXT on the sending subdomain Resend names (typically `send.ume.app`), value like `v=spf1 include:amazonses.com ~all`.
   - **DMARC**: TXT at `_dmarc.ume.app`, start with `v=DMARC1; p=none; rua=mailto:dmarc@ume.app` and tighten to `p=quarantine` once reports look clean.
     Wait for the domain to show **Verified**.
3. **API Keys → Create** with **Sending access**, restricted to the domain → `RESEND_API_KEY`.
4. `EMAIL_FROM="Ume <no-reply@ume.app>"` (the address must be on the verified domain).
5. Send yourself an invite from a test workspace and check it lands in the inbox, not spam.

Three processes send mail: the web (invites), the bot (token-rotation alert to the previous Owner) and the worker (everything else), so `RESEND_API_KEY` and `EMAIL_FROM` go on all three hosts.

---

## 7. Web on Vercel

1. Push the repo to GitHub. [Vercel](https://vercel.com) → **Add New → Project → Import** the repository.
2. Project settings:
   - **Root Directory**: `apps/web` (keep "Include source files outside of the Root Directory" on, the default; the build needs `packages/*`).
   - **Framework Preset**: Next.js (auto-detected).
   - **Install Command**: `pnpm install` — Vercel reads `packageManager` from the root `package.json` and runs the install at the workspace root.
   - **Build Command**: leave the default (`next build`); Turborepo is not needed for a single app.
   - **Node.js Version**: 22.x.
3. **Environment Variables** (Production and Preview separately). The web process needs:

   `APP_URL`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL` (pooled), `DATABASE_URL_DIRECT` (the pg-boss producer and any migration step use it), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DISCORD_CLIENT_ID`, `NEXT_PUBLIC_DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_BOT_TOKEN` (server-side Discord REST lookups: guild, roles, channels, member checks for invites), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CEO_EMAILS`, `S3_*`, `STRIPE_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_DISCORD_SUPPORT_INVITE`, `NEXT_PUBLIC_GITHUB_URL`, `DMCA_AGENT_*`.

   The web app does **not** need `FFMPEG_PATH`, `WORKER_QUEUES`, `EXTRACTOR_PROVIDER`, `YTDLP_*`, `COBALT_*` or `DISCORD_DEV_GUILD_ID`. For previews, point `DATABASE_URL` at a Neon branch and set `APP_URL`/`BETTER_AUTH_URL` to the preview domain, otherwise OAuth callbacks will not match.

4. **Domains**: add `ume.app` and `www.ume.app` (redirect www → apex). Update `APP_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` to `https://ume.app` and add the matching Discord and Google redirect URIs (sections 1.3 and 2).
5. **Runtime notes**:
   - `src/proxy.ts` (the Next.js 16 replacement for middleware) runs on the **Node runtime**, so it can import `better-auth/cookies` without Edge restrictions. It only checks for the presence of a session cookie; real authorization happens in server code on every request.
   - Server Actions have a 4 MB body limit (`next.config.ts`); audio never goes through them, it goes straight to R2 via `/api/upload/presign` and `/api/upload/complete`.
   - `postgres`, `pg-boss` and the AWS SDK are marked `serverExternalPackages` so they are not bundled.
   - `next/image` allows `cdn.discordapp.com`, `i.ytimg.com` and `lh3.googleusercontent.com`; add your `S3_PUBLIC_BASE_URL` host there if covers are public and rendered through `next/image`.
6. **Cron**: none needed. The worker schedules the sweeps itself through pg-boss. `CRON_SECRET` is reserved for `/api/cron/*` routes if you ever add them (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`); no such route ships today.
7. Deploy. Check `/`, `/login` (Discord round-trip), `/ceo/login` (Google round-trip with a `CEO_EMAILS` address), and the Stripe webhook's "Send test event" from the Stripe dashboard.

---

## 8. Bot and worker on Railway or Fly.io

Both apps ship a `Dockerfile` (`apps/bot/Dockerfile`, `apps/worker/Dockerfile`; see each app's README). The images are built **from the repository root** so that `pnpm` can see the workspace packages. The worker image installs `ffmpeg` (with libopus), `python3`, `curl` and the latest `yt-dlp` release; the bot image needs none of them. You do not need Docker locally; both platforms build remotely and CI builds the images on every push to catch regressions.

Run **exactly one instance** of the bot. Discord allows one gateway session per shard, and two bots with the same token fight over the voice connection. The cloud worker runs one instance too (pg-boss serializes jobs per queue; `transcode-upload` runs two at a time inside it); scale it only when transcodes queue up. A second worker for `extract-link` is covered in section 9.

Pick a region near Discord's voice infrastructure: **us-east** (Railway "US East (Virginia)", Fly `iad`). Neon in the same region keeps query latency low.

### Environment variables

| Process        | Variables                                                                                                                                                                                                                                                                                                                           |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bot            | `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_MESSAGE_CONTENT_INTENT`, `DATABASE_URL_DIRECT` (or `DATABASE_URL`), `APP_URL`, `S3_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `NEXT_PUBLIC_DISCORD_SUPPORT_INVITE` (optional), `LOG_LEVEL`                                                                                              |
| worker (cloud) | `DATABASE_URL_DIRECT` (or `DATABASE_URL`), `APP_URL`, `S3_*`, `S3_PUBLIC_BASE_URL` (if set), `DISCORD_BOT_TOKEN` (DM and channel notices), `RESEND_API_KEY`, `EMAIL_FROM`, `FFMPEG_PATH`, `EXTRACTOR_PROVIDER`, `YTDLP_PATH`, `YTDLP_COOKIES`, `YTDLP_EXTRA_ARGS`, `COBALT_API_URL`, `COBALT_API_KEY`, `WORKER_QUEUES`, `LOG_LEVEL` |

Neither needs Stripe, Google or Better Auth secrets. The Dockerfile already sets `FFMPEG_PATH=ffmpeg`, `YTDLP_PATH=/usr/local/bin/yt-dlp` and `EXTRACTOR_PROVIDER=ytdlp` for the worker image.

### Protecting the gateway IDENTIFY budget

Discord allows roughly 1,000 `IDENTIFY` calls per token per 24 hours. A crash loop that restarts instantly can exhaust that in minutes, after which Discord **resets the bot token** and every instance goes dark until you rotate it. Two defenses:

1. Limit restarts (Railway: "Restart policy: On failure, max 10 retries"; Fly: `[restart] policy = "on-failure"`, `retries = 10`). Both platforms back off between attempts.
2. The bot's Dockerfile runs `sh -c 'node apps/bot/dist/index.js; sleep 30'`, so a crashed container lingers 30 s before the platform restarts it. A healthy bot never hits the delay. If you override the Start Command, keep the sleep.

### Railway

1. [Railway](https://railway.app) → **New Project → Deploy from GitHub repo** → pick `ume`. Create **two services** from the same repo (Project → + New → GitHub Repo again for the second).
2. For each service, **Settings**:
   - **Source → Root Directory**: leave at `/` (repo root). **Dockerfile Path**: `apps/bot/Dockerfile` or `apps/worker/Dockerfile`.
   - **Source → Watch Paths**: `apps/bot/**`, `packages/**`, `pnpm-lock.yaml` (and the same for the worker) so a web-only commit does not redeploy the bot.
   - **Deploy → Region**: US East. **Replicas**: 1. **Restart Policy**: On Failure, 10 retries.
   - **Deploy → Healthcheck**: none (neither process has an HTTP server); Railway keeps the container running as long as the process is alive.
3. **Variables**: add the table above per service. Use Railway's **Shared Variables** for `S3_*`, `DATABASE_URL_DIRECT`, `APP_URL`, `RESEND_*`, `DISCORD_BOT_TOKEN` and reference them from both services.
4. Deploy. In the bot's logs you should see it log in and join each claimed server's home channel; in the worker's logs, `pg-boss started`, one `worker registered` line per queue, the cron lines, and the YouTube ToS warning (expected while `link_extract` is on).

### Fly.io

```bash
brew install flyctl && fly auth login

# bot
fly launch --no-deploy --name ume-bot --region iad --dockerfile apps/bot/Dockerfile --config apps/bot/fly.toml
# worker
fly launch --no-deploy --name ume-worker --region iad --dockerfile apps/worker/Dockerfile --config apps/worker/fly.toml
```

The repo does not ship `fly.toml` files; `fly launch` generates them next to each Dockerfile. Edit each one: remove the `[http_service]` block (no public ports), and add

```toml
[restart]
  policy = "on-failure"
  retries = 10

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"   # 1gb for the worker if transcodes or extractions OOM
```

Set secrets (`fly secrets set -a ume-bot DISCORD_BOT_TOKEN=… DATABASE_URL_DIRECT=… …`), then deploy from the repo root so the build context includes `packages/`:

```bash
fly deploy . --config apps/bot/fly.toml --dockerfile apps/bot/Dockerfile
fly deploy . --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile
fly scale count 1 -a ume-bot && fly scale count 1 -a ume-worker
```

Make sure `auto_stop_machines` is not enabled (it defaults to off when there is no `http_service`); the bot must stay up 24/7.

### After the first deploy

- Register slash commands globally if you have not: `pnpm --filter @ume/bot register` with production `DISCORD_*` values (from your Mac is fine).
- Invite the bot to a test server with the "Add to Discord" button on the site, run `/reload`, claim the token on the web, run `/home` in a voice channel, upload a file, `/add` a link, and `/play` both. That exercises web → R2 → worker → bot end to end, including the extractor.

---

## 9. The residential extractor

`yt-dlp` is routinely blocked from datacenter IP ranges ("Sign in to confirm you're not a bot", PO-token demands). The product ships link extraction **on by default**, so plan for this on day one rather than after the first wave of `failed` links. Two patterns; pick one (or start with the first and add the second if extraction keeps failing).

### Pattern A: a second worker at home

Run a second worker instance on a residential connection (a Mac mini, a NAS that runs Docker, a Raspberry Pi, or a small box with a home ISP) that consumes only the `extract-link` queue. Both instances point at the same database and bucket; pg-boss hands each queue to whichever instance consumes it.

```bash
# cloud worker (Railway / Fly): everything except link extraction
WORKER_QUEUES=transcode-upload,purge-workspace,inactivity-sweep,reconcile-storage,expire-things,send-email

# home worker: only link extraction
WORKER_QUEUES=extract-link
EXTRACTOR_PROVIDER=ytdlp
YTDLP_PATH=yt-dlp                       # brew install yt-dlp, or the Docker image's /usr/local/bin/yt-dlp
YTDLP_COOKIES=/path/to/cookies.txt      # optional: Netscape cookies exported from a logged-in browser (a throwaway account)
YTDLP_EXTRA_ARGS=                       # optional: e.g. --extractor-args "youtube:player_client=web" or a PO-token provider
DATABASE_URL_DIRECT=…                   # same Neon direct URL as the cloud worker
S3_*=…                                  # same bucket
DISCORD_BOT_TOKEN=                      # not needed on the extractor-only instance
RESEND_API_KEY=                         # not needed either
```

Running it:

- **With Docker (NAS, Linux box)**: build once from the repo root (`docker build -f apps/worker/Dockerfile -t ume-worker .`) or pull the image your CI/registry produces, then `docker run --restart unless-stopped --env-file worker.env -e WORKER_QUEUES=extract-link ume-worker`. Rebuild monthly so the bundled `yt-dlp` stays current; YouTube changes break old versions.
- **Without Docker (a Mac)**: `brew install ffmpeg yt-dlp`, clone the repo, `pnpm install`, `pnpm --filter @ume/worker build`, then run `node --env-file=/path/to/worker.env apps/worker/dist/index.js` under `launchd` (a `KeepAlive` LaunchAgent) or `pm2`. `brew upgrade yt-dlp` monthly.
- The extractor instance needs outbound HTTPS to the sites, Neon and R2, nothing inbound. Neon's direct URL works from anywhere with `sslmode=require`.
- Keep `DATABASE_URL_DIRECT` and `S3_*` on that box in a file with `chmod 600`; it holds production credentials.

`WORKER_QUEUES` must be set on the cloud worker too, otherwise both instances would consume `extract-link` and the cloud one would keep hitting the sign-in wall.

### Pattern B: one cloud worker plus a self-hosted Cobalt API

Keep a single cloud worker and point it at a [Cobalt](https://github.com/imputnet/cobalt) API instance that you host on a residential connection (or anywhere with an IP the sites tolerate). The worker then only downloads the file Cobalt tunnels back and fills in metadata from the site's oEmbed endpoint.

```bash
# cloud worker
EXTRACTOR_PROVIDER=cobalt
COBALT_API_URL=https://cobalt.example.net      # your instance's API base URL
COBALT_API_KEY=…                               # if you enabled API keys on the instance
```

Self-hosting Cobalt is a Docker Compose service (`ghcr.io/imputnet/cobalt`) behind a reverse proxy with TLS; follow its `docs/run-an-instance.md`. Set `API_URL` to the public base URL, turn on `API_KEY_URL` with a keys file so only your worker can use it (the worker sends `Authorization: Api-Key …`), and keep it updated (`watchtower` is the documented way). Cobalt has its own YouTube handling (including cookies and PO tokens through `COOKIE_PATH`); if it starts failing, its logs are where to look.

### Whichever pattern you choose

- The worker logs the YouTube Terms of Service warning at every boot while `link_extract` is on. That is deliberate; read [`PLAN_REVIEW.md`](PLAN_REVIEW.md#change) for the decision and its mitigations.
- A link that fails with "The site asked for a sign-in" is the signal that the datacenter IP is blocked: see [`OPERATIONS.md`](OPERATIONS.md#link-extraction-failing).
- If you cannot run either pattern yet, ship with the flag **off** (`/ceo/flags`): links become metadata-only entries and nothing else changes. Turn it on when the extractor has a home.

---

## 10. DMCA agent registration

Ume stores user-uploaded audio and audio fetched from links, so it needs the safe-harbor protections of 17 U.S.C. §512. That requires a **designated agent** registered with the U.S. Copyright Office, and the same details published on the site.

1. Go to the [DMCA Designated Agent Directory](https://dmca.copyright.gov/osp/) → create an account → **Register a service provider**. List `Ume` and every name and domain the service uses (`ume.app`).
2. Enter the agent's name, mailing address, phone and email. Use a role address such as `dmca@ume.app`, not a personal inbox, and make sure it is monitored.
3. Pay the **$6** fee. The registration is valid for **three years**; put a renewal reminder in your calendar, because an expired registration voids the safe harbor.
4. Set `DMCA_AGENT_NAME`, `DMCA_AGENT_EMAIL`, `DMCA_AGENT_ADDRESS` to exactly what you registered. The `/dmca` page shows them and hosts the takedown form; notices land in `dmca_notices` and are handled from the CEO console (`disabled` track status, `blocked_hashes`, repeat-infringer policy in the Terms). See the runbook in [`OPERATIONS.md`](OPERATIONS.md#dmca-takedown).

---

## 11. Discord bot verification (100 servers)

An unverified bot cannot join more than **100 servers**. Discord lets you apply once you reach 75. Everything below is much easier if it was done on day one (section 1):

- The application is owned by a **Team** whose members all have **2FA**.
- **Terms of Service** and **Privacy Policy** URLs are set on the application (`https://ume.app/terms`, `https://ume.app/privacy`) and the pages actually describe data handling (Discord ids, uploaded audio, audio fetched from links, emails, Stripe).
- A clear description of what the bot does and, in the application form, why each requested permission is needed. Ume needs no privileged intents unless you enabled Message Content, in which case justify it or turn it off before applying.
- Identity verification for the team owner (Discord uses Stripe Identity; have a government id ready).
- Apply from **App Verification** in the portal. Review typically takes days to a few weeks; the bot keeps working in existing servers meanwhile.

---

## 12. Go-live checklist

Infrastructure

- [ ] Neon production project in us-east, PITR on, first migration generated and committed, `pnpm db:migrate` applied, `DATABASE_URL` (pooled) and `DATABASE_URL_DIRECT` set in the right places.
- [ ] R2 bucket private, CORS rule includes `https://ume.app`, API token scoped to the bucket, `S3_PUBLIC_BASE_URL` set if covers are public.
- [ ] Vercel production domain `ume.app` live; `APP_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` all `https://ume.app`; `BETTER_AUTH_SECRET` is a fresh 32-byte value.
- [ ] Bot and cloud worker deployed in us-east, one replica each, restart limits set, logs clean for 10 minutes.
- [ ] Extractor decision made: residential worker (`WORKER_QUEUES=extract-link`) or Cobalt (`EXTRACTOR_PROVIDER=cobalt`) running, and the cloud worker's `WORKER_QUEUES` excludes `extract-link`; or the `link_extract` flag is off until it does.
- [ ] Slash commands registered globally; `/help` responds in a fresh server.

Identity and access

- [ ] Discord redirect `https://ume.app/api/auth/callback/discord` and Google redirect `https://ume.app/api/auth/callback/google` added.
- [ ] `CEO_EMAILS` contains only the accounts that should reach `/ceo`; a Discord-only account is refused.
- [ ] Feature flags reviewed in the CEO console: `link_extract` as decided above, `uploads_enabled` on, `signups_open` on, `auto_purge_enabled` on, `maintenance_banner` off.

Money and mail

- [ ] Stripe live products/prices created, live keys, `STRIPE_PRICE_*` and live webhook secret on Vercel, Customer Portal enabled, a real $4 test purchase upgrades a workspace and the portal downgrade returns it to Free.
- [ ] Resend domain verified (DKIM/SPF/DMARC), `EMAIL_FROM` on that domain, `RESEND_API_KEY` on web, bot and worker, an invite email delivered to a Gmail inbox.

Legal

- [ ] `/terms`, `/privacy`, `/dmca` published and linked from the footer and the Discord application; the Terms cover audio fetched from links and the rights attestation.
- [ ] DMCA agent registered at copyright.gov; `DMCA_AGENT_*` matches; `dmca@ume.app` is monitored.
- [ ] Discord application is Team-owned with 2FA (verification prerequisite).

Operations

- [ ] Error tracking and uptime alerts wired (see [`OPERATIONS.md`](OPERATIONS.md#monitoring)).
- [ ] Secrets stored only in Vercel / Railway / Fly / the extractor box and a password manager; `.env` is git-ignored and was never committed.
- [ ] Calendar reminders: DMCA agent renewal (3 years), `yt-dlp` / Cobalt update (monthly), Stripe/Resend/R2 billing reviews (monthly), Neon PITR window check.
