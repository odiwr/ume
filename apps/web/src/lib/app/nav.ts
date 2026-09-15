import { CAP } from '@ume/shared'

/** Sidebar navigation for a workspace. `cap` gates visibility (null = every member). */
export const WORKSPACE_NAV: ReadonlyArray<{ key: string; label: string; segment: string; cap: number | null }> = [
  { key: 'overview', label: 'Overview', segment: '', cap: null },
  { key: 'library', label: 'Library', segment: 'library', cap: CAP.VIEW_LIBRARY },
  { key: 'members', label: 'Members', segment: 'members', cap: CAP.MANAGE_MEMBERS },
  { key: 'roles', label: 'Roles', segment: 'roles', cap: CAP.MANAGE_ROLES },
  { key: 'invites', label: 'Invites', segment: 'invites', cap: CAP.MANAGE_INVITES },
  { key: 'activity', label: 'Activity', segment: 'activity', cap: CAP.VIEW_LIBRARY },
  { key: 'settings', label: 'Settings', segment: 'settings', cap: CAP.MANAGE_SETTINGS },
  { key: 'billing', label: 'Billing', segment: 'billing', cap: CAP.MANAGE_BILLING },
]

export function workspacePath(umeId: string, segment = ''): string {
  return segment ? `/app/${umeId}/${segment}` : `/app/${umeId}`
}
