# @ume/db

Drizzle ORM schema, relations, migrations and query helpers for Postgres. Imported by all three apps; nothing else talks to the database.

```ts
import { getDb, getAccess, can, claimToken, logAudit, workspaces } from '@ume/db'
import { CAP } from '@ume/shared'

const db = getDb() // one pool per process; reads DATABASE_URL by default
const access = await getAccess(db, workspaceId, userId)
if (!can(access, CAP.ADD_TRACK)) throw new Error('Forbidden')
```

`getDb(url?)` caches a single `postgres` pool per process (`max: 3` on Vercel, `10` elsewhere, `prepare: false` for PgBouncer/Neon pooling). Long-lived processes should pass `directDatabaseUrl()` from `@ume/shared`. `closeDb()` drains it on shutdown.

## Three ids for one server

| Column | Example | Meaning |
| --- | --- | --- |
| `workspaces.id` | `ws_01JXYZ…` | Internal primary key. Foreign keys, job payloads, storage prefix `ws/<id>/`. Never shown to users. |
| `workspaces.ume_id` | `ume-01jxyz…-abcd1234` | **Public workspace id.** Appears in URLs (`/app/<umeId>`), Settings and support tickets. Opaque and unguessable, but not a secret: knowing it grants nothing. Resolve with `getWorkspaceByUmeId()`. |
| `workspaces.guild_id` | `123456789012345678` | **Discord server id** (snowflake). Unique per workspace; the bot keys everything by it (`getWorkspaceByGuildId()`, `resolveDiscordAccess()`). Public on Discord. |

Web routes take a `umeId` and resolve it once in the layout; server actions then pass the internal `id` around. The bot only ever sees `guild_id`. A purged workspace keeps its row (tombstone) for 30 days, so a guild can have at most one live workspace and the unique index on `guild_id` holds.

## Schema overview

Files under `src/schema/`; `relations.ts` wires them for `db.query.*`.

### `auth.ts` — Better Auth core tables

`users`, `sessions`, `accounts`, `verifications`. Column keys match Better Auth's field names (`usePlural: true`); snake_case column names are ours. `users` carries the Ume additions `discord_user_id` (unique, set from OAuth `identify`), `discord_username`, `discord_avatar`, `banned`, `ban_reason`.

### `workspaces.ts` — servers, access, invites

| Table | Purpose |
| --- | --- |
| `workspaces` | One per guild. `status` (`unclaimed` → `connected` ⇄ `disconnected` → `purging` → `purged`), owner, bot presence (`home_voice_channel_id`, `bot_connected`, `bot_last_seen_at`), activity + notice stamps, plan/quota/usage, Stripe ids, settings (`discord_role_sync_enabled`, `default_role_id`, `youtube_enabled`). |
| `claim_tokens` | `/reload` tokens: `token_hash` only (SHA-256), guild, who it was issued to, `expires_at` (24 h), `claimed_at`, `revoked_at`. Single use. |
| `roles` | Capability bitmask per role; `system_key` (`owner`/`master`/`servant`/`peon`) marks the four defaults, unique per workspace. |
| `memberships` | `(workspace_id, user_id)` unique; `role_id`, `source`, optional `expires_at`. |
| `discord_role_maps` | Discord role id → Ume role. |
| `invites` | `kind` link/email, clear `token` (it is the URL), bound `email`, role, `max_uses`/`uses`, `expires_at`, `membership_expires_at`, `require_guild_member`, `revoked_at`. |
| `danger_confirmations` | Pending `reset`/`purge` codes (`code_hash`, 5-minute TTL, `consumed_at`). |

### `library.ts` — music

| Table | Purpose |
| --- | --- |
| `playlists` | Flat, root-only. `(workspace_id, slug)` unique; denormalized `track_count`, `total_duration_ms`; optional cover/emoji/color. |
| `tracks` | `source` upload/youtube; `status` pending → processing → ready / failed / disabled. Metadata, `storage_key` (Opus), `original_*` (deleted after transcode), `size_bytes` (counts against quota), `sha256`, `youtube_*`, provenance (`uploaded_by_user_id`/`_discord_id`, `added_via`). Unique per workspace on `sha256` and on `youtube_id`. |
| `playlist_tracks` | Track membership in a playlist with `added_by_*`, `added_via`, `position`. A track can sit in many playlists. |

