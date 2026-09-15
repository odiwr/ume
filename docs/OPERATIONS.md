# Ume operations

Runbooks for the things that go wrong, plus monitoring and cost notes. Each runbook assumes you have the CEO console (`/ceo`), the Neon SQL editor (or `psql` against `DATABASE_URL_DIRECT`), and the Railway/Fly dashboards. Prefer the console over raw SQL when both work: console actions are audit-logged.

Contents

- [Rotate a leaked bot token](#rotate-a-leaked-bot-token)
- [Rotate other secrets](#rotate-other-secrets)
- [A workspace stuck in `purging`](#a-workspace-stuck-in-purging)
- [A user lost access to their workspace](#a-user-lost-access-to-their-workspace)
- [YouTube ingest flag on / off](#youtube-ingest-flag-on--off)
- [Storage over quota or usage looks wrong](#storage-over-quota-or-usage-looks-wrong)
- [Uploads failing](#uploads-failing)
- [The bot is offline or silent](#the-bot-is-offline-or-silent)
- [DMCA takedown](#dmca-takedown)
- [Restore from Neon point-in-time recovery](#restore-from-neon-point-in-time-recovery)
- [Monitoring](#monitoring)
- [Cost expectations](#cost-expectations)

---

## Rotate a leaked bot token

Symptoms: the token appeared in a log, a screenshot, a commit, or Discord emailed you that it was reset; or the bot is doing things you did not deploy.

1. **Discord Developer Portal → your app → Bot → Reset Token.** This invalidates the old token instantly; every process using it disconnects on its next gateway action. Copy the new token once.
2. Update `DISCORD_BOT_TOKEN` in the bot's host (Railway variables / `fly secrets set -a ume-bot DISCORD_BOT_TOKEN=…`). The bot is the only process that needs it; if the web or worker also has the variable set, update or remove it there too.
3. Redeploy or restart the bot. Watch the logs for a successful login and voice reconnects in each claimed server (`bot_connected` flips back to true in `workspaces`).
4. If the leak was in git history, treat the history as public: rotate, then rewrite or leave it (the old token is dead either way). Search the repo for other secrets while you are there.
5. Post-mortem: how did it leak? Common causes are `pino` logging the full `process.env` on a crash, `.env` copied into a Docker image (`.dockerignore` must exclude it), or a screenshot of the portal.

Rotating the bot token does **not** affect users, workspaces, or Ume claim tokens (`claim_tokens` are hashed and unrelated).

## Rotate other secrets

| Secret | Effect of rotating | How |
| --- | --- | --- |
| `BETTER_AUTH_SECRET` | Every web session is invalidated; users sign in again. No data loss. | `openssl rand -base64 32`, update on Vercel, redeploy. |
| `DISCORD_CLIENT_SECRET` | Discord sign-in breaks until updated. Existing sessions keep working. | Portal → OAuth2 → Reset Secret; update Vercel. |
| `STRIPE_WEBHOOK_SECRET` | Webhooks fail signature checks until updated (Stripe retries for 3 days). | Roll the endpoint's secret in the Stripe dashboard; update Vercel immediately. |
| `S3_*` token | All three processes lose storage access until updated. | Create a new R2 token first, update all three hosts, then delete the old token. |
| `RESEND_API_KEY` | Email silently degrades to failures in `notifications`. | Create new key, update web + worker, delete old. |
| `CRON_SECRET` | Cron routes return 401 until Vercel's env matches. | Update both places at once. |

## A workspace stuck in `purging`

`purging` means a purge was confirmed and the `purge-workspace` job started but never marked the row `purged`. The job retries 5 times with backoff, so wait 15 minutes before intervening.

1. Find it: CEO console → Workspaces → filter status `purging`, or

   ```sql
   select id, ume_id, guild_id, guild_name, status, updated_at from workspaces where status = 'purging';
   ```

2. Check the worker logs for the workspace id. Typical causes: R2 credentials expired, a very large prefix timing out, or the worker crash-looping.
3. Check the pg-boss job state:

   ```sql
   select id, state, retry_count, output, created_on from pgboss.job
   where name = 'purge-workspace' and data->>'workspaceId' = '<ws_id>' order by created_on desc;
   ```

   `failed` with an R2 error → fix credentials, then re-enqueue from the CEO console (reason `ceo`). `expired` → the job took longer than 30 minutes; re-enqueue, the worker deletes in pages and is idempotent.
4. If the worker is healthy and the job is simply gone (for example the queue was archived), re-enqueue from the CEO console. Never set the row to `purged` by hand while objects remain in `ws/<id>/`; you would leak storage. Confirm the prefix is empty first:

   ```bash
   aws s3 ls s3://ume/ws/<ws_id>/ --endpoint-url $S3_ENDPOINT | head
   ```

5. While `purging`/`purged`, `/reload` in that server is refused by design. If the Owner purged by mistake, there is no undo: storage objects are deleted before the row is marked `purged`. Neon PITR can bring back rows but not audio (see below); tell the user honestly.

## A user lost access to their workspace

Work through the list; each step names where to look.

1. **Who are they?** Ask for the workspace URL (`/app/ume-…`) and their Discord username. In the CEO console open the workspace and the user; confirm `users.discord_user_id` is set (they signed in with Discord) and `banned` is false.
2. **Is the workspace connected?** `status = disconnected` means someone ran `/reload`: every member drops to read-only until the Owner (or a member with `MANAGE_SETTINGS`, or the Discord guild owner) enters the new token in Settings. The token was DM'd to whoever ran the command; if it expired (24 h), they run `/reload` again. `unclaimed` after a reset means the same thing.
3. **Did `/reset` run?** It removes every membership except the Owner's and revokes all invites. Look for `reset.confirm` in the audit log. The Owner re-invites people or re-enables Discord role mapping.
4. **Did a temporary membership expire?** `memberships.expires_at` in the past is removed by `expire-things`. The audit log shows the original invite; issue a new one.
5. **Discord role mapping.** If they expect access from a Discord role, check `discord_role_sync_enabled` and `discord_role_maps` for that role id, and that the user signed in with the same Discord account that holds the role. Signing out and in re-runs the sync.
6. **Wrong account.** A Google-only account has no Discord id and therefore no role sync and no guild-membership checks for links. They should sign in with Discord; account linking merges the two when the emails match.
7. **The Owner is gone** (left Discord, lost the account). The Discord guild owner can run `/reload` and claim the token: `claimToken()` transfers ownership to the verified guild owner and demotes the previous Owner to Master. This is the supported path; do not edit `owner_user_id` by hand unless the guild owner cannot sign in at all, and then use `setWorkspaceOwner()` semantics (membership row + `owner_user_id` together) and log it.
8. **They were banned.** `users.banned` blocks sign-in everywhere (`/banned`). Only unban from the CEO console so the reason and actor are recorded.

## YouTube ingest flag on / off

`youtube_ingest` is a global flag in the CEO console, **off by default**. Read the risk section in [`PLAN_REVIEW.md`](PLAN_REVIEW.md#risks-you-must-decide-on) before touching it.

**Turning it on**

- New YouTube links (and, if the UI offers it, existing linked entries) enqueue `ingest-youtube`; the worker runs `yt-dlp` and stores normalized Opus. Storage use and `track_count` rise; quota applies.
- `yt-dlp` from datacenter IPs is frequently blocked (sign-in walls, PO tokens). Expect a failure rate; set `YTDLP_COOKIES` to a cookies file exported from a logged-in browser session if you accept the account risk, and keep `yt-dlp` updated in the worker image (the Dockerfile pins it; rebuild monthly).
- You are now hosting audio extracted from YouTube. Update the Terms if they promise otherwise, and expect the DMCA inbox to get busier.
- Per-workspace opt-out remains: `workspaces.youtube_enabled = false` blocks ingest for that server even with the flag on.

**Turning it off**

- Pending `ingest-youtube` jobs are refused by the worker (it re-checks the flag), and no new ones are enqueued. Links keep working as metadata-only entries.
- Already-ingested tracks keep their `storage_key` and remain playable. If the intent is to stop serving that audio entirely, run a one-off in the CEO console or SQL to `disabled` them (keeps rows, blocks playback) or delete them, then run `reconcile-storage` so quota numbers drop.

Both changes are audit-logged (`ceo.flag.update`).

## Storage over quota or usage looks wrong

- Over quota is expected behaviour: uploads are refused with a clear message, existing tracks play, nothing is deleted. The Owner upgrades (Stripe) or removes tracks. At 90 % the worker sends `quotaWarningEmail` once.
- **CEO override**: `workspaces.storage_quota_override_bytes` lifts a specific workspace's limit (for example for a partner). Set it from the console; it wins over the plan.
- **Usage looks wrong** (`storage_used_bytes` disagrees with the playlist contents): run `reconcile-storage` from the console or wait for the daily run. It recomputes from `tracks.size_bytes` and deletes objects under `ws/<id>/` that no track references, including stale originals under `uploads/` from failed transcodes. Per workspace, `recomputeWorkspaceUsage()` does the same without the object scan.
- **A track is stuck in `processing`**: the transcode job expired (15 minutes) or the worker died. Re-enqueue `transcode-upload` for the track; if the original under `uploads/` is gone, mark it `failed` with an `error_message` and let the user re-upload.

## Uploads failing

Check in this order:

1. `uploads_enabled` flag (CEO console).
2. Browser console shows a CORS error on the `PUT` → the R2 CORS rule lacks the origin or the `Content-Type` header ([`DEPLOY.md`](DEPLOY.md#4-cloudflare-r2)).
3. `403` on the presigned URL → clock skew or an R2 token that lost write permission; presigned URLs are valid for a short window.
4. Upload succeeds but the track never becomes `ready` → worker logs; ffmpeg missing libopus (`ffmpeg -encoders | grep libopus` inside the image); file rejected by `file-type` (not audio) or longer than 30 minutes (`UPLOAD.maxDurationMs`).

## The bot is offline or silent

- **Offline in every server**: the bot process is down or the token is invalid. Host logs first. `401` from the gateway means the token was reset (see the leak runbook). Repeated `IDENTIFY` failures with a "session limit" message mean the daily IDENTIFY budget is exhausted by a crash loop; stop the service for an hour, fix the crash, then restart.
- **Offline in one server**: `workspaces.bot_in_guild` false means it was kicked; the Owner re-adds it with the site's button. `home_voice_channel_id` pointing at a deleted channel: `/home` in a new channel fixes it. Missing `Connect`/`Speak` permission in the channel shows in the bot log as a voice join failure.
- **Connected but silent**: check that the track is `ready` with a `storage_key` and that the R2 credentials on the bot host are valid (`GET` on the object). Discord sometimes drops voice UDP after a region move; the bot reconnects on the next `/play`.
- **CEO console shows "offline"** while Discord shows it present: the heartbeat writes `bot_last_seen_at` every 30 s (`BOT_HEARTBEAT_MS`); the console treats 3 missed beats as offline. Usually the bot lost its database connection (Neon direct URL, connection limit). Restart it.

## DMCA takedown

1. A notice arrives through `/dmca` (row in `dmca_notices`, status `received`) or by email to the registered agent address.
2. Verify it has the §512(c)(3) elements (identification of the work, the URL, contact details, good-faith and accuracy statements, signature). Incomplete notices get a reply asking for the missing parts; status `rejected` if they never arrive.
3. Act expeditiously: in the CEO console set the track `disabled` (playback and download stop; the object stays for a possible counter-notice), add its `sha256` to `blocked_hashes`, notify the uploader (their email from `users`) with a copy of the notice, set status `actioned`.
4. Counter-notice: forward to the claimant; if they do not file suit within 10–14 business days, restore the track (`ready`, remove the hash) and set status `restored`. Otherwise it stays disabled.
5. Repeat infringers: three actioned notices against the same uploader triggers the policy in the Terms (ban the user from the console, which records the reason).
6. Keep the agent registration current at copyright.gov (renew every 3 years) and `DMCA_AGENT_*` matching it.

## Restore from Neon point-in-time recovery

Neon keeps a history window (7 days by default on paid plans, less on free). Restoring creates a **new branch** at a timestamp; it does not overwrite production until you switch to it.

1. Stop the writers so the restored state does not diverge further: scale the bot and worker to 0 instances; put the web app in maintenance (`maintenance_banner` flag, or pause the Vercel deployment).
2. Neon console → project → **Branches → Restore** (or "Create branch from timestamp") → pick a time just before the incident. This creates a branch with its own connection strings.
3. Verify on the branch with the SQL editor: does the missing workspace/playlist exist there? Are `stripe_events` and recent `audit_logs` present?
4. Decide the restore scope:
   - **Whole database**: use Neon's "Restore branch" on `main` to reset it to the timestamp (the console offers a preview branch first). Everything written after the timestamp is lost, including Stripe webhook records; Stripe will resend nothing automatically, so re-run "Send test event" or reconcile subscriptions by hand from the Stripe dashboard.
   - **A few rows**: copy them from the restored branch to production with `pg_dump --data-only -t <table>` against the branch URL and `psql` against production, or `INSERT … SELECT` over `dblink` if enabled. Respect foreign-key order (`workspaces` → `roles` → `memberships` → `playlists` → `tracks` → `playlist_tracks`).
5. Storage is **not** covered by PITR. Restored `tracks` rows point at objects that may have been deleted (purge, reconcile). Run `reconcile-storage` afterwards: it marks rows whose object is missing as `failed` rather than pretending they play.
6. pg-boss tables live in the same database (`pgboss` schema). A restore also rewinds the queue; expired or duplicate jobs are harmless because every consumer is idempotent, but check for a resurrected `purge-workspace` job before you turn the worker back on:

   ```sql
   select id, data, state from pgboss.job where name = 'purge-workspace' and state in ('created','retry','active');
   ```

7. Bring the worker back, then the bot, then clear the maintenance banner. Write down what happened in the audit log (`ceo.restore`) so the timeline is visible later.

## Monitoring

Minimum viable set:

- **Errors**: Sentry (free tier) in all three processes. In the web app use `@sentry/nextjs`; in the bot and worker the Node SDK with `pino` breadcrumbs. Tag events with `workspaceId` and `guildId`, never with tokens.
- **Uptime and heartbeats**: Better Stack (or Cronitor / Healthchecks.io). Two heartbeat monitors: the bot pings after each successful `BOT_HEARTBEAT_MS` write, the worker pings when `inactivity-sweep` completes daily. Alert after two missed beats. An HTTP monitor on `https://ume.app/` and on `https://ume.app/api/auth/ok` (or any cheap route) every minute.
- **Logs**: Railway/Fly log drains into Better Stack Logs (pino JSON parses cleanly). Keep `LOG_LEVEL=info` in production; `debug` prints per-packet voice logs.
- **Queue health**: a small dashboard query on `pgboss.job` grouped by `name, state`. Alert when `failed` grows or when `created` for `transcode-upload` is older than 10 minutes (worker stalled).
- **Business**: the CEO console overview (workspaces by status, storage total, paid count, bot online count) is the daily glance. Stripe's own dashboard covers revenue and failed payments; enable its email alerts.
- **Discord**: subscribe to the [Discord status page](https://discordstatus.com) for voice region incidents; most "bot is broken" reports during those windows are not yours.
- **Vercel**: enable the Web Analytics and Speed Insights add-ons if you want them; more importantly turn on deployment notifications for failed builds.

## Cost expectations

Launch scale (tens of servers, a few paid) fits comfortably in free and hobby tiers:

| Item | Expected monthly cost | Notes |
| --- | --- | --- |
| Vercel (web) | $0 Hobby, $20 Pro when you need team seats or more function time | Server actions and route handlers are light; audio bypasses Vercel entirely. |
| Railway or Fly (bot + worker) | $5–15 | Two small always-on containers (512 MB bot, 512 MB–1 GB worker). This is the real per-instance cost referenced in the plan (~$0.30–1 per active server-month at current density). |
| Neon | $0 free tier → $19 Launch | Free tier sleeps compute after inactivity, which adds a cold-start to the first query; Launch keeps it warm and extends PITR. |
| Cloudflare R2 | ~$0.015 per GB-month + $0 egress | 100 paid workspaces at 5 GB average ≈ $7.50. Class A/B operations are negligible at this scale. |
| Resend | $0 (3,000 emails/month) → $20 | Notices are rare; invites dominate. |
| Stripe | 2.9 % + $0.30 per charge | A $4 plan nets ≈ $3.58. |
| Domain + DMCA agent | ~$15/yr + $6 per 3 yrs | |

Rule of thumb: revenue from one Plus subscriber covers the storage of roughly 250 GB, so the constraint is hosting per active bot instance and support time, not bytes. Watch two numbers monthly: Railway/Fly spend per claimed server, and R2 GB per paid workspace.
