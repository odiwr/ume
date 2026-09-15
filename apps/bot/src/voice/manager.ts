import {
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  joinVoiceChannel,
  type VoiceConnection,
} from '@discordjs/voice'
import { and, eq, inArray, isNotNull, not } from 'drizzle-orm'
import { ChannelType, PermissionFlagsBits, type Client, type Guild, type VoiceBasedChannel, type VoiceState } from 'discord.js'
import { BOT_HEARTBEAT_MS } from '@ume/shared'
import { db, getWorkspaceByGuildId, logAudit, setBotPresence, touchActivity, workspaces } from '../lib/db'
import { logger } from '../lib/logger'
import { umeEmbed } from '../lib/embeds'
import { destroyPlayer, ensurePlayer, getPlayer } from './player'

const EMPTY_GRACE_MS = 30_000
const BACKOFF_MIN_MS = 2_000
const BACKOFF_MAX_MS = 60_000
const MAX_REJOIN_ATTEMPTS = 10
const STAGGER_MS = 250

interface GuildVoiceState {
  homeChannelId: string
  workspaceId: string
  connection: VoiceConnection | null
  attempts: number
  rejoinTimer: NodeJS.Timeout | null
  emptyTimer: NodeJS.Timeout | null
  /** Set after MAX_REJOIN_ATTEMPTS: we stop retrying until a human shows up. */
  waitingForHuman: boolean
  /** True while we are leaving on purpose (purge, /home to a new channel, guild leave). */
  leaving: boolean
}

/**
 * Keeps Ume in its home voice channel 24/7 for every workspace, survives Discord's
 * voice server hiccups, follows when moved, and pauses when the room is empty.
 */
export class VoiceManager {
  private readonly client: Client<true>
  private readonly guilds = new Map<string, GuildVoiceState>()
  private heartbeat: NodeJS.Timeout | null = null

  constructor(client: Client<true>) {
    this.client = client
  }

  // ---------------------------------------------------------------- lifecycle

  async start(): Promise<void> {
    const rows = await db.query.workspaces.findMany({
      where: and(
        eq(workspaces.botInGuild, true),
        isNotNull(workspaces.homeVoiceChannelId),
        not(inArray(workspaces.status, ['purged', 'purging'])),
      ),
      columns: { id: true, guildId: true, homeVoiceChannelId: true },
    })
    let delay = 0
    for (const ws of rows) {
      const guild = this.client.guilds.cache.get(ws.guildId)
      if (!guild || !ws.homeVoiceChannelId) continue
      const channelId = ws.homeVoiceChannelId
      setTimeout(() => {
        this.join(guild, channelId, ws.id).catch((err) => logger.warn({ err, guildId: guild.id }, 'startup join failed'))
      }, delay)
      delay += STAGGER_MS
    }
    logger.info({ workspaces: rows.length }, 'voice manager started')
    this.heartbeat = setInterval(() => void this.tick(), BOT_HEARTBEAT_MS)
    void this.tick()
  }

