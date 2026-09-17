/**
 * Discord permission bits we care about (BigInt-safe helpers).
 * https://discord.com/developers/docs/topics/permissions
 */
export const DISCORD_PERM = {
  ADMINISTRATOR: 1n << 3n,
  MANAGE_GUILD: 1n << 5n,
  MANAGE_CHANNELS: 1n << 4n,
} as const

/** A guild as returned by OAuth2 `/users/@me/guilds` (identify + guilds scopes). */
export interface OAuthGuild {
  id: string
  name: string
  icon: string | null
  owner: boolean
  permissions: string // stringified bitfield
}

export function permissionsInclude(permissions: string | bigint, bit: bigint): boolean {
  const p = typeof permissions === 'bigint' ? permissions : BigInt(permissions)
  return (p & bit) === bit
}

/**
 * "Highest members" of a server: the owner, or anyone with Administrator.
 * Manage Server alone is deliberately NOT enough to claim/rotate/purge a workspace.
 */
export function canClaimGuild(g: Pick<OAuthGuild, 'owner' | 'permissions'>): boolean {
  return g.owner || permissionsInclude(g.permissions, DISCORD_PERM.ADMINISTRATOR)
}

export function guildIconUrl(guildId: string, icon: string | null, size = 128): string | null {
  if (!icon) return null
  const ext = icon.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/icons/${guildId}/${icon}.${ext}?size=${size}`
}

export function userAvatarUrl(userId: string, avatar: string | null, size = 128): string {
  if (!avatar) {
    // Default avatar index for new username system: (id >> 22) % 6
    const idx = Number((BigInt(userId) >> 22n) % 6n)
    return `https://cdn.discordapp.com/embed/avatars/${idx}.png`
  }
  const ext = avatar.startsWith('a_') ? 'gif' : 'png'
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${ext}?size=${size}`
}

/**
 * Permissions requested by the install link: View Channels (1<<10), Send Messages (1<<11),
 * Embed Links (1<<14), Read Message History (1<<16), Connect (1<<20), Speak (1<<21),
 * Manage Roles (1<<28), Use Application Commands (1<<31), Set Voice Channel Status (1<<48).
 *
 * Manage Roles lets Ume add a member overwrite for itself in its home voice channel when a
 * channel or role overwrite denies it Connect/Speak. Discord only lets a bot allow permissions it
 * already holds at server level, so the overwrite can never exceed this list. Ume never requests
 * Administrator or Manage Channels.
 */
export const BOT_INVITE_PERMISSIONS: bigint =
  (1n << 10n) |
  (1n << 11n) |
  (1n << 14n) |
  (1n << 16n) |
  (1n << 20n) |
  (1n << 21n) |
  (1n << 28n) |
  (1n << 31n) |
  (1n << 48n)

/** Bot install URL with the permissions Ume needs ({@link BOT_INVITE_PERMISSIONS}). */
export function botInviteUrl(clientId: string, guildId?: string): string {
  const perms = BOT_INVITE_PERMISSIONS
  const url = new URL('https://discord.com/oauth2/authorize')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('scope', 'bot applications.commands')
  url.searchParams.set('permissions', perms.toString())
  if (guildId) {
    url.searchParams.set('guild_id', guildId)
    url.searchParams.set('disable_guild_select', 'true')
  }
  return url.toString()
}

/** Extract a YouTube video id from the many URL shapes people paste. */
export function parseYouTubeId(input: string): string | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '')
  const idOk = (v: string | null) => (v && /^[A-Za-z0-9_-]{11}$/.test(v) ? v : null)
  if (host === 'youtu.be') return idOk(url.pathname.slice(1).split('/')[0] ?? null)
  if (host === 'youtube.com' || host === 'music.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') return idOk(url.searchParams.get('v'))
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/)
    if (m) return idOk(m[1] ?? null)
  }
  return null
}
