import 'server-only'
import { cache } from 'react'
import { notFound, redirect } from 'next/navigation'
import { and, eq, inArray } from 'drizzle-orm'
import { can, discordRoleMaps, getAccess, getWorkspaceByUmeId, memberships, roles, type Access, type Workspace } from '@ume/db'
import { BOT_HEARTBEAT_MS, newId } from '@ume/shared'
import { db } from '@/lib/db'
import { getGuildMember } from '@/lib/discord-api'
import { requireUser } from '@/lib/session'

export interface WorkspaceContext {
  session: Awaited<ReturnType<typeof requireUser>>
  user: Awaited<ReturnType<typeof requireUser>>['user']
  workspace: Workspace
  access: Access | null
  isMember: boolean
  umeId: string
}

/**
 * Loads the workspace for a /app/[ws] route and the signed-in user's access. When the
 * user has no membership yet, tries to grant one from the Discord role mapping (or the
 * workspace default role) — this is how most members get in without an invite.
 */
export const getWorkspaceContext = cache(async (umeId: string): Promise<WorkspaceContext> => {
  const session = await requireUser(`/app/${umeId}`)
  const ws = await getWorkspaceByUmeId(db, umeId)
  if (!ws || ws.status === 'purged') notFound()
  let access = await getAccess(db, ws.id, session.user.id)
  if (access && !access.membership) {
    const joined = await tryAutoJoin(ws, session.user.id, session.user.discordUserId ?? null)
    if (joined) access = await getAccess(db, ws.id, session.user.id)
  }
  return {
    session,
    user: session.user,
    workspace: access?.workspace ?? ws,
    access,
    isMember: !!access?.membership,
    umeId,
  }
})

/**
 * Page-level gate: members only; pages that need a capability bounce to the overview
 * (the sidebar already hides them). Layouts and pages render in parallel, so every page
 * calls this itself rather than trusting the layout.
 */
export async function requireWorkspacePage(umeId: string, cap?: number): Promise<WorkspaceContext & { access: Access }> {
  const ctx = await getWorkspaceContext(umeId)
  if (!ctx.access || !ctx.isMember) notFound()
  if (cap !== undefined && !can(ctx.access, cap)) redirect(`/app/${umeId}`)
  return ctx as WorkspaceContext & { access: Access }
}

/**
 * Resolve the Ume role a Discord member should get: the highest-positioned mapped role
 * (lowest position number wins) when role sync is on, else the workspace default role.
 * Returns null when the user should not get access.
 */
export async function resolveRoleForDiscordMember(
  ws: Pick<Workspace, 'id' | 'discordRoleSyncEnabled' | 'defaultRoleId'>,
  memberRoleIds: string[],
): Promise<{ roleId: string; source: 'discord_role_map' | 'default_role' } | null> {
  if (ws.discordRoleSyncEnabled && memberRoleIds.length) {
    const maps = await db
      .select({ roleId: discordRoleMaps.roleId, position: roles.position })
      .from(discordRoleMaps)
      .innerJoin(roles, eq(roles.id, discordRoleMaps.roleId))
      .where(and(eq(discordRoleMaps.workspaceId, ws.id), inArray(discordRoleMaps.discordRoleId, memberRoleIds)))
    if (maps.length) {
      const best = maps.reduce((a, b) => (b.position < a.position ? b : a))
      return { roleId: best.roleId, source: 'discord_role_map' }
    }
  }
  if (ws.defaultRoleId) return { roleId: ws.defaultRoleId, source: 'default_role' }
  return null
}

/** Create a membership from Discord guild membership. Returns true when a row was created. */
export async function tryAutoJoin(ws: Workspace, userId: string, discordUserId: string | null): Promise<boolean> {
  if (!discordUserId) return false
  if (ws.status !== 'connected') return false
  let member: Awaited<ReturnType<typeof getGuildMember>> = null
  try {
    member = await getGuildMember(ws.guildId, discordUserId)
  } catch {
    return false
  }
  if (!member) return false
  const resolved = await resolveRoleForDiscordMember(ws, member.roles)
  if (!resolved) return false
  // Never overwrite the owner's row or an existing membership.
  const inserted = await db
    .insert(memberships)
    .values({
      id: newId('membership'),
      workspaceId: ws.id,
      userId,
      roleId: resolved.roleId,
      source: resolved.source,
    })
    .onConflictDoNothing()
    .returning({ id: memberships.id })
  return inserted.length > 0
}

export function isBotOnline(ws: Pick<Workspace, 'botConnected' | 'botLastSeenAt'>): boolean {
  if (!ws.botConnected || !ws.botLastSeenAt) return false
  return Date.now() - ws.botLastSeenAt.getTime() < BOT_HEARTBEAT_MS * 3
}
