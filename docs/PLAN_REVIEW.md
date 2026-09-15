# Ume — plan review and decisions

_Reviewed 2026-09-15 against the founder's original brief. Four independent reviews (Discord platform, legal/business, product/UX, security/architecture) were run and their high-severity claims were checked against current Discord, YouTube, Stripe, Copyright Office and vendor documentation. This document is the synthesis; the code in this repo implements it._

## Verdict

The core idea is strong and differentiated: **a bot that never leaves its channel, a shared server library that members curate under real permissions, and upload-your-own-files.** Nobody else does that well. Four parts of the original plan needed changing, and the code already reflects the changes:

1. **Identity.** "Verify with your Discord account ID" is spoofable (IDs are public). Every account signs in with Discord OAuth instead, which yields a verified ID for free.
2. **Accounts.** Accounts are global with a membership per server, not one account per "Ume bot ID". A curator in three servers has one login.
3. **Commands.** `~` prefix commands in server channels need Discord's privileged Message Content intent. The bot ships **slash commands as the primary interface** and keeps `~` as an alias that always works in DMs and works in servers only while the intent is enabled.
4. **YouTube.** Ripping YouTube audio breaks YouTube's terms and is exactly what got Groovy and Rythm shut down. It is built, but behind a global switch that is **off by default**; YouTube links still work as metadata-only "linked" entries.

Everything else (token lifecycle, three destructive commands, buckets, roles, share links, storage tiers, 60-day auto-purge, CEO console) is kept, with guardrails added.

## Keep

- Bot lives in one voice channel 24/7 and follows when moved (the new channel becomes home).
- The Ume token flow: `~reload` issues a single-use token; entering it on the web claims or reconnects the server; a token can never be reused.
- `~reload` rotates and disconnects (workspace stays, read-only, until the new token is entered); `~reset` removes every member except the Owner; `~purge` deletes everything.
- Buckets are flat (root only). Each bucket shows who added what and when.
- Roles Master / Servant / Peon by default, plus a non-removable Owner.
- Share links and email invites with a role and an expiry date.
- Drag-and-drop uploads with a size limit; monthly storage tiers.
- 60-day inactivity purge with notices at 30 days and 48 hours by email and Discord.
- CEO console gated to one Google account.
- Metadata auto-extracted from files and links.

## Change

| Original | Problem | What the code does instead |
| --- | --- | --- |
| Users type their Discord ID to sync roles | Unverifiable; anyone can type an admin's public ID | Sign in with Discord (OAuth `identify` + `guilds`). The verified ID is stored on the user. |
| One account per Ume bot ID | Multiple logins per person, invite collisions, no role sync | Global accounts + `memberships` (one row per server). Server switcher in the sidebar. |
| All commands use `~` | Guild message content is a privileged intent. Below 10,000 reachable users you can toggle it on; above that Discord reviews it and pushes prefix bots to slash commands. Prefix commands also cannot be hidden from non-admins. | Slash commands everywhere (`/reload`, `/add`, `/play`…), hidden from non-admins with `default_member_permissions`, replies ephemeral. `~` works in DMs always; in servers only when `DISCORD_MESSAGE_CONTENT_INTENT=true`. |
| "Highest members" = owner or admin roles | Role names differ per server | Owner **or** the Administrator permission bit. Re-checked on every privileged command. |
| `~reload [server-name]` in DM | DM has no server context; names collide | Run `/reload` inside the server (guild known). In DMs, Ume infers the server from the servers where you are owner/admin; if several, it asks you to pick. |
| YouTube → mp3 converter as a headline feature | YouTube ToS; C&D precedent; yt-dlp is blocked from datacenter IPs | YouTube links create a **linked** entry (title, artist, thumbnail via oEmbed). Audio extraction only runs when the `youtube_ingest` flag is on in the CEO console, with a warning. Never marketed as a converter. |
| Peon = no permissions | A role that grants nothing is the same as not being a member | Peon = read-only: can browse the library and use playback commands. |
| Reject large files | Discord voice is Opus; storing originals wastes storage | Every upload is transcoded to 128 kbps Opus with loudness normalization; the original is deleted. Bot streams Opus with **zero transcoding** at play time. |
| Exponential price scaling | Marginal cost per GB is flat (R2: $0.015/GB, zero egress) | Four flat tiers with decreasing $/GB. Free 1 GB, Plus $4/10 GB, Pro $12/50 GB, Studio $35/250 GB. |
| Public link for any role | A link is a bearer credential; a leaked Master link hands out delete-all | Links can grant Servant-level roles at most; Master needs an email invite bound to an address. Links require Discord server membership by default. |
| Activity = someone joined the channel | Ignores uploads, edits and commands; curating for a launch would get purged | Activity = a human in the home channel, any command, any playback, any web edit/upload. Paid workspaces are never auto-purged (they downgrade instead). |

## Add

