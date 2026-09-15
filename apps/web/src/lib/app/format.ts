import type { BadgeTone } from '@/components/ui/badge'

/** Client-safe presentation helpers shared by dashboard components. */

export function workspaceStatusTone(status: string): { tone: BadgeTone; label: string } {
  switch (status) {
    case 'connected':
      return { tone: 'success', label: 'Connected' }
    case 'disconnected':
      return { tone: 'warning', label: 'Disconnected' }
    case 'unclaimed':
      return { tone: 'default', label: 'Unclaimed' }
    case 'purging':
      return { tone: 'danger', label: 'Purging' }
    case 'purged':
      return { tone: 'danger', label: 'Purged' }
    default:
      return { tone: 'default', label: status }
  }
}

export function trackStatusTone(status: string): { tone: BadgeTone; label: string } {
  switch (status) {
    case 'ready':
      return { tone: 'success', label: 'Ready' }
    case 'pending':
      return { tone: 'default', label: 'Queued' }
    case 'processing':
      return { tone: 'pink', label: 'Processing' }
    case 'failed':
      return { tone: 'danger', label: 'Failed' }
    case 'disabled':
      return { tone: 'warning', label: 'Disabled' }
    default:
      return { tone: 'default', label: status }
  }
}

export function membershipSourceLabel(source: string): string {
  switch (source) {
    case 'owner':
      return 'Owner claim'
    case 'manual':
      return 'Added manually'
    case 'invite_link':
      return 'Share link'
    case 'email_invite':
      return 'Email invite'
    case 'discord_role_map':
      return 'Discord role'
    case 'default_role':
      return 'Default role'
    default:
      return source
  }
}

export function percent(used: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.round((used / total) * 100))
}

export function displayName(user: { name?: string | null; discordUsername?: string | null } | null | undefined): string {
  if (!user) return 'Removed user'
  return user.name || user.discordUsername || 'Member'
}

export function avatarSrc(user: { image?: string | null; discordUserId?: string | null; discordAvatar?: string | null } | null | undefined): string | null {
  if (!user) return null
  if (user.discordUserId && user.discordAvatar) {
    const ext = user.discordAvatar.startsWith('a_') ? 'gif' : 'png'
    return `https://cdn.discordapp.com/avatars/${user.discordUserId}/${user.discordAvatar}.${ext}?size=64`
  }
  return user.image ?? null
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join('')
}

export function relativeDays(from: Date, to = new Date()): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000)
}
