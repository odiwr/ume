import 'server-only'
import { and, desc, eq, gt, inArray, isNull, ne, or } from 'drizzle-orm'
import {
  activityEvents,
  auditLogs,
  discordRoleMaps,
  invites,
  memberships,
  playlistTracks,
  playlists,
  roles,
  workspaces,
  listPlaylistTracks,
} from '@ume/db'
import { db } from '@/lib/db'

/**
 * Read-only loaders for the dashboard pages. Every function is scoped by workspaceId
 * (or userId for the workspace list); pages authorize with requireWorkspacePage first.
 */

const ACTIVE_STATUSES = ['unclaimed', 'connected', 'disconnected', 'purging'] as const

/** Workspaces the user can open: active memberships plus anything they own. */
export async function listMyWorkspaces(userId: string) {
  const rows = await db.query.memberships.findMany({
    where: and(eq(memberships.userId, userId), or(isNull(memberships.expiresAt), gt(memberships.expiresAt, new Date()))),
    with: { workspace: true, role: true },
  })
  const seen = new Set(rows.map((r) => r.workspaceId))
  const owned = await db.query.workspaces.findMany({
    where: and(eq(workspaces.ownerUserId, userId), ne(workspaces.status, 'purged')),
  })
  const items = rows
    .filter((r) => r.workspace.status !== 'purged')
    .map((r) => ({ workspace: r.workspace, roleName: r.role.name, roleColor: r.role.color, isOwner: r.workspace.ownerUserId === userId }))
  for (const ws of owned) {
    if (seen.has(ws.id)) continue
    items.push({ workspace: ws, roleName: 'Owner', roleColor: '#E464B0', isOwner: true })
  }
  return items.sort((a, b) => a.workspace.guildName.localeCompare(b.workspace.guildName))
}

export async function findWorkspacesByGuildIds(guildIds: string[]) {
  if (!guildIds.length) return []
  return db.query.workspaces.findMany({ where: inArray(workspaces.guildId, guildIds) })
}

export async function listPlaylists(workspaceId: string) {
  return db.query.playlists.findMany({
    where: eq(playlists.workspaceId, workspaceId),
    orderBy: (p, { asc }) => [asc(p.position), asc(p.createdAt)],
    with: { createdBy: { columns: { id: true, name: true, discordUsername: true } } },
  })
}

export async function getPlaylistBySlug(workspaceId: string, slug: string) {
  return db.query.playlists.findFirst({ where: and(eq(playlists.workspaceId, workspaceId), eq(playlists.slug, slug)) })
}

export type PlaylistEntry = Awaited<ReturnType<typeof listPlaylistTracks>>[number]

export async function listEntries(workspaceId: string, playlistId: string): Promise<PlaylistEntry[]> {
  const rows = await listPlaylistTracks(db, playlistId)
  // Belt and braces: the playlist was already scoped, but never leak another workspace's rows.
  return rows.filter((r) => r.workspaceId === workspaceId)
}

/** Most recent additions across all playlists, for the overview. */
export async function listRecentAdditions(workspaceId: string, limit = 8) {
  return db.query.playlistTracks.findMany({
    where: eq(playlistTracks.workspaceId, workspaceId),
    orderBy: [desc(playlistTracks.addedAt)],
    limit,
    with: {
      track: { columns: { id: true, title: true, artist: true, status: true, coverUrl: true, source: true, sourceSite: true, durationMs: true } },
      playlist: { columns: { id: true, name: true, slug: true } },
      addedBy: { columns: { id: true, name: true, image: true, discordUsername: true, discordAvatar: true, discordUserId: true } },
    },
  })
}

export async function listRoles(workspaceId: string) {
  return db.query.roles.findMany({
    where: eq(roles.workspaceId, workspaceId),
    orderBy: (r, { asc }) => [asc(r.position), asc(r.createdAt)],
  })
}

export async function listMembers(workspaceId: string) {
  return db.query.memberships.findMany({
    where: eq(memberships.workspaceId, workspaceId),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
    with: {
      user: { columns: { id: true, name: true, email: true, image: true, discordUsername: true, discordAvatar: true, discordUserId: true } },
      role: true,
    },
  })
}

export async function listRoleMaps(workspaceId: string) {
  return db.query.discordRoleMaps.findMany({ where: eq(discordRoleMaps.workspaceId, workspaceId), with: { role: true } })
}

export async function listInvites(workspaceId: string) {
  return db.query.invites.findMany({
    where: eq(invites.workspaceId, workspaceId),
    orderBy: [desc(invites.createdAt)],
    with: { role: true, createdBy: { columns: { id: true, name: true, discordUsername: true } } },
  })
}

export async function listActivity(workspaceId: string, limit = 60) {
  return db.query.activityEvents.findMany({
    where: eq(activityEvents.workspaceId, workspaceId),
    orderBy: [desc(activityEvents.createdAt)],
    limit,
  })
}

export async function listAudit(workspaceId: string, limit = 60) {
  return db.query.auditLogs.findMany({
    where: eq(auditLogs.workspaceId, workspaceId),
    orderBy: [desc(auditLogs.createdAt)],
    limit,
    with: { actor: { columns: { id: true, name: true, discordUsername: true } } },
  })
}

/** Names for the actors on an activity feed (activity rows carry ids only). */
export async function usersByIds(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))]
  if (!unique.length) return new Map<string, { id: string; name: string; discordUsername: string | null }>()
  const rows = await db.query.users.findMany({
    where: (u, { inArray: within }) => within(u.id, unique),
    columns: { id: true, name: true, discordUsername: true },
  })
  return new Map(rows.map((r) => [r.id, r]))
}

export { ACTIVE_STATUSES }
