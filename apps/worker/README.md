# @ume/worker

The background process behind Ume: it turns uploads into normalized Opus, fetches
YouTube audio (only when the global flag says so), sends inactivity notices, purges
workspaces and keeps the storage counters honest. It is a single Node 22 process that
talks to Postgres (through pg-boss and Drizzle), object storage (R2/S3), Resend and the
Discord REST API. No Redis, no gateway connection.

## Environment

Read from the repo-root `.env` in development (`--env-file`) and from the platform in production.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` / `DATABASE_URL_DIRECT` | yes | pg-boss and Drizzle. The direct (non-pooled) URL is preferred for this long-lived process. pg-boss keeps its tables in the `pgboss` schema. |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_PUBLIC_BASE_URL` | for media jobs | Same object store the web app presigns uploads to. Loaded lazily, so cron-only deployments boot without it. |
| `DISCORD_BOT_TOKEN` | for notices | Used for DMs / channel posts via REST. Without it Discord notices are recorded as `failed`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Without a key emails are printed to stdout (dry run). |
| `APP_URL` | yes | Builds the dashboard links in notices (`/app/<umeId>`). |
| `FFMPEG_PATH` | default `ffmpeg` | Must be built with libopus. `ffprobe` is expected next to it (`FFPROBE_PATH` overrides). |
| `YTDLP_PATH`, `YTDLP_COOKIES` | only when `link_extract` is on | Binary path and optional cookies file. |
| `LOG_LEVEL` | default `info` | pino level. Pretty output on a TTY, JSON otherwise. |

## Running locally

```bash
pnpm dev:worker            # tsx watch, reads ../../.env
pnpm --filter @ume/worker typecheck
pnpm --filter @ume/worker build && pnpm --filter @ume/worker start
```

You need `ffmpeg`/`ffprobe` on `PATH` (`brew install ffmpeg`). The worker logs a heartbeat
every 60 s with memory and uptime so a platform health check can tail the logs.

## How the queue works

pg-boss stores jobs in Postgres and uses `SKIP LOCKED` for exactly-once delivery, so the
web app and the bot enqueue with `boss.send(name, payload, JOB_OPTIONS[name])` and this
process is the only consumer. Queue names, payload types and retry policies live in
`@ume/shared` (`packages/shared/src/jobs.ts`); the worker creates every queue on boot with
those options, then registers one pg-boss worker per queue with batch size 1:

| Queue | Concurrency | What it does |
| --- | --- | --- |
| `transcode-upload` | 2 | Downloads the original, checks magic bytes and streams, hashes it (blocklist + per-workspace dedupe), reads tags, transcodes to 128 kbps stereo Opus with `loudnorm`, extracts a cover, checks quota, uploads, deletes the original. |
| `extract-link` | 1 | With `link_extract` off (the default) the track stays a **linked** entry. With it on, runs `yt-dlp` (bestaudio, 100 MB and 30 min caps, 5 min timeout) and then the same transcode path. Unavailable/private/age-restricted/sign-in errors fail permanently; network errors retry. |
| `purge-workspace` | 1 | Deletes the `ws/<id>/` storage prefix, then tracks, playlists, members, invites, role maps, tokens, confirmations and activity (audit log and notification history stay). Leaves a `purged` tombstone and notifies the owner. Idempotent. |
| `inactivity-sweep` | 1 | Free workspaces only. 30-day notice, 48-hour final notice, then flips the workspace to `purging` and enqueues `purge-workspace`. Skipped when `auto_purge_enabled` is off. |
| `reconcile-storage` | 1 | Recomputes `storage_used_bytes` / track counts and playlist counters, deletes uploads stuck in `pending` for 24 h, fails `processing` rows older than 6 h. |
| `expire-things` | 1 | Removes expired temporary memberships and revokes expired invites. |
| `send-email` | 1 | Sends one transactional email and records a `notifications` row. |

Failures are classified: validation problems (bad file, too long, blocked hash, over quota)
mark the track `failed` with a short user-facing message and are **not** retried;
infrastructure problems (storage, network, a missing binary) put the track back to
`pending` and let pg-boss retry with backoff (`JOB_OPTIONS`). Every job that touches disk
works in its own directory under `$TMPDIR/ume/` which is always removed.

## Cron schedule (UTC)

| Job | Cron |
| --- | --- |
| `inactivity-sweep` | `15 3 * * *` (daily 03:15) |
| `reconcile-storage` | `15 4 * * *` (daily 04:15) |
| `expire-things` | `0 * * * *` (hourly) |

Schedules are stored by pg-boss in the database and re-applied on every boot, so running
two worker instances is safe (only one cron job fires per tick).

## YouTube — read this before flipping the flag

`link_extract` is **off by default** and the worker logs a warning at startup whenever
it is on. Downloading YouTube audio violates YouTube's Terms of Service, is exactly what
got Groovy and Rythm shut down, and yt-dlp is routinely blocked from datacenter IPs (you
will need `YTDLP_COOKIES` from a residential session at minimum). Ume never advertises
this capability; with the flag off YouTube links still work as metadata-only linked
entries. Flip it only if you accept that risk.

## Docker

Build from the repository root so the workspace packages are in the context:

```bash
docker build -f apps/worker/Dockerfile -t ume-worker .
docker run --env-file .env ume-worker
```

The image installs `ffmpeg`, `python3` and the latest `yt-dlp` release, bundles the
worker with tsup and runs `node apps/worker/dist/index.js` as the unprivileged `node` user.
