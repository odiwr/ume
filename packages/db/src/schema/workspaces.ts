import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { users } from './auth'

/**
 * connected    – a web workspace is linked to the bot and fully usable
 * unclaimed    – the bot issued a token but nobody has claimed it on the web yet
 * disconnected – `~reload` rotated the token; the workspace exists but is read-only
 *                until the new token is entered in Settings
 * purging      – purge confirmed; the worker is deleting storage
 * purged       – tombstone kept for 30 days for support, then hard-deleted
 */
export const workspaceStatusEnum = pgEnum('workspace_status', [
  'unclaimed',
  'connected',
  'disconnected',
  'purging',
  'purged',
])

export const planEnum = pgEnum('plan', ['free', 'plus', 'pro', 'studio'])

/** One workspace per Discord server (guild). */
export const workspaces = pgTable(
  'workspaces',
  {
    id: text('id').primaryKey(), // ws_...
    /** Public, long, opaque "Ume ID" shown in Settings and used in support. Not a secret. */
    umeId: text('ume_id').notNull().unique(),
    guildId: text('guild_id').notNull().unique(),
    guildName: text('guild_name').notNull(),
    guildIcon: text('guild_icon'),
    /** Discord snowflake of the guild owner (kept in sync by the bot). */
    guildOwnerDiscordId: text('guild_owner_discord_id'),
    /** The web user who owns this workspace (holds the Owner role). Null while unclaimed. */
    ownerUserId: text('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    status: workspaceStatusEnum('status').notNull().default('unclaimed'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),
    purgedAt: timestamp('purged_at', { withTimezone: true }),

    // --- bot presence ---
    /** Voice channel Ume lives in 24/7. Updated when an admin moves the bot. */
    homeVoiceChannelId: text('home_voice_channel_id'),
    /** Text channel for announcements / inactivity notices. */
    noticeTextChannelId: text('notice_text_channel_id'),
    botConnected: boolean('bot_connected').notNull().default(false),
    botLastSeenAt: timestamp('bot_last_seen_at', { withTimezone: true }),
    botVoiceChannelId: text('bot_voice_channel_id'),
    /** True while the bot is a member of the guild. */
    botInGuild: boolean('bot_in_guild').notNull().default(false),

    // --- activity / auto-purge ---
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).notNull().defaultNow(),
    inactivityNotice30dSentAt: timestamp('inactivity_notice_30d_sent_at', { withTimezone: true }),
    inactivityNotice48hSentAt: timestamp('inactivity_notice_48h_sent_at', { withTimezone: true }),

    // --- storage & billing ---
    plan: planEnum('plan').notNull().default('free'),
    storageUsedBytes: bigint('storage_used_bytes', { mode: 'number' }).notNull().default(0),
    /** Explicit override (e.g. CEO grants); when null the plan's quota applies. */
    storageQuotaOverrideBytes: bigint('storage_quota_override_bytes', { mode: 'number' }),
    trackCount: integer('track_count').notNull().default(0),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    stripeSubscriptionStatus: text('stripe_subscription_status'),
    planRenewsAt: timestamp('plan_renews_at', { withTimezone: true }),

    // --- settings ---
    /** Whether Discord role -> Ume role mapping is applied at sign-in. */
    discordRoleSyncEnabled: boolean('discord_role_sync_enabled').notNull().default(true),
    /** Default Ume role for any signed-in Discord member of the guild (null = no access). */
    defaultRoleId: text('default_role_id'),
    /** Per-workspace switch for the link extractor (also gated by the global link_extract flag). */
    linkExtractEnabled: boolean('link_extract_enabled').notNull().default(true),
    /** The Owner accepted the rights attestation before the first extraction. */
    linkExtractAcceptedAt: timestamp('link_extract_accepted_at', { withTimezone: true }),
    linkExtractAcceptedByUserId: text('link_extract_accepted_by_user_id').references(() => users.id, { onDelete: 'set null' }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('workspaces_owner_user_id_idx').on(t.ownerUserId),
    index('workspaces_status_idx').on(t.status),
    index('workspaces_last_activity_idx').on(t.lastActivityAt),
  ],
)

/**
 * Tokens issued by `~reload`. Only the SHA-256 hash is stored. Claiming a token
 * consumes it forever; `~reload` revokes every unclaimed token for the guild.
 */
export const claimTokens = pgTable(
  'claim_tokens',
  {
    id: text('id').primaryKey(), // clt_...
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    guildId: text('guild_id').notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    /** Discord user the bot DM'd the token to. */
    issuedToDiscordId: text('issued_to_discord_id').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    claimedByUserId: text('claimed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [index('claim_tokens_guild_id_idx').on(t.guildId)],
)

export const systemRoleEnum = pgEnum('system_role', ['owner', 'master', 'servant', 'peon'])

/** Roles are capability bitmasks (see @ume/shared CAP). */
export const roles = pgTable(
  'roles',
  {
    id: text('id').primaryKey(), // rol_...
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    color: text('color').notNull().default('#B3B3B3'),
    capabilities: integer('capabilities').notNull().default(0),
    /** Non-null for the four defaults; system roles cannot be deleted (but can be renamed). */
    systemKey: systemRoleEnum('system_key'),
    position: integer('position').notNull().default(100),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('roles_workspace_id_idx').on(t.workspaceId),
    uniqueIndex('roles_workspace_system_key_uq').on(t.workspaceId, t.systemKey),
  ],
)

export const membershipSourceEnum = pgEnum('membership_source', [
  'owner',
  'manual',
  'invite_link',
  'email_invite',
  'discord_role_map',
  'default_role',
])

/** A user's role in a workspace. One row per (workspace, user). */
export const memberships = pgTable(
  'memberships',
  {
    id: text('id').primaryKey(), // mem_...
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    source: membershipSourceEnum('source').notNull().default('manual'),
    inviteId: text('invite_id'),
    /** Temporary members (e.g. event DJs). Null = permanent. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('memberships_workspace_user_uq').on(t.workspaceId, t.userId),
    index('memberships_user_id_idx').on(t.userId),
    index('memberships_role_id_idx').on(t.roleId),
  ],
)

/** Discord role -> Ume role mapping ("@DJ -> Servant"). Highest position wins. */
export const discordRoleMaps = pgTable(
  'discord_role_maps',
  {
    id: text('id').primaryKey(), // rm_...
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    discordRoleId: text('discord_role_id').notNull(),
    discordRoleName: text('discord_role_name').notNull(),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('discord_role_maps_uq').on(t.workspaceId, t.discordRoleId)],
)

export const inviteKindEnum = pgEnum('invite_kind', ['link', 'email'])

/** Google-Drive-style share links and email invites. */
export const invites = pgTable(
  'invites',
  {
    id: text('id').primaryKey(), // inv_...
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    kind: inviteKindEnum('kind').notNull(),
    /** Unguessable token in the URL: /invite/<token>. */
    token: text('token').notNull().unique(),
    /** For email invites: the address this invite is bound to. */
    email: text('email'),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    label: text('label'),
    maxUses: integer('max_uses'),
    uses: integer('uses').notNull().default(0),
    /** When the invite itself stops working. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Optional: memberships created through this invite expire at this time. */
    membershipExpiresAt: timestamp('membership_expires_at', { withTimezone: true }),
    /** Require the claimant to be a member of the Discord server (checked via OAuth guilds). */
    requireGuildMember: boolean('require_guild_member').notNull().default(true),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdByUserId: text('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('invites_workspace_id_idx').on(t.workspaceId), index('invites_email_idx').on(t.email)],
)

export const dangerActionEnum = pgEnum('danger_action', ['reset', 'purge'])

/** Pending confirmations for ~reset / ~purge (and the web Danger Zone). */
export const dangerConfirmations = pgTable(
  'danger_confirmations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    action: dangerActionEnum('action').notNull(),
    codeHash: text('code_hash').notNull(),
    requestedByDiscordId: text('requested_by_discord_id'),
    requestedByUserId: text('requested_by_user_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('danger_confirmations_workspace_idx').on(t.workspaceId)],
)

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert
export type ClaimToken = typeof claimTokens.$inferSelect
export type Role = typeof roles.$inferSelect
export type Membership = typeof memberships.$inferSelect
export type DiscordRoleMap = typeof discordRoleMaps.$inferSelect
export type Invite = typeof invites.$inferSelect
export type DangerConfirmation = typeof dangerConfirmations.$inferSelect
export type WorkspaceStatus = (typeof workspaceStatusEnum.enumValues)[number]
