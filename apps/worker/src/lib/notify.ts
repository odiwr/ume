import { randomUUID } from 'node:crypto'
import { and, eq, gt, isNull, or } from './orm'
import { CAP, hasCap } from '@ume/shared'
import { memberships, notifications, roles, users, type Db, type Workspace } from '@ume/db'
import { sendEmail } from '@ume/email'
import type { Logger } from 'pino'
import { dmUser, getGuild, postToChannel } from './discord-rest'

export type NotificationKind = (typeof notifications.$inferInsert)['kind']
type Channel = (typeof notifications.$inferInsert)['channel']
type Status = 'sent' | 'failed' | 'skipped'

export interface NotifyInput {
  kind: NotificationKind
  /** Built by the caller with the recipient-independent parts; `to` is filled per recipient. */
  email: { subject: string; html: string; text: string }
  /** Plain-text Discord message (no mentions are ever resolved). */
  discordText: string
  metadata?: Record<string, unknown>
}

export interface NotifyResult {
  emails: { to: string; status: Status }[]
  discord: { channel: Channel; recipient: string; status: Status; reason?: string } | null
}

export function newNotificationId(): string {
  return `ntf_${randomUUID().replace(/-/g, '')}`
}

async function record(
  db: Db,
  row: {
    workspaceId: string | null
    userId: string | null
    kind: NotificationKind
    channel: Channel
    recipient: string
    status: Status
    error?: string | null
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  await db
    .insert(notifications)
    .values({
      id: newNotificationId(),
      workspaceId: row.workspaceId,
      userId: row.userId,
      kind: row.kind,
      channel: row.channel,
      recipient: row.recipient,
      status: row.status,
      error: row.error ?? null,
      metadata: row.metadata ?? {},
    })
    .catch(() => undefined) // never let bookkeeping break a notice
}

/** Owner + every member whose role carries MANAGE_SETTINGS (Masters), deduplicated by email. */
export async function workspaceManagers(db: Db, workspace: Workspace) {
  const rows = await db
    .select({ user: users, caps: roles.capabilities })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(roles, eq(roles.id, memberships.roleId))
    .where(
      and(
        eq(memberships.workspaceId, workspace.id),
        or(isNull(memberships.expiresAt), gt(memberships.expiresAt, new Date())),
      ),
    )
  const out = new Map<string, typeof users.$inferSelect>()
  for (const r of rows) {
    const isOwner = r.user.id === workspace.ownerUserId
    if (isOwner || hasCap(r.caps, CAP.MANAGE_SETTINGS)) out.set(r.user.id, r.user)
  }
  if (workspace.ownerUserId && !out.has(workspace.ownerUserId)) {
    const owner = await db.query.users.findFirst({ where: eq(users.id, workspace.ownerUserId) })
    if (owner) out.set(owner.id, owner)
  }
  return [...out.values()]
}

/**
 * Fan a notice out to the people who can act on it: email to the Owner and every Master,
 * then one Discord message — DM to the owner, else the notice channel, else the guild's
 * system channel. One `notifications` row per attempt. Idempotency is the caller's job.
 */
export async function notifyWorkspaceOwner(
  db: Db,
  log: Logger,
  workspace: Workspace,
  input: NotifyInput,
): Promise<NotifyResult> {
  const result: NotifyResult = { emails: [], discord: null }
  const managers = await workspaceManagers(db, workspace)
  const owner = managers.find((u) => u.id === workspace.ownerUserId) ?? null

  // --- email ---
  const seen = new Set<string>()
  for (const u of managers) {
    const to = u.email?.trim().toLowerCase()
    if (!to || seen.has(to)) continue
    seen.add(to)
    let status: Status = 'sent'
    let error: string | null = null
    try {
      const r = await sendEmail({ to, ...input.email })
      if (!r.ok) {
        status = 'failed'
        error = r.error ?? 'send failed'
      }
    } catch (err) {
      status = 'failed'
      error = err instanceof Error ? err.message : String(err)
    }
    if (status === 'failed') log.warn({ workspaceId: workspace.id, to, error }, `email ${input.kind} failed`)
    await record(db, { workspaceId: workspace.id, userId: u.id, kind: input.kind, channel: 'email', recipient: to, status, error, metadata: input.metadata })
    result.emails.push({ to, status })
  }
  if (managers.length === 0 || seen.size === 0) {
    await record(db, { workspaceId: workspace.id, userId: null, kind: input.kind, channel: 'email', recipient: '-', status: 'skipped', error: 'no owner or manager with an email', metadata: input.metadata })
  }

  // --- discord: DM owner -> notice channel -> system channel ---
  const attempts: Array<{ channel: Channel; recipient: string; userId: string | null; send: () => ReturnType<typeof dmUser> }> = []
  if (owner?.discordUserId) {
    const id = owner.discordUserId
    attempts.push({ channel: 'discord_dm', recipient: id, userId: owner.id, send: () => dmUser(log, id, input.discordText) })
  }
  if (workspace.noticeTextChannelId) {
    const id = workspace.noticeTextChannelId
    attempts.push({ channel: 'discord_channel', recipient: id, userId: null, send: () => postToChannel(log, id, input.discordText) })
  }
  attempts.push({
    channel: 'discord_channel',
    recipient: `guild:${workspace.guildId}:system`,
    userId: null,
    send: async () => {
      const guild = await getGuild(log, workspace.guildId)
      if (!guild?.systemChannelId) return { ok: false, reason: 'guild has no system channel (or bot is not in the guild)' }
      return postToChannel(log, guild.systemChannelId, input.discordText)
    },
  })

  for (const a of attempts) {
    const r = await a.send()
    const status: Status = r.ok ? 'sent' : 'failed'
    await record(db, {
      workspaceId: workspace.id,
      userId: a.userId,
      kind: input.kind,
      channel: a.channel,
      recipient: a.recipient,
      status,
      error: r.ok ? null : r.reason,
      metadata: input.metadata,
    })
    result.discord = { channel: a.channel, recipient: a.recipient, status, ...(r.ok ? {} : { reason: r.reason }) }
    if (r.ok) break
    log.info({ workspaceId: workspace.id, channel: a.channel, reason: r.reason }, `discord ${input.kind} attempt failed; trying next route`)
  }
  if (!result.discord) {
    await record(db, { workspaceId: workspace.id, userId: null, kind: input.kind, channel: 'discord_dm', recipient: '-', status: 'skipped', error: 'no Discord route', metadata: input.metadata })
  }
  return result
}
