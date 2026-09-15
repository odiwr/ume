# @ume/worker

The background process behind Ume. It turns uploads into normalized Opus, adds songs from
links (YouTube, SoundCloud, Bandcamp, Audius, Mixcloud, Vimeo, Internet Archive, direct
audio files), sends inactivity notices, purges workspaces and keeps the storage counters
honest. It is a single Node 22 process that talks to Postgres (through pg-boss and Drizzle),
object storage (R2/S3), Resend and the Discord REST API. No Redis, no gateway connection.

## Environment

Read from the repo-root `.env` in development (`--env-file`) and from the platform in production.

| Variable | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` / `DATABASE_URL_DIRECT` | yes | pg-boss and Drizzle. The direct (non-pooled) URL is preferred for this long-lived process. pg-boss keeps its tables in the `pgboss` schema. |
| `WORKER_QUEUES` | no | Comma list of queues this instance consumes; empty = all. See "Running the extractor elsewhere". |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_PUBLIC_BASE_URL` | for media jobs | Same object store the web app presigns uploads to. Loaded lazily, so cron-only instances boot without it. |
| `EXTRACTOR_PROVIDER` | default `ytdlp` | `ytdlp` runs a local binary; `cobalt` calls a self-hosted [Cobalt](https://github.com/imputnet/cobalt) API. |
| `YTDLP_PATH`, `YTDLP_COOKIES`, `YTDLP_EXTRA_ARGS` | provider `ytdlp` | Binary path, optional Netscape cookies file, extra argv appended before the URL (whitespace-split, quotes honoured), e.g. a PO-token provider or `--extractor-args`. |
| `COBALT_API_URL`, `COBALT_API_KEY` | provider `cobalt` | Base URL of your Cobalt instance and its `Api-Key` (sent as `Authorization: Api-Key …`). |
| `FFMPEG_PATH` | default `ffmpeg` | Must be built with libopus. `ffprobe` is expected next to it (`FFPROBE_PATH` overrides). |
| `DISCORD_BOT_TOKEN` | for notices | Used for DMs / channel posts via REST. Without it Discord notices are recorded as `failed`. |
| `RESEND_API_KEY`, `EMAIL_FROM` | for email | Without a key emails are printed to stdout (dry run). |
| `APP_URL` | yes | Builds the dashboard links in notices (`/app/<umeId>`). |
| `LOG_LEVEL` | default `info` | pino level. Pretty output on a TTY, JSON otherwise. |

## Running locally

```bash
pnpm dev:worker                       # tsx watch, reads ../../.env
pnpm --filter @ume/worker typecheck
pnpm --filter @ume/worker build && pnpm --filter @ume/worker start
```

You need `ffmpeg`/`ffprobe` on `PATH` (`brew install ffmpeg`) and, for link extraction,
`yt-dlp` (`brew install yt-dlp`) or a Cobalt instance. The worker logs a heartbeat every
60 s with memory and uptime so a platform health check can tail the logs.

## How the queue works

pg-boss stores jobs in Postgres and uses `SKIP LOCKED` for exactly-once delivery. The web
app and the bot enqueue with `boss.send(name, payload, JOB_OPTIONS[name])`; worker
instances consume. Queue names, payload types and retry policies live in `@ume/shared`
(`packages/shared/src/jobs.ts`). On boot every instance creates every queue (idempotent),
then registers one pg-boss worker per queue it consumes, batch size 1:

| Queue | Concurrency | What it does |
| --- | --- | --- |
| `transcode-upload` | 2 | Downloads the original, checks magic bytes and streams (audio only, no video), hashes it (blocklist + per-workspace dedupe), reads tags, transcodes to 128 kbps stereo Opus with `loudnorm`, extracts a cover, checks the quota, uploads, deletes the original. |
| `extract-link` | 1 | With `link_extract` (global) or the workspace switch off, the track stays a **metadata-only** entry. Otherwise the provider fetches the audio (30 min / 200 MB / 6 min caps), a thumbnail becomes the cover, and the file goes through the same transcode path as an upload. Private / removed / age-restricted / sign-in-required items fail permanently with a plain reason; network errors retry. |
| `purge-workspace` | 1 | Only from status `purging` (the inactivity sweep may set it). Deletes the `ws/<id>/` storage prefix, then tracks, playlists, members, invites, role maps, tokens, confirmations and activity (audit log and notification history stay). Leaves a `purged` tombstone, writes an audit row and notifies the owner by email and Discord. Idempotent. |
| `inactivity-sweep` | 1 | Free-plan workspaces only. 30-day notice, 48-hour final notice, then flips the workspace to `purging` and enqueues `purge-workspace`. Skipped when `auto_purge_enabled` is off. Logs counts. |
| `reconcile-storage` | 1 | Recomputes `storage_used_bytes` / track counts and playlist counters for every workspace, deletes uploads stuck in `pending` for 24 h, fails `processing` rows older than 6 h. |
| `expire-things` | 1 | Removes expired temporary memberships and revokes expired invites. |
| `send-email` | 1 | Sends one transactional email and records a `notifications` row. |

Failures are classified: content problems (bad file, too long, blocked hash, over quota,
private item) mark the track `failed` with a short user-facing message and are **not**
retried; infrastructure problems (storage, network, a missing binary, a busy site) put the
track back to `pending` and let pg-boss retry with backoff (`JOB_OPTIONS`). Every job that
touches disk works in its own directory under `$TMPDIR/ume/`, which is always removed.

## Cron schedule (UTC)

| Job | Cron |
| --- | --- |
| `inactivity-sweep` | `15 3 * * *` (daily 03:15) |
| `reconcile-storage` | `15 4 * * *` (daily 04:15) |
| `expire-things` | `0 * * * *` (hourly) |

An instance registers a schedule only for queues it consumes. Schedules are stored by
pg-boss in the database and re-applied on every boot, so running several instances is safe
(only one cron job fires per tick).

## Running the extractor elsewhere

yt-dlp is routinely blocked from datacenter IP ranges ("Sign in to confirm you're not a
bot"). The fix is to run the extraction queue from a residential connection and everything
else in the cloud:

```
# cloud instance (Railway / Fly): everything except link extraction
WORKER_QUEUES=transcode-upload,purge-workspace,inactivity-sweep,reconcile-storage,expire-things,send-email

# home box / Raspberry Pi / small VPS on a residential ISP: only link extraction
WORKER_QUEUES=extract-link
EXTRACTOR_PROVIDER=ytdlp
YTDLP_COOKIES=/data/cookies.txt          # optional, from a logged-in browser session
```

Both instances point at the same `DATABASE_URL` and the same bucket; pg-boss hands each
queue to whichever instance consumes it. Alternatively keep one cloud worker and set
`EXTRACTOR_PROVIDER=cobalt` with `COBALT_API_URL` pointing at a Cobalt instance you host on
a residential connection; the worker then downloads the audio Cobalt tunnels back and
fills in metadata from the site's oEmbed endpoint.

## YouTube — read this

The `link_extract` flag is **on by default** (founder decision, 2026-09-15) and the worker
logs a warning at startup whenever it is on. Downloading YouTube audio is against YouTube's
Terms of Service and is what got Groovy and Rythm shut down in 2021. Ume ships it as "add a
song from a link" with these guardrails: the Owner accepts a rights attestation before the
first extraction, every stored file is hashed and takedowns block the hash everywhere, the
extractor sits behind a provider interface that can run off-datacenter, and the CEO console
can turn the flag off at any time (existing and new links then become metadata-only
entries). Never describe the feature as a converter.

## Docker

Build from the repository root so the workspace packages are in the context:

```bash
docker build -f apps/worker/Dockerfile -t ume-worker .
docker run --env-file .env ume-worker
docker run --env-file .env -e WORKER_QUEUES=extract-link ume-worker   # extractor-only instance
```

The image installs `ffmpeg`, `python3`, `curl` and the latest `yt-dlp` release, bundles the
worker with tsup and runs `node apps/worker/dist/index.js` as the unprivileged `node` user.