- **Discord role mapping** (`@DJ → Servant`, `@everyone → Peon`). Most servers never need invites.
- **Confirmation codes** for `~reset` and `~purge` (`~confirm K7Q2ZP`), and a typed-server-name Danger Zone on the web.
- **Auto-pause when the channel is empty** (30 s grace); resume when someone joins. Bot stays connected.
- **DMCA**: designated agent page, takedown form, `disabled` track status, blocked content hashes, repeat-infringer policy in the Terms. Register the agent at copyright.gov ($6, renew every 3 years) before launch.
- **Stripe** with webhook idempotency, Checkout + Customer Portal, over-quota = read-only uploads (never deletion).
- **Audit log** for every privileged action, visible per workspace and globally in the CEO console.
- **Discord Team + ToS/Privacy pages** from day one: bot verification at 100 servers requires them.

## Risks you must decide on

| Decision | Recommended default | Why |
| --- | --- | --- |
| YouTube audio extraction | **Off** on the hosted product (flag `youtube_ingest`) | ToS violation, C&D precedent, and yt-dlp needs residential IPs / PO tokens in 2026. Linked entries keep the UX. |
| Message Content intent | **Do not enable**; slash commands only | Avoids the privileged-intent review entirely. Turn it on in the Developer Portal only if you want `~` in servers while small. |
| Purge grace period | Immediate on explicit `~purge` + confirm; auto-purge already has 30-day/48-hour notices | Matches the brief. A 24-hour undo window is a cheap addition later. |
| Bucket naming | "Bucket" (the brand word) | Reviewers preferred "Playlist"; keep yours, but use one word everywhere. |
| Free tier and 24/7 | Free workspaces get 24/7 presence but are purged after 60 idle days | Hosting per active instance (~$0.30–1/month) is the real cost, not storage. |

## Architecture

- **Monorepo** (pnpm + Turborepo): `apps/web` (Next.js 16, App Router), `apps/bot` (discord.js 14 + @discordjs/voice 0.19 with DAVE), `apps/worker` (pg-boss jobs: transcode, YouTube ingest, inactivity sweep, purge), `packages/db` (Drizzle + Postgres), `packages/shared` (roles, tokens, commands, plans), `packages/storage` (R2/S3), `packages/email` (Resend).
- **Auth**: Better Auth with Discord (primary) and Google (CEO console + optional).
- **Queue**: pg-boss on the same Postgres — no Redis to run.
- **Storage**: Cloudflare R2 (zero egress). Direct-to-R2 presigned uploads; the web server never touches audio bytes.
- **Hosting**: web on Vercel; bot + worker on Railway or Fly.io (they build the Dockerfile remotely, so no Docker on your Mac); Postgres on Neon; Resend; Stripe.

### Core tables

| Table | Key columns |
| --- | --- |
| `users` | id, email, discord_user_id (unique), banned |
| `workspaces` | id, ume_id (public), guild_id (unique), owner_user_id, status (unclaimed/connected/disconnected/purging/purged), home_voice_channel_id, last_activity_at, plan, storage_used_bytes, stripe_* |
| `claim_tokens` | token_hash (unique), guild_id, issued_to_discord_id, expires_at, claimed_at, revoked_at |
| `roles` | workspace_id, name, capabilities (bitmask), system_key (owner/master/servant/peon) |
| `memberships` | workspace_id + user_id (unique), role_id, source, expires_at |
| `discord_role_maps` | workspace_id, discord_role_id → role_id |
| `invites` | kind (link/email), token (unique), email, role_id, max_uses, uses, expires_at, membership_expires_at, require_guild_member, revoked_at |
| `buckets` | workspace_id + slug (unique), name, track_count |
| `tracks` | workspace_id, source (upload/youtube), status (pending/processing/ready/failed/disabled), storage_key, sha256, youtube_id, title/artist/album/duration, uploaded_by |
| `bucket_tracks` | bucket_id + track_id (unique), added_by, added_via, position |
| `activity_events`, `audit_logs`, `notifications`, `feature_flags`, `stripe_events`, `blocked_hashes`, `dmca_notices` | operational |

## Command set

| Command | Where | Who | Confirmation |
| --- | --- | --- | --- |
| `/reload` · `~reload [server]` | server (ephemeral) or DM | server owner or Administrator | none; rotates + disconnects |
| `/reset` · `~reset [server]` | server or DM | server owner / workspace Owner | `~confirm CODE` |
| `/purge` · `~purge [server]` | server or DM | server owner / workspace Owner | `~confirm CODE` |
| `/home [channel]` | server | Manage Settings | — |
| `/add bucket url` | server | Add music | — |
| `/play`, `/pause`, `/resume`, `/skip`, `/stop`, `/queue`, `/np` | server | Control playback / View | — |
| `/buckets`, `/status`, `/link`, `/help` | server / DM | View | — |

## MVP cut

**Ship first (in this repo):** Discord sign-in, OAuth server claim + token claim, roles + role mapping, buckets, uploads with Opus transcode + metadata, YouTube linked entries, 24/7 bot with auto-pause, slash + `~` commands, share links + email invites, Stripe tiers, inactivity sweep, CEO console, marketing site, Terms/Privacy/DMCA pages.

**Later:** custom roles UI polish, vanity URLs, 24-hour purge undo, second 256 kbps rendition for boosted servers, Discord Premium Apps SKU parity, sharding (needed at ~2,500 servers).
