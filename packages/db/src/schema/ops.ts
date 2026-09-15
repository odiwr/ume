import { boolean, index, jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { tracks } from './library'
import { users } from './auth'
import { workspaces } from './workspaces'

export const activityKindEnum = pgEnum('activity_kind', [
  'voice_join',
  'voice_leave',
  'command',
  'play',
  'web_action',
  'bot_moved',
])

/** Raw activity feed. `workspaces.last_activity_at` is the denormalized summary used by the purge sweep. */
export const activityEvents = pgTable(
  'activity_events',
  {
    id: text('id').primaryKey(), // act_...
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: activityKindEnum('kind').notNull(),
    discordUserId: text('discord_user_id'),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('activity_events_workspace_created_idx').on(t.workspaceId, t.createdAt)],
)

/** Who did what. Workspace-scoped rows show in the dashboard; global rows (null workspace) in the CEO console. */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: text('id').primaryKey(), // aud_...
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    actorDiscordId: text('actor_discord_id'),
    /** e.g. workspace.claim, token.rotate, playlist.create, track.delete, invite.create, purge.confirm, ceo.flag.update */
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_workspace_created_idx').on(t.workspaceId, t.createdAt),
    index('audit_logs_action_idx').on(t.action),
  ],
)

/** Global kill-switches editable from the CEO console. */
export const featureFlags = pgTable('feature_flags', {
  key: text('key').primaryKey(), // link_extract, signups_open, uploads_enabled, auto_purge_enabled, maintenance_banner
  enabled: boolean('enabled').notNull().default(false),
  value: jsonb('value').$type<Record<string, unknown>>().notNull().default({}),
  description: text('description'),
  updatedByUserId: text('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const notificationKindEnum = pgEnum('notification_kind', [
  'inactivity_30d',
  'inactivity_48h',
  'purged',
  'token_rotated',
  'invite',
  'quota_warning',
])

export const notificationChannelEnum = pgEnum('notification_channel', ['email', 'discord_dm', 'discord_channel'])

/** Outbound notifications, for the CEO console and for idempotency. */
export const notifications = pgTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    kind: notificationKindEnum('kind').notNull(),
    channel: notificationChannelEnum('channel').notNull(),
    recipient: text('recipient').notNull(),
    status: text('status').notNull().default('sent'), // sent | failed | skipped
    error: text('error'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('notifications_workspace_kind_idx').on(t.workspaceId, t.kind)],
)

export type ActivityEvent = typeof activityEvents.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
export type FeatureFlag = typeof featureFlags.$inferSelect
export type Notification = typeof notifications.$inferSelect

/** Stripe webhook idempotency: insert first, skip on conflict. */
export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(), // evt_...
  type: text('type').notNull(),
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
})

/** Content hashes that may never be (re)uploaded — set by a takedown. */
export const blockedHashes = pgTable('blocked_hashes', {
  sha256: text('sha256').primaryKey(),
  reason: text('reason'),
  createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const dmcaStatusEnum = pgEnum('dmca_status', ['received', 'actioned', 'counter_noticed', 'restored', 'rejected'])

/** 17 U.S.C. 512(c)(3) takedown notices submitted through /dmca. */
export const dmcaNotices = pgTable(
  'dmca_notices',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    trackId: text('track_id').references(() => tracks.id, { onDelete: 'set null' }),
    claimantName: text('claimant_name').notNull(),
    claimantEmail: text('claimant_email').notNull(),
    claimantAddress: text('claimant_address'),
    workDescription: text('work_description').notNull(),
    infringingUrl: text('infringing_url').notNull(),
    goodFaithStatement: boolean('good_faith_statement').notNull().default(false),
    accuracyStatement: boolean('accuracy_statement').notNull().default(false),
    signature: text('signature').notNull(),
    status: dmcaStatusEnum('status').notNull().default('received'),
    notes: text('notes'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('dmca_notices_status_idx').on(t.status)],
)

export type StripeEvent = typeof stripeEvents.$inferSelect
export type BlockedHash = typeof blockedHashes.$inferSelect
export type DmcaNotice = typeof dmcaNotices.$inferSelect
