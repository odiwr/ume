import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { workspaces } from './workspaces'

/**
 * Buckets are the user-facing "folders". They are root-only: a bucket never
 * contains another bucket, which keeps every algorithm (shuffle, quota, search) flat.
 */
export const buckets = pgTable(
  'buckets',
  {
    id: text('id').primaryKey(), // bkt_...
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    emoji: text('emoji'),
    color: text('color'),
    coverStorageKey: text('cover_storage_key'),
    position: integer('position').notNull().default(0),
    trackCount: integer('track_count').notNull().default(0),
    totalDurationMs: bigint('total_duration_ms', { mode: 'number' }).notNull().default(0),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('buckets_workspace_slug_uq').on(t.workspaceId, t.slug),
    index('buckets_workspace_id_idx').on(t.workspaceId),
  ],
)

export const trackSourceEnum = pgEnum('track_source', ['upload', 'youtube'])
/** `disabled` = taken down (DMCA / abuse); object kept, playback and download blocked. */
export const trackStatusEnum = pgEnum('track_status', ['pending', 'processing', 'ready', 'failed', 'disabled'])
export const addedViaEnum = pgEnum('added_via', ['web', 'discord'])

/**
 * A track is a stored audio asset (normalized Opus) or a linked YouTube video.
 * Tracks are deduplicated per workspace by content hash / YouTube id, and can
 * live in many buckets via bucket_tracks.
 */
export const tracks = pgTable(
  'tracks',
  {
    id: text('id').primaryKey(), // trk_...
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    source: trackSourceEnum('source').notNull(),
    status: trackStatusEnum('status').notNull().default('pending'),

    // --- metadata ---
    title: text('title').notNull(),
    artist: text('artist'),
    album: text('album'),
    durationMs: integer('duration_ms'),
    coverStorageKey: text('cover_storage_key'),
    coverUrl: text('cover_url'),

    // --- storage (uploads, and cached YouTube audio when ingestion is enabled) ---
    /** Key of the normalized Opus file in object storage. */
    storageKey: text('storage_key'),
    /** Key of the original upload; deleted after a successful transcode. */
    originalStorageKey: text('original_storage_key'),
    originalFilename: text('original_filename'),
    originalMimeType: text('original_mime_type'),
    originalSizeBytes: bigint('original_size_bytes', { mode: 'number' }),
    /** Bytes counted against the workspace quota (the Opus output + cover). */
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull().default(0),
    /** SHA-256 of the original upload, for dedupe. */
    sha256: text('sha256'),

    // --- youtube ---
    youtubeId: text('youtube_id'),
    youtubeUrl: text('youtube_url'),
    youtubeChannel: text('youtube_channel'),

    // --- provenance ---
    uploadedByUserId: text('uploaded_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    uploadedByDiscordId: text('uploaded_by_discord_id'),
    addedVia: addedViaEnum('added_via').notNull().default('web'),

    errorMessage: text('error_message'),
    playCount: integer('play_count').notNull().default(0),
    lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('tracks_workspace_id_idx').on(t.workspaceId),
    index('tracks_status_idx').on(t.status),
    uniqueIndex('tracks_workspace_sha256_uq').on(t.workspaceId, t.sha256),
    uniqueIndex('tracks_workspace_youtube_uq').on(t.workspaceId, t.youtubeId),
  ],
)

/** Membership of a track in a bucket, with "added by" for the Spotify-style view. */
export const bucketTracks = pgTable(
  'bucket_tracks',
  {
    id: text('id').primaryKey(), // bt_...
    bucketId: text('bucket_id')
      .notNull()
      .references(() => buckets.id, { onDelete: 'cascade' }),
    trackId: text('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'cascade' }),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    addedByUserId: text('added_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    addedByDiscordId: text('added_by_discord_id'),
    addedVia: addedViaEnum('added_via').notNull().default('web'),
    position: integer('position').notNull().default(0),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('bucket_tracks_uq').on(t.bucketId, t.trackId),
    index('bucket_tracks_track_id_idx').on(t.trackId),
    index('bucket_tracks_workspace_idx').on(t.workspaceId),
  ],
)

export type Bucket = typeof buckets.$inferSelect
export type Track = typeof tracks.$inferSelect
export type NewTrack = typeof tracks.$inferInsert
export type BucketTrack = typeof bucketTracks.$inferSelect
export type TrackStatus = (typeof trackStatusEnum.enumValues)[number]
