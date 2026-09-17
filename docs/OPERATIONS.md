# Ume operations

Runbooks for the things that go wrong, plus monitoring and cost notes. Each runbook assumes you have the CEO console (`/ceo`), the Neon SQL editor (or `psql` against `DATABASE_URL_DIRECT`), and the Railway/Fly dashboards. Prefer the console over raw SQL when both work: console actions are audit-logged (`ceo.*`).

Contents

- [Rotate a leaked bot token](#rotate-a-leaked-bot-token)
- [Rotate other secrets](#rotate-other-secrets)
- [A workspace stuck in `purging`](#a-workspace-stuck-in-purging)
- [A user lost access to their workspace](#a-user-lost-access-to-their-workspace)
- [Link extraction failing](#link-extraction-failing)
- [Turn link extraction off, globally or per workspace](#turn-link-extraction-off-globally-or-per-workspace)
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

1. **Discord Developer Portal → your app → Bot → Reset Token.** This invalidates the old token instantly; every process using it disconnects on its next gateway or REST call. Copy the new token once.
2. Update `DISCORD_BOT_TOKEN` in **three** places: the bot's host (Railway variables / `fly secrets set -a ume-bot DISCORD_BOT_TOKEN=…`), the worker's host (it sends DMs and channel notices over REST), and Vercel (the web app looks up guilds, roles, channels and members with it). If you run a residential extractor, that instance does not need the token.
3. Redeploy or restart the bot and worker; Vercel picks up the new value on its next deployment (trigger a redeploy). Watch the bot logs for a successful login and voice reconnects in each claimed server (`bot_connected` flips back to true in `workspaces`).
4. If the leak was in git history, treat the history as public: rotate, then rewrite or leave it (the old token is dead either way). Search the repo for other secrets while you are there.
5. Post-mortem: how did it leak? Common causes are logging `process.env` on a crash, `.env` copied into a Docker image (`.dockerignore` must exclude it), or a screenshot of the portal.

Rotating the bot token does **not** affect users, workspaces, or Ume claim tokens (`claim_tokens` are hashed and unrelated).

## Rotate other secrets

| Secret                  | Effect of rotating                                                                                                                                | How                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`    | Every web session is invalidated; users sign in again. No data loss.                                                                              | `openssl rand -base64 32`, update on Vercel, redeploy.                                |
| `DISCORD_CLIENT_SECRET` | Discord sign-in breaks until updated. Existing sessions keep working.                                                                             | Portal → OAuth2 → Reset Secret; update Vercel.                                        |
| `STRIPE_WEBHOOK_SECRET` | Webhooks fail signature checks until updated (Stripe retries for 3 days).                                                                         | Roll the endpoint's secret in the Stripe dashboard; update Vercel immediately.        |
| `S3_*` token            | Every process (web, bot, both workers) loses storage access until updated.                                                                        | Create a new R2 token first, update every host, then delete the old token.            |
| `RESEND_API_KEY`        | Email degrades to `failed` rows in `notifications` and retrying `send-email` jobs; a missing key in production fails with `email_not_configured`. | Create new key, update web + bot + worker, delete old.                                |
| `COBALT_API_KEY`        | `extract-link` jobs retry and fail until the worker matches the instance.                                                                         | Update the Cobalt keys file and the worker together.                                  |
| `YTDLP_COOKIES`         | Only matters when the cookies expire; symptoms are sign-in failures below.                                                                        | Export fresh cookies from a throwaway account, replace the file on the extractor box. |
| `CRON_SECRET`           | Nothing today; reserved for `/api/cron/*`.                                                                                                        | Update Vercel if you ever add cron routes.                                            |

## A workspace stuck in `purging`

`purging` means a purge was confirmed (the bot's `/confirm`, the web Danger Zone, the sweep, or the CEO console) and the `purge-workspace` job started but never marked the row `purged`. The job retries 5 times with backoff, so wait 15 minutes before intervening.

1. Find it: CEO console → Workspaces → filter status `purging`, or

   ```sql
   select id, ume_id, guild_id, guild_name, status, updated_at from workspaces where status = 'purging';
   ```

2. Check the worker logs for the workspace id. Typical causes: R2 credentials expired, a very large prefix timing out, the worker crash-looping, or (rarer) the bot set `purging` but failed to enqueue the job (its log says so).
3. Check the pg-boss job state:

   ```sql
   select id, state, retry_count, output, created_on from pgboss.job
   where name = 'purge-workspace' and data->>'workspaceId' = '<ws_id>' order by created_on desc;
   ```

   `failed` with an R2 error → fix credentials, then re-enqueue from the CEO console (reason `ceo`). `expired` → the job took longer than 30 minutes; re-enqueue, the worker deletes in pages and is idempotent. No row at all → the enqueue never happened; re-enqueue from the console. The worker accepts a purge for any workspace already in `purging`, whatever the reason.

4. Never set the row to `purged` by hand while objects remain in `ws/<id>/`; you would leak storage. Confirm the prefix is empty first:

   ```bash
   aws s3 ls s3://ume/ws/<ws_id>/ --endpoint-url $S3_ENDPOINT | head
   ```

5. While `purging`/`purged`, `/reload` and the OAuth claim for that server are refused by design. If the Owner purged by mistake, there is no undo: storage objects are deleted before the row is marked `purged`. Neon PITR can bring back rows but not audio (see below); tell the user honestly.

## A user lost access to their workspace

Work through the list; each step names where to look.

1. **Who are they?** Ask for the workspace URL (`/app/ume-…`) and their Discord username. In the CEO console open the workspace and the user; confirm `users.discord_user_id` is set (they signed in with Discord) and `banned` is false.
2. **Is the workspace connected?** `status = disconnected` means someone ran `/reload` or `/reset`: every member drops to read-only until the Owner (or a member with `MANAGE_SETTINGS`, or the Discord guild owner) enters the new token in Settings, or the Owner reconnects through the server picker (OAuth). The token was DM'd to whoever ran the command; if it expired (24 h), they run `/reload` again.
3. **Did `/reset` run?** It removes every membership except the Owner's and revokes all invites and unclaimed tokens. Look for `workspace.reset` in the audit log. The Owner re-invites people or lets Discord role mapping re-admit them from the server picker.
4. **Did a temporary membership expire?** `memberships.expires_at` in the past is removed by `expire-things` hourly. The audit log shows the original invite (`invite.create` / `invite.accept`); issue a new one.
5. **Discord role mapping.** If they expect access from a Discord role, check `discord_role_sync_enabled` and `discord_role_maps` for that role id, and that they signed in with the Discord account that holds the role. Joining again from the server picker (`/app/new`) re-runs the mapping.
6. **Wrong account.** A Google-only account has no Discord id and therefore no role sync and no guild-membership checks for links. They should sign in with Discord; account linking merges the two when the emails match.
7. **The Owner is gone** (left Discord, lost the account). The Discord guild owner can run `/reload` and claim the token, or claim through OAuth: both paths transfer ownership to the verified guild owner and demote the previous Owner to Master. This is the supported path; do not edit `owner_user_id` by hand unless the guild owner cannot sign in at all, and then use `setWorkspaceOwner()` semantics (membership row + `owner_user_id` together) and log it.
8. **They were banned.** `users.banned` blocks sign-in everywhere (`/banned`). Only unban from the CEO console so the reason and actor are recorded.

## Link extraction failing

Symptoms: links added from the web or `/add` end up `failed` with a message, or stay `pending` for a long time; the Activity page or the playlist shows "This item could not be fetched".

Read the track's `error_message` first (CEO console → workspace → tracks, or `select id, title, source_site, status, error_message from tracks where source = 'link' and status = 'failed' order by updated_at desc limit 50;`). The worker classifies failures, and the message tells you which case you are in:

| Message                                                                                             | Meaning                                                                                                                          | What to do                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "The site asked for a sign-in, so this item cannot be fetched right now."                           | yt-dlp/Cobalt hit the "Sign in to confirm you're not a bot" wall. The worker's IP (a datacenter range) is blocked for that site. | This is the expected failure mode of running the extractor in the cloud. **Move the `extract-link` queue to a residential worker or point the worker at a self-hosted Cobalt instance**: [`DEPLOY.md`](DEPLOY.md#9-the-residential-extractor). As a stop-gap, set `YTDLP_COOKIES` to a cookies file exported from a throwaway account logged into the site (`YTDLP_EXTRA_ARGS` can add a PO-token provider); expect cookies to expire and the account to be flagged eventually. Then retry the track from the playlist page (`retryTrack`). |
| "This item is private / unavailable / age-restricted / blocked in the region the worker runs from." | The site refused the item itself.                                                                                                | Nothing to fix on our side. Region blocks disappear when the extractor runs from a different country.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| "This item is longer than 30 minutes." / "too large to add"                                         | Over `LINK_EXTRACT.maxDurationMs` (30 min) or `maxDownloadBytes` (200 MB).                                                       | By design. Raise the constants in `packages/shared/src/links.ts` only with a product decision.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| "Only single tracks can be added, not playlists or albums."                                         | The URL resolved to a set.                                                                                                       | User error; `parseMediaLink()` rejects most of these before enqueue.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| "This link is not supported."                                                                       | Unsupported URL shape, or the site changed its markup and yt-dlp's extractor broke.                                              | If the site is on the allow-list and worked yesterday, **update yt-dlp** (rebuild the worker image; `brew upgrade yt-dlp` on a Mac extractor) or update Cobalt. YouTube in particular breaks old yt-dlp releases within weeks.                                                                                                                                                                                                                                                                                                              |
| "This content is blocked."                                                                          | The fetched bytes hash to an entry in `blocked_hashes` (a takedown).                                                             | Working as intended.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| "Over storage quota."                                                                               | Extraction succeeded but the workspace has no room.                                                                              | The Owner upgrades or removes tracks, then retries.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| "… could not be reached. Retrying." (then `failed`)                                                 | Network / 5xx / 429 from the site or Cobalt; retries exhausted (2 attempts, 60 s backoff).                                       | Check the extractor's outbound connectivity and the Cobalt instance's logs; retry the track. `EXTRACTOR_PROVIDER=cobalt` with an empty `COBALT_API_URL` produces this on every job and is logged as an error at worker boot.                                                                                                                                                                                                                                                                                                                |
| Stuck in `pending` for hours                                                                        | No worker consumes `extract-link`, or the job expired (15 min) while the download crawled.                                       | Check that some instance's boot log lists `extract-link` under `queues` (with `WORKER_QUEUES` split across two instances it is easy to leave the queue out of both). `reconcile-storage` deletes link rows stuck in `pending` for 24 h and fails `processing` rows older than 6 h so users can retry.                                                                                                                                                                                                                                       |

Other checks:

- The worker logs the YouTube ToS warning at boot while `link_extract` is on and `WARNING: fetching YouTube audio` per YouTube job. Their absence means the flag is off or the instance does not consume the queue.
- `ffmpeg -encoders | grep libopus` inside the worker image; without libopus every extraction (and upload) fails at the transcode step.
- Cobalt: `curl -X POST $COBALT_API_URL -H 'content-type: application/json' -H 'accept: application/json' -H "authorization: Api-Key $COBALT_API_KEY" -d '{"url":"https://www.youtube.com/watch?v=RMPX_vgqQnM","downloadMode":"audio"}'` should return `{"status":"tunnel",…}`; an `error.code` starting with `error.api.youtube.login` means the Cobalt instance itself needs cookies or a residential address.

## Turn link extraction off, globally or per workspace

`link_extract` is a global flag in the CEO console (`/ceo/flags`), **on by default** by the founder's decision (2026-09-15). Read the decision and its mitigations in [`PLAN_REVIEW.md`](PLAN_REVIEW.md#change) before changing it.

**Globally off** (CEO console → Flags → `link_extract`; audit-logged as `ceo.flag.update`):

- New links are saved as **metadata-only entries** (`status = ready`, no `storage_key`, title/author/cover from oEmbed) with a notice to the user saying extraction is switched off on Ume. Playback skips them with a note.
- `extract-link` jobs already queued are picked up by the worker, which re-checks the flag and converts the track to a metadata-only entry instead of fetching.
- Already-extracted tracks keep their `storage_key` and remain playable. If the intent is to stop serving that audio entirely, disable them from the CEO console (keeps rows, blocks playback and download) or delete them, then run `reconcile-storage` so quota numbers drop:

  ```sql
  -- preview what would be affected
  select workspace_id, count(*) from tracks where source = 'link' and storage_key is not null group by 1;
  ```

- The worker's boot log switches from the ToS warning to `link_extract flag is off`.

**Globally on again**: new links extract; nothing is re-queued for links added while it was off (they stay metadata-only; users can re-add them).

**Per workspace** (Settings → "Add from link", `MANAGE_SETTINGS`; audit-logged as `settings.link_extract`): `workspaces.link_extract_enabled = false` makes that server's links metadata-only even with the global flag on. The Owner's rights attestation (`link_extract_accepted_at`) is the third gate; a workspace whose Owner never accepted it also gets metadata-only entries with a notice pointing at Settings. The CEO console can inspect both columns on the workspace page; do not clear an attestation by hand, it is the record that the Owner accepted responsibility.

**Kill switch for the extractor process only**: stop the instance that consumes `extract-link` (or remove the queue from its `WORKER_QUEUES`). Jobs then wait in `pending` until a consumer returns; combine with the global flag if the pause will be long.

## Storage over quota or usage looks wrong

- Over quota is expected behaviour: uploads and extractions are refused with a clear message, existing tracks play, nothing is deleted. The Owner upgrades (Stripe) or removes tracks. At 90 % the worker sends `quotaWarningEmail` once.
- **CEO override**: `workspaces.storage_quota_override_bytes` lifts a specific workspace's limit (for example for a partner). Set it from the console (`ceo.workspace.quota_override`); it wins over the plan.
- **Usage looks wrong** (`storage_used_bytes` disagrees with the playlist contents): the web reserves the original's size at presign time and the worker replaces it with the Opus size, so a burst of in-flight uploads temporarily inflates the number. Run `reconcile-storage` from the console or wait for the daily 04:15 UTC run. It recomputes `storage_used_bytes` and `track_count` from `tracks.size_bytes`, recounts every playlist, deletes uploads stuck in `pending` for 24 h (and their originals) and fails `processing` rows older than 6 h. Per workspace, `recomputeWorkspaceUsage()` does the same without the cleanup.
- **A track is stuck in `processing`**: the job expired (15 minutes) or the worker died mid-transcode. Wait for `reconcile-storage` (it marks it `failed` with "Processing timed out") or re-enqueue `transcode-upload` / `extract-link` for the track from the console. If the original under `uploads/` is gone, the user re-uploads.

## Uploads failing

Check in this order:

1. `uploads_enabled` flag (CEO console).
2. Browser console shows a CORS error on the `PUT` → the R2 CORS rule lacks the origin or the `Content-Type` header ([`DEPLOY.md`](DEPLOY.md#4-cloudflare-r2)).
3. `403` on the presigned URL → clock skew, an R2 token that lost write permission, or the browser sent a different `Content-Type`/length than announced (the URL is signed for both); presigned URLs are valid for 10 minutes.
4. `/api/upload/complete` answers 409 "did not match its declared size" → the browser announced one size and uploaded another (a file changed on disk mid-upload); the user retries.
5. Upload succeeds but the track never becomes `ready` → worker logs; ffmpeg missing libopus (`ffmpeg -encoders | grep libopus` inside the image); file rejected by `file-type`/ffprobe (not audio, or video-only) or longer than 30 minutes (`UPLOAD.maxDurationMs`); duplicate content merged into an existing track (not a failure: the playlist shows the existing track).

## The bot is offline or silent

- **Offline in every server**: the bot process is down or the token is invalid. Host logs first. `401` from the gateway means the token was reset (see the leak runbook). Repeated `IDENTIFY` failures with a "session limit" message mean the daily IDENTIFY budget is exhausted by a crash loop; stop the service for an hour, fix the crash, then restart. The Dockerfile's `sleep 30` after exit exists to make this rare.
- **Offline in one server**: `workspaces.bot_in_guild` false means it was kicked; the Owner re-adds it with the site's button. `home_voice_channel_id` pointing at a deleted channel: the bot clears it and asks for `/home`; run `/home` in a new channel. Missing `Connect`/`Speak` permission in the channel shows in the bot log as a voice join failure, and `/home` refuses channels where it lacks them.
- **Connected but silent**: check that the track is `ready` with a `storage_key` (metadata-only link entries are skipped on purpose) and that the R2 credentials on the bot host are valid (`GET` on the object). The bot pauses after 30 s with no humans in the channel and resumes when someone joins. Discord sometimes drops voice UDP after a region move; the bot reconnects with backoff (2 s to 60 s, 10 attempts) and then waits for a human to join the home channel.
- **CEO console shows "offline"** while Discord shows it present: the heartbeat writes `bot_last_seen_at` every 30 s (`BOT_HEARTBEAT_MS`); the console treats 3 missed beats as offline. Usually the bot lost its database connection (Neon direct URL, connection limit). Restart it.
- **Notices not arriving in Discord**: the worker, not the bot, sends inactivity and purge DMs and channel posts, over REST with `DISCORD_BOT_TOKEN`. Rows in `notifications` with `channel = discord_dm` and `status = failed` (error 50007) mean the Owner has DMs closed; `discord_channel` failures mean `notice_text_channel_id` is unset, deleted, or the bot cannot post there. Email still goes out.

## DMCA takedown

1. A notice arrives through `/dmca` (row in `dmca_notices`, status `received`) or by email to the registered agent address.
2. Verify it has the §512(c)(3) elements (identification of the work, the URL, contact details, good-faith and accuracy statements, signature). Incomplete notices get a reply asking for the missing parts; status `rejected` if they never arrive.
3. Act expeditiously: in the CEO console (`/ceo/dmca`) disable the track (playback and download stop; the object stays for a possible counter-notice) and block its `sha256` (`blocked_hashes`), which also stops the same content being re-uploaded or re-extracted in any workspace; notify the uploader (their email from `users`) with a copy of the notice; set status `actioned`. Audit rows: `ceo.track.disable`, `ceo.dmca.action`.
4. Counter-notice: forward to the claimant; if they do not file suit within 10–14 business days, restore the track (`ready`, remove the hash) and set status `restored` (`ceo.track.restore`, `ceo.dmca.status`). Otherwise it stays disabled.
5. Repeat infringers: three actioned notices against the same uploader triggers the policy in the Terms (ban the user from the console, which records the reason).
6. Keep the agent registration current at copyright.gov (renew every 3 years) and `DMCA_AGENT_*` matching it. Because the link extractor is on by default, expect more notices than an upload-only service would get; the attestation and hash blocking are the mitigations, not a substitute for responding.

## Restore from Neon point-in-time recovery

Neon keeps a history window (7 days by default on paid plans, less on free). Restoring creates a **new branch** at a timestamp; it does not overwrite production until you switch to it.

1. Stop the writers so the restored state does not diverge further: scale the bot and every worker instance (including the residential one) to 0; put the web app in maintenance (`maintenance_banner` flag, or pause the Vercel deployment).
2. Neon console → project → **Branches → Restore** (or "Create branch from timestamp") → pick a time just before the incident. This creates a branch with its own connection strings.
3. Verify on the branch with the SQL editor: does the missing workspace/playlist exist there? Are `stripe_events` and recent `audit_logs` present?
4. Decide the restore scope:
   - **Whole database**: use Neon's "Restore branch" on `main` to reset it to the timestamp (the console offers a preview branch first). Everything written after the timestamp is lost, including Stripe webhook records; Stripe will resend nothing automatically, so reconcile subscriptions by hand from the Stripe dashboard.
   - **A few rows**: copy them from the restored branch to production with `pg_dump --data-only -t <table>` against the branch URL and `psql` against production, or `INSERT … SELECT` over `dblink` if enabled. Respect foreign-key order (`workspaces` → `roles` → `memberships` → `playlists` → `tracks` → `playlist_tracks`).
5. Storage is **not** covered by PITR. Restored `tracks` rows may point at objects that were deleted (purge, reconcile). Run `reconcile-storage` afterwards; where an object is missing, disable or delete the row rather than leaving a track that cannot play.
6. pg-boss tables live in the same database (`pgboss` schema). A restore also rewinds the queue; expired or duplicate jobs are harmless because every consumer is idempotent, but check for a resurrected `purge-workspace` job before you turn the workers back on:

   ```sql
   select id, data, state from pgboss.job where name = 'purge-workspace' and state in ('created','retry','active');
   ```

7. Bring the workers back, then the bot, then clear the maintenance banner. Write down what happened in the audit log (`ceo.restore`) so the timeline is visible later.

## Monitoring

Minimum viable set:

- **Errors**: Sentry (free tier) in all three processes. In the web app use `@sentry/nextjs`; in the bot and worker the Node SDK with `pino` breadcrumbs. Tag events with `workspaceId` and `guildId`, never with tokens. (Not yet wired; the processes log JSON with pino.)
- **Uptime and heartbeats**: Better Stack (or Cronitor / Healthchecks.io). Heartbeat monitors: the bot writes `bot_last_seen_at` every 30 s (alert on the `/ceo/bot` "offline" count), the worker logs a `heartbeat` line every 60 s, and `inactivity-sweep` logs `inactivity sweep done` daily. An HTTP monitor on `https://ume.app/` every minute.
- **Logs**: Railway/Fly log drains into Better Stack Logs (pino JSON parses cleanly). Keep `LOG_LEVEL=info` in production; `debug` prints per-job and per-packet detail. The residential extractor's logs live wherever it runs; ship them too or at least rotate them.
- **Queue health**: a small dashboard query on `pgboss.job` grouped by `name, state`. Alert when `failed` grows or when `created` for `transcode-upload` or `extract-link` is older than 10 minutes (a worker stalled, or nobody consumes the queue).
- **Extraction health**: `select date_trunc('day', updated_at) d, status, count(*) from tracks where source = 'link' group by 1, 2 order by 1 desc;`. A jump in `failed` with the sign-in message means the extractor's IP got blocked.
- **Business**: the CEO console overview (workspaces by status, storage total, paid count, bot online count) is the daily glance. Stripe's own dashboard covers revenue and failed payments; enable its email alerts.
- **Discord**: subscribe to the [Discord status page](https://discordstatus.com) for voice region incidents; most "bot is broken" reports during those windows are not yours.
- **Vercel**: turn on deployment notifications for failed builds.

## Cost expectations

Launch scale (tens of servers, a few paid) fits comfortably in free and hobby tiers:

| Item                                | Expected monthly cost                                            | Notes                                                                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel (web)                        | $0 Hobby, $20 Pro when you need team seats or more function time | Server actions and route handlers are light; audio bypasses Vercel entirely.                                                                                                      |
| Railway or Fly (bot + cloud worker) | $5–15                                                            | Two small always-on containers (512 MB bot, 512 MB–1 GB worker). This is the real per-instance cost referenced in the plan (~$0.30–1 per active server-month at current density). |
| Residential extractor               | $0–10 in electricity, or a small VPS on a residential ISP        | A Mac mini or NAS you already own is the cheapest option; Cobalt on the same box costs nothing extra.                                                                             |
| Neon                                | $0 free tier → $19 Launch                                        | Free tier sleeps compute after inactivity, which adds a cold-start to the first query; Launch keeps it warm and extends PITR.                                                     |
| Cloudflare R2                       | ~$0.015 per GB-month + $0 egress                                 | 100 paid workspaces at 5 GB average ≈ $7.50. Class A/B operations are negligible at this scale.                                                                                   |
| Resend                              | $0 (3,000 emails/month) → $20                                    | Notices are rare; invites dominate.                                                                                                                                               |
| Stripe                              | 2.9 % + $0.30 per charge                                         | A $4 plan nets ≈ $3.58.                                                                                                                                                           |
| Domain + DMCA agent                 | ~$15/yr + $6 per 3 yrs                                           |                                                                                                                                                                                   |

Rule of thumb: revenue from one Plus subscriber covers the storage of roughly 250 GB, so the constraint is hosting per active bot instance, extractor upkeep and support time, not bytes. Watch three numbers monthly: Railway/Fly spend per claimed server, R2 GB per paid workspace, and the link `failed` rate.
