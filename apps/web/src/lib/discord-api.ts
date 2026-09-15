import 'server-only'
import type { OAuthGuild } from '@ume/shared'

/**
 * Thin, read-only Discord REST helpers.
 *  - fetchUserGuilds uses the signed-in user's OAuth access token (guilds scope).
 *  - The bot-token helpers use DISCORD_BOT_TOKEN and only ever run on the server.
 * The bot token never reaches the client: every caller is a server component,
 * server action or route handler.
 */
const API = 'https://discord.com/api/v10'

export class DiscordApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'DiscordApiError'
  }
}

export interface DiscordGuild {
  id: string
  name: string
  icon: string | null
  owner_id: string
}

export interface DiscordRole {
  id: string
  name: string
  color: number
  position: number
  managed: boolean
  permissions: string
}

export interface DiscordChannel {
  id: string
  name: string
  /** 0 = text, 2 = voice, 4 = category, 13 = stage */
  type: number
  position: number
  parent_id: string | null
}

export interface DiscordGuildMember {
  user?: { id: string; username: string; avatar: string | null; global_name?: string | null }
  nick: string | null
  roles: string[]
  joined_at: string
}

export async function fetchUserGuilds(accessToken: string): Promise<OAuthGuild[]> {
  const res = await fetch(`${API}/users/@me/guilds`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new DiscordApiError(res.status, 'Could not load your Discord servers. Try signing in again.')
  const data = (await res.json()) as Array<{
    id: string
    name: string
    icon: string | null
    owner: boolean
    permissions: string | number
  }>
  return data.map((g) => ({
    id: g.id,
    name: g.name,
    icon: g.icon ?? null,
    owner: !!g.owner,
    permissions: String(g.permissions),
  }))
}

function botToken(): string {
  const token = process.env.DISCORD_BOT_TOKEN
  if (!token) throw new DiscordApiError(500, 'DISCORD_BOT_TOKEN is not configured.')
  return token
}

async function botGet<T>(path: string): Promise<{ status: number; data: T | null }> {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bot ${botToken()}` },
    cache: 'no-store',
  })
  if (res.status === 404 || res.status === 403) return { status: res.status, data: null }
  if (!res.ok) throw new DiscordApiError(res.status, `Discord returned ${res.status} for ${path}.`)
  return { status: res.status, data: (await res.json()) as T }
}

/** The guild as the bot sees it; null when the bot is not in the guild. */
export async function getGuild(guildId: string): Promise<DiscordGuild | null> {
  const { data } = await botGet<DiscordGuild>(`/guilds/${guildId}`)
  return data
}

/** Roles sorted highest first (Discord's position: higher = more senior). */
export async function getGuildRoles(guildId: string): Promise<DiscordRole[]> {
  const { data } = await botGet<DiscordRole[]>(`/guilds/${guildId}/roles`)
  return (data ?? []).slice().sort((a, b) => b.position - a.position)
}

/** Voice (type 2) and text (type 0) channels only, in Discord's display order. */
export async function getGuildChannels(guildId: string): Promise<{ voice: DiscordChannel[]; text: DiscordChannel[] }> {
  const { data } = await botGet<DiscordChannel[]>(`/guilds/${guildId}/channels`)
  const all = (data ?? []).slice().sort((a, b) => a.position - b.position)
  return {
    voice: all.filter((c) => c.type === 2),
    text: all.filter((c) => c.type === 0),
  }
}

/** Guild member via the bot; null when the user is not in the guild (or the bot is not). */
export async function getGuildMember(guildId: string, discordUserId: string): Promise<DiscordGuildMember | null> {
  const { data } = await botGet<DiscordGuildMember>(`/guilds/${guildId}/members/${discordUserId}`)
  return data
}

export function discordRoleColor(color: number): string | null {
  if (!color) return null
  return `#${color.toString(16).padStart(6, '0')}`
}