### `ops.ts` — operational

`activity_events` (raw feed; `workspaces.last_activity_at` is the summary the sweep reads), `audit_logs` (every privileged action; `workspace_id` null = global/CEO), `feature_flags` (`youtube_ingest`, `uploads_enabled`, `signups_open`, `auto_purge_enabled`, `maintenance_banner`; defaults in `queries/flags.ts`), `notifications` (outbound email/DM/channel messages, for idempotency and the console), `stripe_events` (webhook idempotency), `blocked_hashes`, `dmca_notices`.

All timestamps are `timestamptz`. Ids are prefixed ULIDs from `newId()` except Better Auth tables (uuid) and `feature_flags`/`blocked_hashes` (natural keys).

## Query helpers (`src/queries/`)

| File | Exports |
| --- | --- |
| `workspaces.ts` | `getWorkspaceByGuildId` / `ById` / `ByUmeId`, `effectiveQuotaBytes`, `ensureDefaultRoles`, `setWorkspaceOwner`, `touchActivity`, `setBotPresence` |
| `access.ts` | `getAccess(db, workspaceId, userId)` → `{ workspace, membership, role, caps, isOwner }`, `can(access, cap)`, `resolveDiscordAccess(db, guildId, discordUserId)`, `removeAllMembersExceptOwner` |
| `tokens.ts` | `issueClaimToken`, `claimToken` (returns `{ ok, workspace, becameOwner }` or `{ ok: false, error }`), `getLiveTokenMeta` |
| `flags.ts` | `FLAG_DEFAULTS`, `getFlag`, `getAllFlags`, `setFlag` |
| `audit.ts` | `logAudit` |
| `library.ts` | `recountPlaylist`, `recomputeWorkspaceUsage`, `listPlaylistTracks` |

`getAccess()` strips capabilities on non-`connected` workspaces down to view + settings + billing + danger zone; callers do not need to special-case status.

## Migration workflow

Drizzle Kit reads `drizzle.config.ts` (`schema: src/schema/index.ts`, `out: drizzle/`, `DATABASE_URL`). Scripts are exposed at the repo root.

**Local development** — sync the schema straight from the TypeScript definitions, no migration file:

```bash
pnpm db:push        # drizzle-kit push against DATABASE_URL
pnpm db:studio      # browse data at local.drizzle.studio
```

**Any shared or production database** — generate a migration, review it, commit it, apply it:

```bash
# 1. edit src/schema/*.ts
# 2. write the SQL migration into packages/db/drizzle/
pnpm db:generate
# 3. read the generated .sql — enum changes and NOT NULL additions on populated tables need care
# 4. commit the migration together with the schema change
# 5. apply (uses src/migrate.ts; point DATABASE_URL at the DIRECT Neon URL)
DATABASE_URL="$DATABASE_URL_DIRECT" pnpm db:migrate
```

Rules of thumb:

- Never `db:push` at a database that has migrations applied; the two workflows do not mix.
- Migrations are forward-only. To undo, write another migration.
- Adding an enum value in Postgres is fine; removing or renaming one needs a manual migration (Drizzle generates a drop/recreate that fails on populated columns).
- Additive changes first (new nullable column), backfill, then tighten (NOT NULL) in a later migration, so deploys of web/bot/worker can straddle the change.
- The pg-boss schema (`pgboss.*`) is created and migrated by pg-boss itself on worker start; it is not part of Drizzle's snapshot.
- Run `pnpm db:migrate` before deploying code that depends on the change; the apps do not auto-migrate.

## Adding a table

1. Define it in the right `src/schema/*.ts` file with a prefixed-ULID id (`newId(kind)`; add the prefix to `ID_PREFIX` in `@ume/shared` if it is a new kind).
2. Always include `workspace_id` with `onDelete: 'cascade'` for anything workspace-scoped, and an index on it.
3. Add relations in `src/schema/relations.ts` so `db.query.<table>` works with `with:`.
4. Export types (`$inferSelect` / `$inferInsert`) at the bottom of the file.
5. Put reusable queries in `src/queries/` and export them from `src/queries/index.ts`; app code should call helpers for anything touching authorization.
6. `pnpm db:generate`, review, commit.
