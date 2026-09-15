/**
 * Roles are capability bitmasks. The three default roles keep the names the founder
 * chose (Master / Servant / Peon) plus an implicit, non-removable Owner. Servers can
 * rename roles or add custom ones later without touching this file.
 */
export const CAP = {
  VIEW_LIBRARY: 1 << 0,
  ADD_TRACK: 1 << 1,
  DELETE_OWN_TRACK: 1 << 2,
  DELETE_ANY_TRACK: 1 << 3,
  EDIT_TRACK_META: 1 << 4,
  MANAGE_PLAYLISTS: 1 << 5,
  CONTROL_PLAYBACK: 1 << 6,
  MANAGE_MEMBERS: 1 << 7,
  MANAGE_INVITES: 1 << 8,
  MANAGE_ROLES: 1 << 9,
  MANAGE_SETTINGS: 1 << 10,
  MANAGE_BILLING: 1 << 11,
  DANGER_ZONE: 1 << 12,
} as const

export type Capability = (typeof CAP)[keyof typeof CAP]
export type CapabilityName = keyof typeof CAP

export const ALL_CAPS: number = Object.values(CAP).reduce((a, b) => a | b, 0)

export const CAP_LABELS: Record<CapabilityName, { label: string; description: string }> = {
  VIEW_LIBRARY: { label: 'View library', description: 'See playlists and tracks.' },
  ADD_TRACK: { label: 'Add music', description: 'Upload files or add links to playlists.' },
  DELETE_OWN_TRACK: { label: 'Remove own additions', description: 'Remove tracks they added.' },
  DELETE_ANY_TRACK: { label: 'Remove any track', description: 'Remove any track from any playlist.' },
  EDIT_TRACK_META: { label: 'Edit track details', description: 'Fix titles, artists and covers.' },
  MANAGE_PLAYLISTS: { label: 'Manage playlists', description: 'Create, rename and delete playlists.' },
  CONTROL_PLAYBACK: { label: 'Control playback', description: 'Play, pause, skip in Discord.' },
  MANAGE_MEMBERS: { label: 'Manage members', description: 'Change roles or remove members.' },
  MANAGE_INVITES: { label: 'Manage invites', description: 'Create and revoke links and email invites.' },
  MANAGE_ROLES: { label: 'Manage roles', description: 'Create roles and edit capabilities.' },
  MANAGE_SETTINGS: { label: 'Manage settings', description: 'Home channel, token, Discord role mapping.' },
  MANAGE_BILLING: { label: 'Manage billing', description: 'Change storage plan.' },
  DANGER_ZONE: { label: 'Danger zone', description: 'Reset or purge the workspace.' },
}

export type SystemRoleKey = 'owner' | 'master' | 'servant' | 'peon'

export interface DefaultRole {
  key: SystemRoleKey
  name: string
  description: string
  capabilities: number
  position: number
  color: string
}

export const DEFAULT_ROLES: readonly DefaultRole[] = [
  {
    key: 'owner',
    name: 'Owner',
    description: 'The server owner. Exactly one; cannot be removed. Only role that can purge or change billing.',
    capabilities: ALL_CAPS,
    position: 0,
    color: '#E464B0',
  },
  {
    key: 'master',
    name: 'Master',
    description: 'Can edit every playlist, add and remove music, and manage members and invites.',
    capabilities:
      CAP.VIEW_LIBRARY |
      CAP.ADD_TRACK |
      CAP.DELETE_OWN_TRACK |
      CAP.DELETE_ANY_TRACK |
      CAP.EDIT_TRACK_META |
      CAP.MANAGE_PLAYLISTS |
      CAP.CONTROL_PLAYBACK |
      CAP.MANAGE_MEMBERS |
      CAP.MANAGE_INVITES |
      CAP.MANAGE_SETTINGS,
    position: 1,
    color: '#B5C1B4',
  },
  {
    key: 'servant',
    name: 'Servant',
    description: 'Can add music to playlists but cannot delete or edit anything.',
    capabilities: CAP.VIEW_LIBRARY | CAP.ADD_TRACK | CAP.CONTROL_PLAYBACK,
    position: 2,
    color: '#D6CABF',
  },
  {
    key: 'peon',
    name: 'Peon',
    description: 'Can browse the library and use playback commands. Cannot change anything.',
    capabilities: CAP.VIEW_LIBRARY | CAP.CONTROL_PLAYBACK,
    position: 3,
    color: '#B3B3B3',
  },
] as const

export function hasCap(mask: number, cap: number): boolean {
  return (mask & cap) === cap
}

export function hasAnyCap(mask: number, ...caps: number[]): boolean {
  return caps.some((c) => (mask & c) === c)
}

export function capNames(mask: number): CapabilityName[] {
  return (Object.keys(CAP) as CapabilityName[]).filter((k) => hasCap(mask, CAP[k]))
}

/** Owner-only capabilities that no other role may be granted, even custom ones. */
export const OWNER_ONLY_CAPS: number = CAP.MANAGE_BILLING | CAP.DANGER_ZONE

export function sanitizeCapsForNonOwner(mask: number): number {
  return mask & ~OWNER_ONLY_CAPS
}

/**
 * A share link is a bearer credential: anyone holding it gets the role. So links may
 * only grant "contributor-level" roles. Anything that can delete others' work or manage
 * people must go through an email invite bound to an address.
 */
export const LINK_INVITE_FORBIDDEN_CAPS: number =
  CAP.DELETE_ANY_TRACK |
  CAP.MANAGE_PLAYLISTS |
  CAP.MANAGE_MEMBERS |
  CAP.MANAGE_INVITES |
  CAP.MANAGE_ROLES |
  CAP.MANAGE_SETTINGS |
  OWNER_ONLY_CAPS

export function roleGrantableByLink(mask: number): boolean {
  return (mask & LINK_INVITE_FORBIDDEN_CAPS) === 0
}

/** Email invites can grant anything except Owner-only capabilities. */
export function roleGrantableByEmail(mask: number): boolean {
  return (mask & OWNER_ONLY_CAPS) === 0
}
