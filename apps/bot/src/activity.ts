import type { Client, VoiceState } from 'discord.js'
import { db, getWorkspaceByGuildId, touchActivity } from './lib/db'
import { logger } from './lib/logger'
import type { VoiceManager } from './voice/manager'

const DEBOUNCE_MS = 60_000
const lastTouch = new Map<string, number>()

/** Record "a human is in the room" at most once a minute per guild. */
export async function touchVoiceJoin(workspaceId: string, guildId: string, discordUserId: string | null): Promise<void> {
  const now = Date.now()
  if (now - (lastTouch.get(guildId) ?? 0) < DEBOUNCE_MS) return
  lastTouch.set(guildId, now)
  try {
    await touchActivity(db, workspaceId, { kind: 'voice_join', discordUserId })
  } catch (err) {
    logger.warn({ err, guildId }, 'failed to record voice_join')
  }
}

/** Human joined the home channel -> activity. Leaving is handled by auto-pause only. */
export async function onVoiceStateUpdate(voice: VoiceManager, oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (newState.member?.user.bot) return
  const home = voice.homeChannelId(newState.guild.id)
  if (!home) return
  if (newState.channelId === home && oldState.channelId !== home) {
    const ws = await getWorkspaceByGuildId(db, newState.guild.id)
    if (ws) await touchVoiceJoin(ws.id, newState.guild.id, newState.id)
  }
}

/** Startup: if people are already sitting in a home channel, count that as activity once. */
export async function startupScan(client: Client<true>, voice: VoiceManager): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    try {
      const home = voice.homeChannelId(guild.id)
      if (!home) continue
      if (voice.humansInHome(guild.id) > 0) {
        const ws = await getWorkspaceByGuildId(db, guild.id)
        if (ws) await touchVoiceJoin(ws.id, guild.id, null)
      }
    } catch (err) {
      logger.warn({ err, guildId: guild.id }, 'startup activity scan failed')
    }
  }
}
