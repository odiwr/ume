import { and, eq, gt, isNull, ne, or } from 'drizzle-orm'
import { CAP, hasCap } from '@ume/shared'
import type { Db } from '../client'
import { memberships, roles, users, workspaces, type Membership, type Role, type User, type Workspace } from '../schema'

export interface Access {
  workspace: Workspace
  membership: Membership | null
  role: Role | null
  /** Capability bitmask; 0 when the user has no access. */
  caps: number
  isOwner: boolean
}

function activeMembershipWhere(workspaceId: string, userId: string) {
  return and(
    eq(memberships.workspaceId, workspaceId),
    eq(memberships.userId, userId),
    or(isNull(memberships.expiresAt), gt(memberships.expiresAt, new Date())),
  )
}

/** What a signed-in web user can do in a workspace. Disconnected/purged workspaces are read-only. */
export async function getAccess(db: Db, workspaceId: string, userId: string): Promise<Access | null> {
  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
  if (!workspace) return null
  const membership = await db.query.memberships.findFirst({ where: activeMembershipWhere(workspaceId, userId) })
  if (!membership) return { workspace, membership: null, role: null, caps: 0, isOwner: false }
  const role = await db.query.roles.findFirst({ where: eq(roles.id, membership.roleId) })
  const isOwner = workspace.ownerUserId === userId || role?.systemKey === 'owner'
  let caps = role?.capabilities ?? 0
  if (workspace.status !== 'connected') {
    // Read-only + settings (so the owner can re-enter a token) + danger zone.
    caps &= CAP.VIEW_LIBRARY | CAP.MANAGE_SETTINGS | CAP.DANGER_ZONE | CAP.MANAGE_BILLING
  }
  return { workspace, membership, role: role ?? null, caps, isOwner }
}

export function can(access: Access | null, cap: number): boolean {
  return !!access && hasCap(access.caps, cap)
}

/**
 * Bot-side authorization: given a Discord user id in a guild, what can they do?
 * Looks up the linked web user (Discord OAuth) and their membership. Falls back to the
 * workspace default role when the Discord user is in the guild but has no membership.
 */
export async function resolveDiscordAccess(
  db: Db,
  guildId: string,
  discordUserId: string,
): Promise<(Access & { user: User | null }) | null> {
  const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.guildId, guildId) })
  if (!workspace) return null
  const user = await db.query.users.findFirst({ where: eq(users.discordUserId, discordUserId) })
  if (!user) {
    const defaultRole = workspace.defaultRoleId
      ? await db.query.roles.findFirst({ where: eq(roles.id, workspace.defaultRoleId) })
      : null
    const caps = workspace.status === 'connected' ? (defaultRole?.capabilities ?? 0) : 0
    return { workspace, membership: null, role: defaultRole ?? null, caps, isOwner: false, user: null }
  }
  const access = await getAccess(db, workspace.id, user.id)
  if (!access) return null
  if (!access.membership && workspace.defaultRoleId && workspace.status === 'connected') {
    const defaultRole = await db.query.roles.findFirst({ where: eq(roles.id, workspace.defaultRoleId) })
    return { ...access, role: defaultRole ?? null, caps: defaultRole?.capabilities ?? 0, user }
  }
  return { ...access, user }
}

/** Removes every membership except the Owner's (used by ~reset). Returns removed count. */
export async function removeAllMembersExceptOwner(db: Db, workspaceId: string): Promise<number> {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
  if (!ws) return 0
  const where = ws.ownerUserId
    ? and(eq(memberships.workspaceId, workspaceId), ne(memberships.userId, ws.ownerUserId))
    : eq(memberships.workspaceId, workspaceId)
  const deleted = await db.delete(memberships).where(where).returning({ id: memberships.id })
  return deleted.length
}
