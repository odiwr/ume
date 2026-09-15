import { ulid } from 'ulid'

/**
 * Prefixed ULIDs: sortable, URL-safe, and self-describing in logs.
 *   ws_01J...  workspace      pl_01J... playlist      trk_01J... track
 *   inv_01J... invite         rol_01J... role        mem_01J... membership
 */
export const ID_PREFIX = {
  workspace: 'ws',
  playlist: 'pl',
  track: 'trk',
  invite: 'inv',
  role: 'rol',
  membership: 'mem',
  claimToken: 'clt',
  activity: 'act',
  audit: 'aud',
  playlistTrack: 'pt',
  roleMap: 'rm',
} as const

export type IdKind = keyof typeof ID_PREFIX

export function newId(kind: IdKind): string {
  return `${ID_PREFIX[kind]}_${ulid()}`
}

/**
 * The public "Ume ID" for a workspace. Long, opaque, and safe to show in Settings.
 * It is NOT a secret: it identifies the workspace in URLs and support tickets.
 */
export function newUmeId(): string {
  return `ume-${ulid().toLowerCase()}-${ulid().slice(-8).toLowerCase()}`
}

export function isIdOfKind(id: string, kind: IdKind): boolean {
  return id.startsWith(`${ID_PREFIX[kind]}_`)
}