  async shutdown(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat)
    for (const [guildId, st] of this.guilds) {
      st.leaving = true
      if (st.rejoinTimer) clearTimeout(st.rejoinTimer)
      if (st.emptyTimer) clearTimeout(st.emptyTimer)
      destroyPlayer(guildId)
      try {
        st.connection?.destroy()
      } catch {
        /* already destroyed */
      }
      try {
        await setBotPresence(db, guildId, { connected: false })
      } catch {
        /* db may be gone */
      }
    }
    this.guilds.clear()
  }

  /** Heartbeat: every guild the bot is in gets a fresh bot_last_seen_at. */
  private async tick(): Promise<void> {
    for (const guild of this.client.guilds.cache.values()) {
      const st = this.guilds.get(guild.id)
      const connected = st?.connection?.state.status === VoiceConnectionStatus.Ready
      const channelId = guild.members.me?.voice.channelId ?? (connected ? st?.homeChannelId : null) ?? null
      try {
        await setBotPresence(db, guild.id, { connected, voiceChannelId: channelId, inGuild: true })
      } catch (err) {
        logger.warn({ err, guildId: guild.id }, 'heartbeat failed')
      }
    }
  }

  // ------------------------------------------------------------------ joining

  getConnection(guildId: string): VoiceConnection | null {
    return this.guilds.get(guildId)?.connection ?? getVoiceConnection(guildId) ?? null
  }

  isConnected(guildId: string): boolean {
    return this.getConnection(guildId)?.state.status === VoiceConnectionStatus.Ready
  }

  homeChannelId(guildId: string): string | null {
    return this.guilds.get(guildId)?.homeChannelId ?? null
  }

  /** Join (or move to) a voice channel and remember it as home. */
  async join(guild: Guild, channelId: string, workspaceId: string): Promise<VoiceConnection> {
    const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null))
    if (!channel || !channel.isVoiceBased()) throw new Error('Home channel is not a voice channel')
    const me = guild.members.me
    if (me && !channel.permissionsFor(me).has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
      throw new Error('Ume needs Connect and Speak in that channel')
    }

    let st = this.guilds.get(guild.id)
    if (!st) {
      st = {
        homeChannelId: channelId,
        workspaceId,
        connection: null,
        attempts: 0,
        rejoinTimer: null,
        emptyTimer: null,
        waitingForHuman: false,
        leaving: false,
      }
      this.guilds.set(guild.id, st)
    }
    st.homeChannelId = channelId
    st.workspaceId = workspaceId
    st.leaving = false
    st.waitingForHuman = false
    if (st.rejoinTimer) {
      clearTimeout(st.rejoinTimer)
      st.rejoinTimer = null
    }

    const existing = st.connection ?? getVoiceConnection(guild.id)
    if (existing && existing.state.status !== VoiceConnectionStatus.Destroyed) {
      if (existing.joinConfig.channelId !== channelId) {
        // Same guild, new channel: rejoin re-uses the connection and just moves it.
        existing.rejoin({ ...existing.joinConfig, channelId })
      }
      st.connection = existing
    } else {
      const connection = joinVoiceChannel({
        channelId,
        guildId: guild.id,
        adapterCreator: guild.voiceAdapterCreator,
        selfDeaf: true,
        selfMute: false,
      })
      st.connection = connection
      this.wire(guild.id, connection)
    }

    const player = ensurePlayer(this.client, guild.id, workspaceId)
    player.attach(st.connection, channelId)

    try {
      await entersState(st.connection, VoiceConnectionStatus.Ready, 20_000)
      st.attempts = 0
      await setBotPresence(db, guild.id, { connected: true, voiceChannelId: channelId, inGuild: true }).catch(() => {})
      logger.info({ guildId: guild.id, channelId }, 'joined voice')
    } catch (err) {
      logger.warn({ err, guildId: guild.id, channelId }, 'voice connection did not become ready')
      this.scheduleRejoin(guild.id)
    }
    this.evaluateOccupancy(guild.id)
    return st.connection
  }

  /** Leave on purpose (purge / guild left). Does not clear the home channel in the DB. */
  leave(guildId: string): void {
    const st = this.guilds.get(guildId)
    if (st) {
      st.leaving = true
      if (st.rejoinTimer) clearTimeout(st.rejoinTimer)
      if (st.emptyTimer) clearTimeout(st.emptyTimer)
      st.rejoinTimer = null
      st.emptyTimer = null
    }
    destroyPlayer(guildId)
    const conn = this.getConnection(guildId)
    try {
      conn?.destroy()
    } catch {
      /* already destroyed */
    }
    this.guilds.delete(guildId)
  }

  private wire(guildId: string, connection: VoiceConnection): void {
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      const st = this.guilds.get(guildId)
      if (!st || st.leaving) return
      try {
        // The documented race: a channel move or a voice-server switch also fires
        // Disconnected, but the connection recovers on its own within a moment.
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ])
      } catch {
        try {
          connection.destroy()
        } catch {
          /* noop */
        }
        st.connection = null
        void setBotPresence(db, guildId, { connected: false, voiceChannelId: null }).catch(() => {})
        this.scheduleRejoin(guildId)
      }
    })
    connection.on(VoiceConnectionStatus.Destroyed, () => {
      const st = this.guilds.get(guildId)
      if (st && st.connection === connection) st.connection = null
    })
    connection.on('error', (err) => logger.warn({ err, guildId }, 'voice connection error'))
  }

  private scheduleRejoin(guildId: string): void {
    const st = this.guilds.get(guildId)
    if (!st || st.leaving || st.rejoinTimer) return
    if (st.attempts >= MAX_REJOIN_ATTEMPTS) {
      st.waitingForHuman = true
      logger.warn({ guildId }, 'giving up on voice rejoin until a human joins the home channel')
      return
    }
    const delay = Math.min(BACKOFF_MAX_MS, BACKOFF_MIN_MS * 2 ** st.attempts)
    st.attempts++
    st.rejoinTimer = setTimeout(async () => {
      st.rejoinTimer = null
      const guild = this.client.guilds.cache.get(guildId)
      if (!guild) return
      try {
        await this.join(guild, st.homeChannelId, st.workspaceId)
      } catch (err) {
        logger.warn({ err, guildId, attempt: st.attempts }, 'rejoin failed')
        this.scheduleRejoin(guildId)
      }
    }, delay)
    logger.info({ guildId, delay, attempt: st.attempts }, 'scheduled voice rejoin')
  }

  // ------------------------------------------------------------ voice events

  async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState): Promise<void> {
    const guild = newState.guild
    const st = this.guilds.get(guild.id)
    const isMe = newState.id === this.client.user.id

    if (isMe) {
      await this.onSelfVoiceState(oldState, newState, st)
      return
    }
    if (!st) return
    // A human joined the home channel while we had given up: try again.
    if (st.waitingForHuman && newState.channelId === st.homeChannelId && !newState.member?.user.bot) {
      st.waitingForHuman = false
      st.attempts = 0
      this.join(guild, st.homeChannelId, st.workspaceId).catch((err) => logger.warn({ err, guildId: guild.id }, 'rejoin on human failed'))
    }
    if (oldState.channelId === st.homeChannelId || newState.channelId === st.homeChannelId) this.evaluateOccupancy(guild.id)
  }

  private async onSelfVoiceState(oldState: VoiceState, newState: VoiceState, st: GuildVoiceState | undefined): Promise<void> {
    const guild = newState.guild
    if (!st || st.leaving) return
    if (oldState.channelId === newState.channelId) return

    if (!newState.channelId) {
      // Kicked / disconnected by a moderator. The Disconnected handler on the connection
      // does the retry; this is just belt and braces for the case where it never fires.
      if (!st.connection || st.connection.state.status === VoiceConnectionStatus.Destroyed) this.scheduleRejoin(guild.id)
      return
    }

    if (newState.channelId !== st.homeChannelId) {
      // Moved by an admin: the new channel becomes home.
      const previous = st.homeChannelId
      st.homeChannelId = newState.channelId
      getPlayer(guild.id)?.setVoiceChannel(newState.channelId)
      try {
        await db
          .update(workspaces)
          .set({ homeVoiceChannelId: newState.channelId, updatedAt: new Date() })
          .where(eq(workspaces.guildId, guild.id))
        await logAudit(db, {
          workspaceId: st.workspaceId,
          action: 'bot.moved',
          targetType: 'channel',
          targetId: newState.channelId,
          metadata: { from: previous, to: newState.channelId },
        })
        await touchActivity(db, st.workspaceId, { kind: 'bot_moved', metadata: { from: previous, to: newState.channelId } })
        const ws = await getWorkspaceByGuildId(db, guild.id)
        if (ws?.noticeTextChannelId) {
          const ch = guild.channels.cache.get(ws.noticeTextChannelId)
          if (ch?.isTextBased() && ch.isSendable()) {
            await ch.send({
              embeds: [umeEmbed({ description: `Moved to <#${newState.channelId}> — that is my home now.`, thumbnail: null })],
            })
          }
        }
      } catch (err) {
        logger.warn({ err, guildId: guild.id }, 'failed to record bot move')
      }
      this.evaluateOccupancy(guild.id)
    }
  }

  /** The home channel was deleted: forget it and tell the server. */
  async onChannelDelete(guildId: string, channelId: string): Promise<void> {
    const st = this.guilds.get(guildId)
    if (!st || st.homeChannelId !== channelId) return
    st.leaving = true
    if (st.rejoinTimer) clearTimeout(st.rejoinTimer)
    if (st.emptyTimer) clearTimeout(st.emptyTimer)
    destroyPlayer(guildId)
    try {
      st.connection?.destroy()
    } catch {
      /* noop */
    }
    this.guilds.delete(guildId)
    try {
      await db
        .update(workspaces)
        .set({ homeVoiceChannelId: null, botVoiceChannelId: null, botConnected: false, updatedAt: new Date() })
        .where(eq(workspaces.guildId, guildId))
      await logAudit(db, { workspaceId: st.workspaceId, action: 'bot.home_deleted', targetType: 'channel', targetId: channelId })
      const ws = await getWorkspaceByGuildId(db, guildId)
      const guild = this.client.guilds.cache.get(guildId)
      const noticeId = ws?.noticeTextChannelId ?? guild?.systemChannelId ?? null
      const ch = noticeId ? guild?.channels.cache.get(noticeId) : null
      if (ch?.isTextBased() && ch.isSendable()) {
        await ch.send({
          embeds: [
            umeEmbed({
              title: 'My home channel was deleted',
              description: 'Run `/home` in a voice channel (or `/home #channel`) to give me a new one.',
              thumbnail: null,
            }),
          ],
        })
      }
    } catch (err) {
      logger.warn({ err, guildId }, 'failed to handle home channel delete')
    }
  }

  // ------------------------------------------------------------- auto-pause

  /** Humans (non-bots) currently in the home channel. */
  humansInHome(guildId: string): number {
    const st = this.guilds.get(guildId)
    if (!st) return 0
    const guild = this.client.guilds.cache.get(guildId)
    const ch = guild?.channels.cache.get(st.homeChannelId) as VoiceBasedChannel | undefined
    if (!ch || (ch.type !== ChannelType.GuildVoice && ch.type !== ChannelType.GuildStageVoice)) return 0
    return ch.members.filter((m) => !m.user.bot).size
  }

  /** 0 humans for 30 s -> pause; someone present -> unpause (or restart the last playlist). */
  evaluateOccupancy(guildId: string): void {
    const st = this.guilds.get(guildId)
    if (!st) return
    const humans = this.humansInHome(guildId)
    const player = getPlayer(guildId)
    if (humans === 0) {
      if (st.emptyTimer) return
      st.emptyTimer = setTimeout(() => {
        st.emptyTimer = null
        if (this.humansInHome(guildId) === 0 && player?.isPlaying) {
          player.pause()
          logger.info({ guildId }, 'auto-paused: channel empty')
        }
      }, EMPTY_GRACE_MS)
      return
    }
    if (st.emptyTimer) {
      clearTimeout(st.emptyTimer)
      st.emptyTimer = null
    }
    if (!player) return
    if (player.isPaused) {
      player.unpause()
      logger.info({ guildId }, 'auto-resumed: someone joined')
    } else if (!player.isPlaying && !player.current && player.playlist) {
      void player.restartLastPlaylist()
    }
  }
}
