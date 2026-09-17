# @ume/bot

The Discord half of Ume: a discord.js 14 gateway process that lives in one voice channel
per server 24/7, streams the workspace's stored Opus tracks with zero transcoding, and
exposes the command set in `@ume/shared` (`packages/shared/src/commands.ts`) as slash
commands with `~` as an alias. It talks to Postgres (Drizzle + pg-boss for enqueueing),
object storage (R2/S3, read-only) and Resend (token-rotation email). No HTTP server.

## Environment

Read from the repo-root `.env` in development (`--env-file`) and from the platform in production.

| Variable                                                                            | Required        | Notes                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DISCORD_BOT_TOKEN`                                                                 | yes             | Bot token from the Developer Portal. Never log it.                                                                                                                                                                                       |
| `DISCORD_CLIENT_ID`                                                                 | yes             | Application id; used by `register` and for the invite URL printed at boot.                                                                                                                                                               |
| `DISCORD_MESSAGE_CONTENT_INTENT`                                                    | default `false` | `true` only after you enable Message Content in the portal. Turns `~` commands on in server channels; DMs always work.                                                                                                                   |
| `DISCORD_DEV_GUILD_ID`                                                              | dev only        | `register` writes commands to this guild (instant) instead of globally (up to an hour).                                                                                                                                                  |
| `DATABASE_URL_DIRECT` (or `DATABASE_URL`)                                           | yes             | Long-lived process: prefer the direct, non-pooled URL. pg-boss uses the same database.                                                                                                                                                   |
| `APP_URL`                                                                           | yes             | Dashboard links (`/app/<umeId>`), the claim page and the embed artwork (`/brand/ume-artwork.png`).                                                                                                                                       |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` | for playback    | The bot only reads (`GET` on `ws/<workspaceId>/tracks/<trackId>.opus`). Loaded lazily on first play.                                                                                                                                     |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                      | for `/reload`   | Emails the previous Owner when a token rotation disconnects their workspace. Dry-run to stdout without a key outside production; in production the send fails with `email_not_configured` and is logged (the Discord DM still goes out). |
| `NEXT_PUBLIC_DISCORD_SUPPORT_INVITE`                                                | optional        | Shown in some error replies.                                                                                                                                                                                                             |
| `LOG_LEVEL`                                                                         | default `info`  | pino level. Pretty output outside production, JSON in production.                                                                                                                                                                        |

## Running locally

```bash
pnpm --filter @ume/bot register     # PUT the slash commands (idempotent; guild-scoped with DISCORD_DEV_GUILD_ID)
pnpm --filter @ume/bot dev          # tsx watch, reads ../../.env
pnpm --filter @ume/bot typecheck
pnpm --filter @ume/bot build && pnpm --filter @ume/bot start
```

Run **one** instance per token. Discord allows one gateway session per shard and two
processes fight over the voice connection.

## Intents and permissions

Gateway intents: `Guilds`, `GuildVoiceStates`, `GuildMessages`, `DirectMessages`, plus
`MessageContent` only when `DISCORD_MESSAGE_CONTENT_INTENT=true`. `Partials.Channel` is
enabled so DM messages arrive (DM channels are not cached).

Install with the URL from `botInviteUrl()` in `@ume/shared` (scopes `bot applications.commands`,
permissions integer `281477395860480`, exported as `BOT_INVITE_PERMISSIONS`). The bot asks for
**View Channels, Send Messages, Embed Links, Read Message History, Connect, Speak, Manage
Roles, Use Application Commands** and **Set Voice Channel Status**. It never asks for
Administrator or Manage Channels.

- **Manage Roles** exists for one thing: when the home voice channel (or a role Ume holds)
  denies it View Channel, Connect, Speak or Set Voice Channel Status, Ume merges a _member_
  permission overwrite for its own user in that channel that allows the missing ones (audit
  log reason "Ume: allow itself to play in its home channel"). It only allows permissions it
  already holds at server level, never denies anything, and never edits role or other
  members' overwrites. This runs before every join: `/home`, a home change saved on the web,
  startup and reconnects, and being dragged to another channel. Each grant is logged and
  audit-logged as `bot.voice_permissions_granted`.
- If Ume still lacks View Channel, Connect or Speak (no Manage Roles there, or Discord refused),
  joining fails with a "Missing voice permissions" card that names what is missing and gives
  admins two fixes: re-invite with the updated link (`botInviteUrl(clientId, guildId)`), or add
  Ume as a member in the channel's permissions with Connect and Speak allowed. `/home` and
  `/play` reply with it; background joins post it in the notice channel at most every 6 hours.
- Without Set Voice Channel Status the status line is skipped silently; playback still works.

## Commands

Every command exists twice: `/name` (primary) and `~name` (alias). The list, options,
scopes and required capabilities are generated from `COMMANDS` in `@ume/shared`, so the
marketing site, the registrar and the router never drift.

