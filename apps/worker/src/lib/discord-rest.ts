import type { Logger } from 'pino'
import { env } from './env'

/**
 * The worker only ever *sends* to Discord (inactivity notices, purge confirmations), so a
 * few plain REST calls are enough — no gateway, no discord.js. Every function here logs
 * and returns a result; none of them throw to the caller.
 */
const API = 'https://discord.com/api/v10'

export type DiscordSendResult =
  { ok: true; id: string } | { ok: false; reason: string; code?: number }

/** Discord JSON error code for "Cannot send messages to this user" (DMs closed / blocked). */
export const CANNOT_DM = 50007

interface DiscordError {
  code?: number
  message?: string
}

async function call(
  log: Logger,
  method: string,
  path: string,
  body?: unknown,
): Promise<
  { ok: true; json: unknown } | { ok: false; reason: string; code?: number; status?: number }
> {
  if (!env.discordBotToken) return { ok: false, reason: 'DISCORD_BOT_TOKEN is not set' }
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bot ${env.discordBotToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'DiscordBot (https://ume.app, worker)',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get('retry-after') ?? '1')
      log.warn({ path, retryAfter }, 'discord rate limited; retrying once')
      await new Promise((r) => setTimeout(r, Math.min(retryAfter, 10) * 1000))
      return call(log, method, path, body)
    }
    const text = await res.text()
    let json: unknown = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    if (!res.ok) {
      const e = (json ?? {}) as DiscordError
      const reason = e.message ?? `HTTP ${res.status}`
      log.warn({ path, status: res.status, code: e.code, reason }, 'discord request failed')
      return { ok: false, reason, code: e.code, status: res.status }
    }
    return { ok: true, json }
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    log.warn({ path, err: reason }, 'discord request errored')
    return { ok: false, reason }
  }
}

/** Opens (or reuses) the DM channel with a user and posts `content`. 50007 is reported as "cannot DM". */
export async function dmUser(
  log: Logger,
  discordUserId: string,
  content: string,
): Promise<DiscordSendResult> {
  const ch = await call(log, 'POST', '/users/@me/channels', { recipient_id: discordUserId })
  if (!ch.ok) return { ok: false, reason: ch.reason, code: ch.code }
  const channelId = (ch.json as { id?: string } | null)?.id
  if (!channelId) return { ok: false, reason: 'no DM channel id in response' }
  const msg = await call(log, 'POST', `/channels/${channelId}/messages`, {
    content,
    allowed_mentions: { parse: [] },
  })
  if (!msg.ok) {
    if (msg.code === CANNOT_DM)
      return {
        ok: false,
        reason: 'cannot DM this user (DMs closed or bot blocked)',
        code: CANNOT_DM,
      }
    return { ok: false, reason: msg.reason, code: msg.code }
  }
  return { ok: true, id: (msg.json as { id?: string } | null)?.id ?? '' }
}

export async function postToChannel(
  log: Logger,
  channelId: string,
  content: string,
): Promise<DiscordSendResult> {
  const msg = await call(log, 'POST', `/channels/${channelId}/messages`, {
    content,
    allowed_mentions: { parse: [] },
  })
  if (!msg.ok) return { ok: false, reason: msg.reason, code: msg.code }
  return { ok: true, id: (msg.json as { id?: string } | null)?.id ?? '' }
}

export interface GuildInfo {
  id: string
  name: string
  systemChannelId: string | null
  ownerId: string | null
}

export async function getGuild(log: Logger, guildId: string): Promise<GuildInfo | null> {
  const res = await call(log, 'GET', `/guilds/${guildId}`)
  if (!res.ok) return null
  const g = res.json as {
    id?: string
    name?: string
    system_channel_id?: string | null
    owner_id?: string | null
  } | null
  if (!g?.id) return null
  return {
    id: g.id,
    name: g.name ?? '',
    systemChannelId: g.system_channel_id ?? null,
    ownerId: g.owner_id ?? null,
  }
}
