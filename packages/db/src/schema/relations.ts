import { relations } from 'drizzle-orm'
import { accounts, sessions, users } from './auth'
import { playlistTracks, playlists, tracks } from './library'
import { activityEvents, auditLogs } from './ops'
import {
  claimTokens,
  discordRoleMaps,
  invites,
  memberships,
  roles,
  workspaces,
} from './workspaces'

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  memberships: many(memberships),
  ownedWorkspaces: many(workspaces),
}))

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}))

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  owner: one(users, { fields: [workspaces.ownerUserId], references: [users.id] }),
  roles: many(roles),
  memberships: many(memberships),
  playlists: many(playlists),
  tracks: many(tracks),
  invites: many(invites),
  claimTokens: many(claimTokens),
  discordRoleMaps: many(discordRoleMaps),
  activity: many(activityEvents),
  audit: many(auditLogs),
}))

export const rolesRelations = relations(roles, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [roles.workspaceId], references: [workspaces.id] }),
  memberships: many(memberships),
  invites: many(invites),
}))

export const membershipsRelations = relations(memberships, ({ one }) => ({
  workspace: one(workspaces, { fields: [memberships.workspaceId], references: [workspaces.id] }),
  user: one(users, { fields: [memberships.userId], references: [users.id] }),
  role: one(roles, { fields: [memberships.roleId], references: [roles.id] }),
}))

export const invitesRelations = relations(invites, ({ one }) => ({
  workspace: one(workspaces, { fields: [invites.workspaceId], references: [workspaces.id] }),
  role: one(roles, { fields: [invites.roleId], references: [roles.id] }),
  createdBy: one(users, { fields: [invites.createdByUserId], references: [users.id] }),
}))

export const discordRoleMapsRelations = relations(discordRoleMaps, ({ one }) => ({
  workspace: one(workspaces, { fields: [discordRoleMaps.workspaceId], references: [workspaces.id] }),
  role: one(roles, { fields: [discordRoleMaps.roleId], references: [roles.id] }),
}))

export const claimTokensRelations = relations(claimTokens, ({ one }) => ({
  workspace: one(workspaces, { fields: [claimTokens.workspaceId], references: [workspaces.id] }),
}))

export const playlistsRelations = relations(playlists, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [playlists.workspaceId], references: [workspaces.id] }),
  entries: many(playlistTracks),
  createdBy: one(users, { fields: [playlists.createdByUserId], references: [users.id] }),
}))

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [tracks.workspaceId], references: [workspaces.id] }),
  entries: many(playlistTracks),
  uploadedBy: one(users, { fields: [tracks.uploadedByUserId], references: [users.id] }),
}))

export const playlistTracksRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, { fields: [playlistTracks.playlistId], references: [playlists.id] }),
  track: one(tracks, { fields: [playlistTracks.trackId], references: [tracks.id] }),
  addedBy: one(users, { fields: [playlistTracks.addedByUserId], references: [users.id] }),
}))

export const activityEventsRelations = relations(activityEvents, ({ one }) => ({
  workspace: one(workspaces, { fields: [activityEvents.workspaceId], references: [workspaces.id] }),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  workspace: one(workspaces, { fields: [auditLogs.workspaceId], references: [workspaces.id] }),
  actor: one(users, { fields: [auditLogs.actorUserId], references: [users.id] }),
}))