| Command                               | Where                    | Who                                                           | What                                                                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------- | ------------------------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/reload [server]`                    | server (ephemeral) or DM | server owner / Administrator                                  | Issues a fresh single-use Ume token, disconnects the current workspace, emails + DMs the previous Owner. A DM copy is sent when run in a server.                                                                                                                                                                                                                                  |
| `/reset [server]`, `/purge [server]`  | server or DM             | server owner or workspace Owner                               | Explains the consequences and mints a 6-character code (5 minutes).                                                                                                                                                                                                                                                                                                               |
| `/confirm <code>`                     | server or DM             | whoever requested it, the server owner or the workspace Owner | Consumes the code. Reset removes every member except the Owner, revokes invites and tokens and disconnects. Purge stops playback, marks the workspace `purging` and enqueues `purge-workspace`.                                                                                                                                                                                   |
| `/home [channel]`                     | server                   | Manage settings (or server admin)                             | Sets the 24/7 voice channel (defaults to yours), allows itself View/Connect/Speak there if needed, joins.                                                                                                                                                                                                                                                                         |
| `/add <playlist> <url>`               | server                   | Add music                                                     | Adds a song from a link (YouTube, SoundCloud, Bandcamp, Audius, Mixcloud, Vimeo, Internet Archive, direct file). Same song in two playlists is one track. Queues the worker's `extract-link` job when the global `link_extract` flag, the server switch and the Owner's rights attestation all allow it; otherwise the entry is link-only and the reply says who can change that. |
| `/playlists`                          | server                   | View library                                                  | Playlists with track counts and durations.                                                                                                                                                                                                                                                                                                                                        |
| `/play <query>`                       | server                   | Control playback                                              | Playlist name (shuffled, looping; link-only entries skipped with a note) or a track-title search.                                                                                                                                                                                                                                                                                 |
| `/pause`, `/resume`, `/skip`, `/stop` | server                   | Control playback                                              | Playback control. `/stop` clears the queue but stays in the channel.                                                                                                                                                                                                                                                                                                              |
| `/queue`, `/np`                       | server                   | View library                                                  | Up next; what is playing and who added it.                                                                                                                                                                                                                                                                                                                                        |
| `/status`                             | server                   | View library                                                  | Status, Ume id, channel, storage vs quota, tracks, last activity, days until auto-purge, pending token.                                                                                                                                                                                                                                                                           |
| `/link`, `/help`                      | server or DM             | anyone                                                        | Dashboard link; the commands you can use where you are.                                                                                                                                                                                                                                                                                                                           |

Authorization runs in the router before any command: server commands resolve the caller's
workspace access via `resolveDiscordAccess` (linked Discord account -> membership -> role
capabilities, falling back to the workspace default role); the server owner and
Administrators bypass capability checks for their own server. `requiresGuildAdmin`
commands need owner/Administrator; `requiresOwner` commands need the server owner or the
web user who owns the workspace. In DMs the target server is inferred from the servers
you own, up to 25 shared servers where you hold Administrator, and workspaces you own on
the web — with a select menu when several match. `guild.ownerId` is re-read at issuance.

## How voice works

- On ready the bot joins every workspace with `bot_in_guild` and a home channel, 250 ms
  apart, self-deafened. A heartbeat writes `bot_last_seen_at` every `BOT_HEARTBEAT_MS` and
  picks up a home channel changed in web Settings (a DB row only wins when it is newer than
  the bot's own last home change). Homes that failed to join are retried every 10 minutes.
- Disconnects race `entersState(Signalling|Connecting, 5 s)` (a channel move or voice
  server switch recovers by itself); otherwise it rejoins with exponential backoff
  2 s -> 60 s for 10 attempts, then waits for a human to join the home channel.
- Dragging the bot to another channel makes that channel home (persisted, audit-logged as
  `bot.moved`, announced in the notice channel). Deleting the home channel clears it and
  asks for `/home`.
- Empty room for 30 s pauses playback; the first human back resumes it or restarts the last
  playlist if the player was idle. A human joining the home channel counts as activity
  (`voice_join`, at most once a minute per server).
- Playback streams `getObjectStream(storageKey)` as `StreamType.OggOpus` with no inline
  volume: no decoding, no ffmpeg. A playlist reshuffles and loops forever. Errors skip the
  track. Plays bump `play_count` and touch activity at most every 5 minutes.
- Now playing, per server (the voice tile always shows the bot avatar: bots cannot stream
  video, and per-song avatar changes are rate limited):
  - the voice channel status reads `▶ Title — Artist` (500 chars max), `⏸ Title — Artist`
    while paused, and is cleared on `/stop` or when the queue ends;
  - one now-playing card (title, artist, album, cover art, playlist, added by, length, up
    next, and "started … · ends …" as live Discord timestamps) goes to the home voice
    channel's text chat, or the notice channel when Ume cannot post there. It is edited in
    place while it is the latest message, otherwise re-posted and the old one deleted. `/stop`
    marks it stopped. Writes are coalesced to at most one every 5 s per server; there are no
    progress edits. Covers use `tracks.cover_url`, else a public or 7-day presigned URL for
    `cover_storage_key`. Missing permissions are skipped silently.
  - The global presence is shared by every server, so it never names a song: "Listening to
    music in N servers · /help" (or "/help · ume"), refreshed every 5 minutes.
- Joining a server flips `bot_in_guild` if a workspace exists, otherwise posts a welcome
  in the system channel; never creates a row. Leaving clears presence and destroys the
  voice connection.

## Docker

Build from the repository root so the workspace packages are in the context:

```bash
docker build -f apps/bot/Dockerfile -t ume-bot .
docker run --env-file .env ume-bot
```

`node:22-bookworm-slim` with pnpm, tsup bundle, no ffmpeg. The start command sleeps 30 s
after a crash so a restart loop cannot exhaust Discord's daily IDENTIFY budget.
