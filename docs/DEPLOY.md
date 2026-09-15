# Deploying Ume

This is the full path from an empty account to a running product. Do the sections in order the first time; each one produces environment variables that later sections consume. The variable names match `.env.example` exactly.

Hosting shape (decided in [`PLAN_REVIEW.md`](PLAN_REVIEW.md)): web on **Vercel**, bot and worker on **Railway or Fly.io** (built remotely from the Dockerfiles in `apps/bot` and `apps/worker`), Postgres on **Neon**, files on **Cloudflare R2**, payments on **Stripe**, email on **Resend**.

Contents

1. [Discord application and bot](#1-discord-application-and-bot)
2. [Google OAuth (CEO console)](#2-google-oauth-ceo-console)
3. [Postgres on Neon](#3-postgres-on-neon)
4. [Cloudflare R2](#4-cloudflare-r2)
5. [Stripe](#5-stripe)
6. [Resend](#6-resend)
7. [Web on Vercel](#7-web-on-vercel)
8. [Bot and worker on Railway or Fly.io](#8-bot-and-worker-on-railway-or-flyio)
9. [DMCA agent registration](#9-dmca-agent-registration)
10. [Discord bot verification (100 servers)](#10-discord-bot-verification-100-servers)
11. [Go-live checklist](#11-go-live-checklist)

---

## 1. Discord application and bot

### 1.1 Create the application under a Team

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and turn on two-factor authentication on your Discord account first (Settings → My Account). Verification and privileged intents are refused without it.
2. **Teams → New Team**. Name it (for example "Ume"). Every team member must also have 2FA.
3. **Applications → New Application**. Name it `Ume`, and pick the team as the owner (or transfer it later under General Information → App Team). Team ownership is a hard requirement for bot verification, so do it now rather than at 100 servers.
4. **General Information**: upload `apps/web/public/brand/ume-artwork.png` as the icon, write a one-line description, and fill in **Terms of Service URL** `https://ume.app/terms` and **Privacy Policy URL** `https://ume.app/privacy` (both pages ship with the web app).
5. Copy the **Application ID** → `DISCORD_CLIENT_ID` and `NEXT_PUBLIC_DISCORD_CLIENT_ID`.

### 1.2 Bot token and intents

1. **Bot** tab → **Reset Token** → copy it once → `DISCORD_BOT_TOKEN`. It is never shown again. If it leaks, see the runbook in [`OPERATIONS.md`](OPERATIONS.md#rotate-a-leaked-bot-token).
2. Turn **Public Bot** on (anyone can install it) and **Requires OAuth2 Code Grant** off.
3. **Privileged Gateway Intents: none are required.** Ume uses slash commands, guild membership from the gateway, and voice state updates, all of which are unprivileged.
   - Turn **Message Content Intent** on only if you want `~` prefix commands to work inside server text channels (they always work in DMs). Then set `DISCORD_MESSAGE_CONTENT_INTENT=true` for the bot. Under the rules in force since June 2026, an application below 10,000 reachable users can simply toggle the intent on; above that, Discord reviews the request and expects a justification, and prefix bots are pushed toward slash commands. The recommended default is to leave it off.

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

`botInviteUrl(clientId, guildId?)` in `@ume/shared` encodes exactly these scopes and permissions (permissions integer `2150714368`), so the "Add to Discord" buttons on the site never drift from this list. Do not grant Administrator: the bot does not need it and reviewers flag it.

### 1.5 Register slash commands

Slash commands are generated from `COMMANDS` in `packages/shared/src/commands.ts`. Register them after every change to that file:

```bash
# local: instant registration to one test server
DISCORD_DEV_GUILD_ID=<your test server id> pnpm --filter @ume/bot register

# production: global registration (propagates within about an hour)
pnpm --filter @ume/bot register
```

The script reads `DISCORD_BOT_TOKEN` and `DISCORD_CLIENT_ID` from the root `.env`. When `DISCORD_DEV_GUILD_ID` is set it registers guild commands (instant, only visible in that server); when unset it registers global commands. Privileged commands (`/reload`, `/reset`, `/purge`, `/home`) are registered with `default_member_permissions` so non-admins do not see them, and the bot re-checks owner/Administrator on every invocation anyway.

To get a server id: Discord → User Settings → Advanced → Developer Mode, then right-click the server → Copy Server ID.

---

## 2. Google OAuth (CEO console)

Google sign-in is the only way into `/ceo`, and an optional sign-in for everyone else.

1. [Google Cloud Console](https://console.cloud.google.com/) → create a project (for example `ume-prod`).
2. **APIs & Services → OAuth consent screen** (now under "Google Auth Platform → Branding"): User type **External**, app name `Ume`, support email, the logo, authorized domain `ume.app`, links to `https://ume.app/privacy` and `https://ume.app/terms`. Scopes: `openid`, `email`, `profile` (non-sensitive; no verification needed). Publish the app so that accounts outside your test users can sign in. While it is in "Testing", add your CEO email as a test user.
3. **Credentials → Create Credentials → OAuth client ID** → **Web application**:
   - Authorized JavaScript origins: `http://localhost:3000`, `https://ume.app`
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`, `https://ume.app/api/auth/callback/google`
4. Copy the client id and secret → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
5. Set `CEO_EMAILS` to the comma-separated Google addresses allowed into the console. `requireCeo()` additionally requires the session to have been created with the Google provider and the email to be verified, so a Discord account with the same email cannot get in.

---

## 3. Postgres on Neon

One database serves the app tables and the pg-boss job queue (no Redis).

1. [Neon](https://neon.tech) → New project. Region: **US East (N. Virginia)** to sit next to Vercel's `iad1` and the bot's region. Postgres 17.
2. On the project dashboard → **Connect** → copy two connection strings:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`. Used by the web app on Vercel, where many short-lived functions each open a connection. `@ume/db` sets `prepare: false` so prepared statements work through PgBouncer.
   - **Direct** (no `-pooler`) → `DATABASE_URL_DIRECT`. Used by the bot, the worker, and migrations. pg-boss and Drizzle's migrator want a real session (advisory locks, long transactions), which transaction pooling breaks. `directDatabaseUrl()` in `@ume/shared` falls back to `DATABASE_URL` when the direct one is unset.
   - Append `?sslmode=require` if your copied string lacks it.
3. Apply the schema. Migrations live in `packages/db/drizzle/` and are committed to git.

   ```bash
   # from the repo root, with DATABASE_URL pointing at the DIRECT string
   DATABASE_URL="$DATABASE_URL_DIRECT" pnpm db:migrate
   ```

   `pnpm db:push` is for local development only; it bypasses migration files. The full workflow is in [`packages/db/README.md`](../packages/db/README.md).
4. Turn on **Point-in-time restore** (Settings → Storage → History retention; 7 days on the free tier, more on paid). It is the backup strategy; see [`OPERATIONS.md`](OPERATIONS.md#restore-from-neon-point-in-time-recovery).
5. Optional but recommended for production: create a branch called `staging` for Vercel preview deployments and point preview env vars at it, so previews never touch production rows.

---

## 4. Cloudflare R2

R2 has zero egress fees, which matters for a bot that streams audio all day.

1. Cloudflare dashboard → **R2 Object Storage → Create bucket**. Name `ume` (→ `S3_BUCKET`), location hint **North America East**. Keep it private.
2. **Manage R2 API Tokens → Create API token**: permission **Object Read & Write**, scoped to the `ume` playlist only, no TTL. Copy the **Access Key ID** and **Secret Access Key** → `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. The page also shows the S3 endpoint `https://<accountid>.r2.cloudflarestorage.com` → `S3_ENDPOINT`. Set `S3_REGION=auto`.
3. **CORS.** Browsers upload straight to R2 with a presigned `PUT`; the web server never sees the bytes. That only works if the playlist allows the browser origin. Playlist → **Settings → CORS policy → Edit** and paste:

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

   Add your Vercel preview origin(s) if you test uploads on previews. `Content-Type` must be in `AllowedHeaders` because the presigned URL is signed for a specific content type and the browser sends it. Without this rule uploads fail with an opaque CORS error in the console and nothing in server logs.

4. **Public covers (optional).** Track and playlist covers can be served without presigning. Playlist → **Settings → Public access**: either enable the `r2.dev` subdomain (rate-limited, fine for launch) or connect a custom domain such as `cdn.ume.app`. Put the resulting origin in `S3_PUBLIC_BASE_URL`. Audio is never public; the bot fetches it with credentials and the web app hands out short-lived presigned download URLs.
5. **Lifecycle rules (recommended).** Playlist → Settings → Object lifecycle rules:
   - Prefix `ws/`, **abort incomplete multipart uploads** after 1 day.
   - A rule for objects whose key contains `/uploads/` expiring after 2 days is a safety net: originals are deleted by the worker after a successful transcode, and this cleans up after a worker that died mid-job. (R2 lifecycle rules match on prefix only, so this needs a per-workspace prefix or is skipped; the daily `reconcile-storage` job covers it either way.)

Key layout, for reference (`packages/storage/src/keys.ts`): `ws/<workspaceId>/uploads/<trackId>/<file>` (original, temporary), `ws/<workspaceId>/tracks/<trackId>.opus`, `ws/<workspaceId>/covers/<trackId>.jpg`, `ws/<workspaceId>/playlists/<playlistId>.jpg`. A purge is one prefix delete.

---

## 5. Stripe

Plans are defined once in `packages/shared/src/plans.ts` (Plus $4 / 10 GB, Pro $12 / 50 GB, Studio $35 / 250 GB, monthly, per workspace). Stripe only needs matching prices.

1. Stripe Dashboard (start in **test mode**) → **Product catalog → Add product**, three times:
   | Product | Price | Billing |
   | --- | --- | --- |
   | Ume Plus | $4.00 USD | Recurring, monthly |
   | Ume Pro | $12.00 USD | Recurring, monthly |
   | Ume Studio | $35.00 USD | Recurring, monthly |
   Copy each price id (`price_…`) → `STRIPE_PRICE_PLUS`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO`.
2. **Developers → API keys** → Secret key → `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**: URL `<APP_URL>/api/stripe/webhook`, events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`

   Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`. The handler verifies the signature and records every event id in `stripe_events` before acting, so Stripe's retries are idempotent.
4. **Settings → Billing → Customer portal**: turn it on, allow customers to **update payment methods**, **cancel subscriptions**, and **switch plans** between the three prices. Set the business name and the link back to `https://ume.app`. The dashboard's "Manage billing" button opens this portal.
5. **Settings → Billing → Subscriptions and emails**: enable failed-payment emails and a short retry schedule (Smart Retries). When a subscription ends, the webhook downgrades the workspace to Free; over-quota workspaces become read-only for uploads and are never purged for being over quota.
6. Local development:

   ```bash
   brew install stripe/stripe-cli/stripe && stripe login
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   # prints a whsec_… for your .env; test cards: 4242 4242 4242 4242
   ```

7. Going live: repeat steps 1–4 in **live mode** (products, prices, keys and webhook secrets are all separate), set the live values on Vercel, and activate the account (business details, bank account, tax settings).

---

## 6. Resend

Transactional email only: invites, inactivity notices, purge confirmations, token-rotation alerts, quota warnings. Without `RESEND_API_KEY` the sender prints the message to stdout, which is what you want locally.

1. [Resend](https://resend.com) → **Domains → Add domain** → `ume.app` (or a subdomain such as `mail.ume.app` to keep your root domain's reputation separate). Region: US East.
2. Add the DNS records Resend shows, at your DNS provider (Cloudflare if the domain is there):
   - **DKIM**: one TXT at `resend._domainkey` (the long `p=…` key).
   - **SPF**: an MX and a TXT on the sending subdomain Resend names (typically `send.ume.app`), value like `v=spf1 include:amazonses.com ~all`.
   - **DMARC**: TXT at `_dmarc.ume.app`, start with `v=DMARC1; p=none; rua=mailto:dmarc@ume.app` and tighten to `p=quarantine` once reports look clean.
   Wait for the domain to show **Verified**.
3. **API Keys → Create** with **Sending access**, restricted to the domain → `RESEND_API_KEY`.
4. `EMAIL_FROM="Ume <no-reply@ume.app>"` (the address must be on the verified domain).
5. Send yourself an invite from a test workspace and check it lands in the inbox, not spam.

---

## 7. Web on Vercel

1. Push the repo to GitHub. [Vercel](https://vercel.com) → **Add New → Project → Import** the repository.
2. Project settings:
   - **Root Directory**: `apps/web` (tick "Include source files outside of the Root Directory", which is the default; the build needs `packages/*`).
   - **Framework Preset**: Next.js (auto-detected).
   - **Install Command**: `pnpm install` — Vercel reads `packageManager` from the root `package.json` and runs the install at the workspace root.
   - **Build Command**: leave the default (`next build`); Turborepo is not needed for a single app.
   - **Node.js Version**: 22.x.
3. **Environment Variables** (Production and Preview separately). The web process needs:

   `APP_URL`, `NEXT_PUBLIC_APP_URL`, `DATABASE_URL` (pooled), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DISCORD_CLIENT_ID`, `NEXT_PUBLIC_DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CEO_EMAILS`, `S3_*`, `STRIPE_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `NEXT_PUBLIC_DISCORD_SUPPORT_INVITE`, `NEXT_PUBLIC_GITHUB_URL`, `DMCA_AGENT_*`.

   The web app does **not** need `DISCORD_BOT_TOKEN`, `FFMPEG_PATH`, `YTDLP_*` or `DISCORD_DEV_GUILD_ID` unless a feature in `apps/web` documents otherwise; keep secrets per process. For previews, point `DATABASE_URL` at a Neon branch and set `APP_URL`/`BETTER_AUTH_URL` to the preview domain (or use `VERCEL_URL`-based overrides), otherwise OAuth callbacks will not match.
4. **Domains**: add `ume.app` and `www.ume.app` (redirect www → apex). Update `APP_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` to `https://ume.app` and add the matching Discord and Google redirect URIs (sections 1.3 and 2).
5. **Runtime notes**:
   - `src/proxy.ts` (the Next.js 16 replacement for middleware) runs on the **Node runtime**, so it can import `better-auth/cookies` without Edge restrictions. It only checks for the presence of a session cookie; real authorization happens in server code on every request.
   - Server Actions have a 4 MB body limit (`next.config.ts`); audio never goes through them, it goes straight to R2.
   - `postgres`, `pg-boss` and the AWS SDK are marked `serverExternalPackages` so they are not bundled.
6. **Cron** (optional): the worker schedules the recurring sweeps itself through pg-boss. If the web app exposes `/api/cron/*` routes as an alternative trigger, define them in `apps/web/vercel.json` and Vercel will call them with `Authorization: Bearer $CRON_SECRET`.
7. Deploy. Check `/`, `/login` (Discord round-trip), `/ceo/login` (Google round-trip with a `CEO_EMAILS` address), and the Stripe webhook's "Send test event" from the Stripe dashboard.

---

## 8. Bot and worker on Railway or Fly.io

Both apps ship a `Dockerfile` (`apps/bot/Dockerfile`, `apps/worker/Dockerfile`; see each app's README). The images are built **from the repository root** so that `pnpm` can see the workspace packages. The worker image installs `ffmpeg` (with libopus) and `yt-dlp`; the bot image needs neither. You do not need Docker locally; both platforms build remotely and CI builds the images on every push to catch regressions.

Run **exactly one instance** of the bot. Discord allows one gateway session per shard, and two bots with the same token fight over the voice connection. The worker can run one instance too (pg-boss serializes jobs per queue); scale it only when transcodes queue up.

Pick a region near Discord's voice infrastructure: **us-east** (Railway "US East (Virginia)", Fly `iad`). Neon in the same region keeps query latency low.

### Environment variables

| Process | Variables |
| --- | --- |
| bot | `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_MESSAGE_CONTENT_INTENT`, `DATABASE_URL_DIRECT` (or `DATABASE_URL`), `APP_URL`, `S3_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `LOG_LEVEL` |
| worker | `DATABASE_URL_DIRECT` (or `DATABASE_URL`), `APP_URL`, `S3_*`, `RESEND_API_KEY`, `EMAIL_FROM`, `FFMPEG_PATH`, `YTDLP_PATH`, `YTDLP_COOKIES`, `LOG_LEVEL` |

Neither needs Stripe, Google, or Better Auth secrets.

### Protecting the gateway IDENTIFY budget

Discord allows roughly 1,000 `IDENTIFY` calls per token per 24 hours. A crash loop that restarts instantly can exhaust that in minutes, after which Discord **resets the bot token** and every instance goes dark until you rotate it. Two defenses:

1. Limit restarts (Railway: "Restart policy: On failure, max 10 retries"; Fly: `[restart] policy = "on-failure"`, `retries = 10`). Both platforms back off between attempts.
2. Enforce a minimum 30 s delay between exit and restart regardless of platform by wrapping the start command so the container lingers after a crash:

   ```
   sh -c 'node dist/index.js; sleep 30'
   ```

   The Dockerfiles may already do this; if not, set it as the service's Start Command. A healthy bot never hits the delay.

### Railway

1. [Railway](https://railway.app) → **New Project → Deploy from GitHub repo** → pick `ume`. Create **two services** from the same repo (Project → + New → GitHub Repo again for the second).
2. For each service, **Settings**:
   - **Source → Root Directory**: leave at `/` (repo root). **Dockerfile Path**: `apps/bot/Dockerfile` or `apps/worker/Dockerfile`.
   - **Source → Watch Paths**: `apps/bot/**`, `packages/**`, `pnpm-lock.yaml` (and the same for the worker) so a web-only commit does not redeploy the bot.
   - **Deploy → Region**: US East. **Replicas**: 1. **Restart Policy**: On Failure, 10 retries.
   - **Deploy → Start Command**: only if you need the `sleep 30` wrapper above.
   - **Deploy → Healthcheck**: none (the bot has no HTTP server); Railway keeps the container running as long as the process is alive.
3. **Variables**: add the table above per service. Use Railway's **Shared Variables** for `S3_*`, `DATABASE_URL_DIRECT`, `APP_URL`, `RESEND_*` and reference them from both services.
4. Deploy. In the bot's logs you should see it log in and join each claimed server's home channel; in the worker's logs, pg-boss starting its queues.

### Fly.io

```bash
brew install flyctl && fly auth login

# bot
fly launch --no-deploy --name ume-bot --region iad --dockerfile apps/bot/Dockerfile --config apps/bot/fly.toml
# worker
fly launch --no-deploy --name ume-worker --region iad --dockerfile apps/worker/Dockerfile --config apps/worker/fly.toml
```

Edit each generated `fly.toml`: remove the `[http_service]` block (no public ports), and add

```toml
[restart]
  policy = "on-failure"
  retries = 10

[[vm]]
  size = "shared-cpu-1x"
  memory = "512mb"   # 1gb for the worker if transcodes OOM
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
- Invite the bot to a test server with the "Add to Discord" button on the site, run `/reload`, claim the token on the web, upload a file, and `/play` it. That exercises web → R2 → worker → bot end to end.

---

## 9. DMCA agent registration

Ume stores user-uploaded audio, so it needs the safe-harbor protections of 17 U.S.C. §512. That requires a **designated agent** registered with the U.S. Copyright Office, and the same details published on the site.

1. Go to the [DMCA Designated Agent Directory](https://dmca.copyright.gov/osp/) → create an account → **Register a service provider**. List `Ume` and every name and domain the service uses (`ume.app`).
2. Enter the agent's name, mailing address, phone and email. Use a role address such as `dmca@ume.app`, not a personal inbox, and make sure it is monitored.
3. Pay the **$6** fee. The registration is valid for **three years**; put a renewal reminder in your calendar, because an expired registration voids the safe harbor.
4. Set `DMCA_AGENT_NAME`, `DMCA_AGENT_EMAIL`, `DMCA_AGENT_ADDRESS` to exactly what you registered. The `/dmca` page shows them and hosts the takedown form; notices land in `dmca_notices` and are handled from the CEO console (`disabled` track status, `blocked_hashes`, repeat-infringer policy in the Terms).

---

## 10. Discord bot verification (100 servers)

An unverified bot cannot join more than **100 servers**. Discord lets you apply once you reach 75. Everything below is much easier if it was done on day one (section 1):

- The application is owned by a **Team** whose members all have **2FA**.
- **Terms of Service** and **Privacy Policy** URLs are set on the application (`https://ume.app/terms`, `https://ume.app/privacy`) and the pages actually describe data handling (Discord ids, uploaded audio, emails, Stripe).
- A clear description of what the bot does and, in the application form, why each requested permission is needed. Ume needs no privileged intents unless you enabled Message Content, in which case justify it or turn it off before applying.
- Identity verification for the team owner (Discord uses Stripe Identity; have a government id ready).
- Apply from **App Verification** in the portal. Review typically takes days to a few weeks; the bot keeps working in existing servers meanwhile.

---

## 11. Go-live checklist

Infrastructure

- [ ] Neon production project in us-east, PITR on, `pnpm db:migrate` applied, `DATABASE_URL` (pooled) and `DATABASE_URL_DIRECT` set in the right places.
- [ ] R2 bucket private, CORS rule includes `https://ume.app`, API token scoped to the bucket, `S3_PUBLIC_BASE_URL` set if covers are public.
- [ ] Vercel production domain `ume.app` live; `APP_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` all `https://ume.app`; `BETTER_AUTH_SECRET` is a fresh 32-byte value.
- [ ] Bot and worker deployed in us-east, one replica each, restart limits set, logs clean for 10 minutes.
- [ ] Slash commands registered globally; `/help` responds in a fresh server.

Identity and access

- [ ] Discord redirect `https://ume.app/api/auth/callback/discord` and Google redirect `https://ume.app/api/auth/callback/google` added.
- [ ] `CEO_EMAILS` contains only the accounts that should reach `/ceo`; a Discord-only account is refused.
- [ ] Feature flags reviewed in the CEO console: `youtube_ingest` **off**, `uploads_enabled` on, `signups_open` on, `auto_purge_enabled` on.

Money and mail

- [ ] Stripe live products/prices created, live keys and live webhook secret on Vercel, Customer Portal enabled, a real $4 test purchase upgrades a workspace and the portal downgrade returns it to Free.
- [ ] Resend domain verified (DKIM/SPF/DMARC), `EMAIL_FROM` on that domain, an invite email delivered to a Gmail inbox.

Legal

- [ ] `/terms`, `/privacy`, `/dmca` published and linked from the footer and the Discord application.
- [ ] DMCA agent registered at copyright.gov; `DMCA_AGENT_*` matches; `dmca@ume.app` is monitored.
- [ ] Discord application is Team-owned with 2FA (verification prerequisite).

Operations

- [ ] Error tracking and uptime alerts wired (see [`OPERATIONS.md`](OPERATIONS.md#monitoring)).
- [ ] Secrets stored only in Vercel / Railway / Fly and a password manager; `.env` is git-ignored and was never committed.
- [ ] Calendar reminders: DMCA agent renewal (3 years), Stripe/Resend/R2 billing reviews (monthly), Neon PITR window check.
