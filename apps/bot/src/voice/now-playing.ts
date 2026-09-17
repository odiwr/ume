import {
  PermissionFlagsBits,
  type Client,
  type GuildTextBasedChannel,
  type Message,
} from 'discord.js'
import { getStorage } from '@ume/storage'
import { db, getWorkspaceByGuildId } from '../lib/db'
import { logger } from '../lib/logger'
import { formatMs, truncate, umeEmbed } from '../lib/embeds'
import type { QueueItem } from './player'

/** Minimum gap between two Discord writes (card edit + status line) for one guild. */
const MIN_FLUSH_GAP_MS = 5_000
/** Discord caps presigned links at 7 days for SigV4; the media proxy caches the image anyway. */
const COVER_PRESIGN_SEC = 7 * 24 * 60 * 60
const NOTICE_CACHE_MS = 5 * 60 * 1000
const VOICE_STATUS_MAX = 500

export type NowPlayingState =
  | { kind: 'playing'; item: QueueItem; startedAtMs: number; next: QueueItem | null }
  | { kind: 'paused'; item: QueueItem; elapsedMs: number; next: QueueItem | null }
  | { kind: 'stopped' }

function trackLine(item: QueueItem): string {
  return item.track.artist ? `${item.track.title} — ${item.track.artist}` : item.track.title
}

function progressBar(fraction: number, width = 16): string {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)))
  return `${'━'.repeat(filled)}●${'─'.repeat(width - filled)}`
}

/**
 * The "Spotify-like" surface a bot can actually control, per guild:
 * - the voice channel status line ("▶ Title — Artist"), and
 * - one now-playing card in the voice channel's text chat (or the notice channel), edited in
 *   place when the track changes instead of posting a new message each time.
 * Progress is a Discord timestamp that ticks client-side, so there are no per-second edits.
 * Everything is best effort: missing permissions are skipped silently and never touch playback.
 */
export class NowPlaying {
  private readonly client: Client<true>
  private readonly guildId: string
  private readonly workspaceId: string
  private voiceChannelId: string | null = null

  private desired: NowPlayingState = { kind: 'stopped' }
  private timer: NodeJS.Timeout | null = null
  private flushing = false
  private lastFlushAt = 0
  private disposed = false

  private message: Message | null = null
  private lastStatus: string | null = null
  private statusChannelId: string | null = null
  private coverCache: { trackId: string; url: string | null } | null = null
  private notice: { id: string | null; at: number } | null = null

  constructor(client: Client<true>, guildId: string, workspaceId: string) {
    this.client = client
    this.guildId = guildId
    this.workspaceId = workspaceId
  }

  setVoiceChannel(id: string | null): void {
    if (id === this.voiceChannelId) return
    // The old channel keeps its status line otherwise.
    if (this.voiceChannelId && this.lastStatus) void this.putStatus(this.voiceChannelId, '')
    this.voiceChannelId = id
    this.lastStatus = null
    if (this.desired.kind !== 'stopped') this.schedule()
  }

  update(state: NowPlayingState): void {
    if (this.disposed) return
    this.desired = state
    this.schedule()
  }

  /** Stop timers. Leaves a final "stopped" write running if one was pending. */
  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
      void this.flush()
    }
  }

  private schedule(): void {
    if (this.timer || this.flushing) return
    const wait = Math.max(0, this.lastFlushAt + MIN_FLUSH_GAP_MS - Date.now())
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, wait)
  }

  private async flush(): Promise<void> {
    if (this.flushing) return
    this.flushing = true
    this.lastFlushAt = Date.now()
    const state = this.desired
    try {
      await this.syncStatus(state)
      await this.syncCard(state)
    } catch (err) {
      logger.debug({ err, guildId: this.guildId }, 'now playing update failed')
    } finally {
      this.flushing = false
    }
    // State changed while we were writing: one more pass, still rate limited.
    if (!this.disposed && state !== this.desired) this.schedule()
  }

  // -------------------------------------------------------------- status line

  private async syncStatus(state: NowPlayingState): Promise<void> {
    const channelId = this.voiceChannelId
    if (!channelId) return
    const status =
      state.kind === 'playing'
        ? truncate(`▶ ${trackLine(state.item)}`, VOICE_STATUS_MAX)
        : state.kind === 'paused'
          ? truncate(`⏸ ${trackLine(state.item)}`, VOICE_STATUS_MAX)
          : ''
    if (this.statusChannelId === channelId && this.lastStatus === status) return
    await this.putStatus(channelId, status)
    this.statusChannelId = channelId
    this.lastStatus = status
  }

  /** Needs Set Voice Channel Status (Ume allows itself this in its home channel when it can). */
  private async putStatus(channelId: string, status: string): Promise<void> {
    try {
      await this.client.rest.put(`/channels/${channelId}/voice-status`, { body: { status } })
    } catch {
      // Missing permission or unsupported channel type: skip silently.
    }
  }

  // --------------------------------------------------------------------- card

  private async syncCard(state: NowPlayingState): Promise<void> {
    if (state.kind === 'stopped') {
      const msg = this.message
      this.message = null
      if (!msg) return
      await msg
        .edit({
          embeds: [
            umeEmbed({
              description: 'Stopped. `/play` a playlist to start again.',
              thumbnail: null,
            }),
          ],
        })
        .catch(() => {})
      return
    }

    const channel = await this.targetChannel()
    if (!channel) return
    const embed = umeEmbed(await this.cardInput(state))

    const prev = this.message
    // Edit in place while the card is still the latest message there; otherwise re-post it at
    // the bottom and remove the old one, so chat never fills with now-playing cards.
    if (prev && prev.channelId === channel.id && channel.lastMessageId === prev.id) {
      try {
        this.message = await prev.edit({ embeds: [embed] })
        return
      } catch {
        this.message = null
      }
    }
    try {
      this.message = await channel.send({ embeds: [embed], allowedMentions: { parse: [] } })
    } catch {
      this.message = prev
      return
    }
    if (prev) await prev.delete().catch(() => {})
  }

  private async cardInput(state: Exclude<NowPlayingState, { kind: 'stopped' }>) {
    const { item } = state
    const t = item.track
    const total = t.durationMs ?? 0
    const lines: string[] = []
    const byline = [t.artist ? `by **${t.artist}**` : null, t.album].filter(Boolean).join(' · ')
    if (byline) lines.push(byline)
    if (state.kind === 'playing') {
      const started = Math.floor(state.startedAtMs / 1000)
      const ends = total ? Math.floor((state.startedAtMs + total) / 1000) : null
      // Discord renders these relative timestamps live, so the line stays current without edits.
      lines.push(
        ends ? `Started <t:${started}:R> · ends <t:${ends}:R>` : `Started <t:${started}:R>`,
      )
    } else {
      lines.push(
        `${progressBar(total ? state.elapsedMs / total : 0)} ${formatMs(state.elapsedMs)} / ${formatMs(total)}`,
        'Paused',
      )
    }
    const fields = [
      { name: 'Playlist', value: item.playlistName ?? '—', inline: true },
      { name: 'Added by', value: item.addedBy ?? '—', inline: true },
      { name: 'Length', value: total ? formatMs(total) : '—', inline: true },
    ]
    if (state.next)
      fields.push({ name: 'Up next', value: truncate(trackLine(state.next), 200), inline: false })
    return {
      title: truncate(`${state.kind === 'paused' ? '⏸' : '▶'} ${t.title}`, 256),
      description: lines.join('\n'),
      fields,
      thumbnail: (await this.coverUrl(item)) ?? undefined,
    }
  }

  private async coverUrl(item: QueueItem): Promise<string | null> {
    const t = item.track
    if (this.coverCache?.trackId === t.id) return this.coverCache.url
    let url: string | null = t.coverUrl && /^https?:\/\//.test(t.coverUrl) ? t.coverUrl : null
    if (!url && t.coverStorageKey) {
      try {
        const storage = getStorage()
        url =
          storage.publicUrl(t.coverStorageKey) ??
          (await storage.presignDownload(t.coverStorageKey, COVER_PRESIGN_SEC))
      } catch {
        url = null
      }
    }
    this.coverCache = { trackId: t.id, url }
    return url
  }

  /** The home voice channel's text chat when Ume can post there, else the notice channel. */
  private async targetChannel(): Promise<GuildTextBasedChannel | null> {
    const guild = this.client.guilds.cache.get(this.guildId)
    const me = guild?.members.me
    if (!guild || !me) return null
    const needed = [
      PermissionFlagsBits.ViewChannel,
      PermissionFlagsBits.SendMessages,
      PermissionFlagsBits.EmbedLinks,
    ]

    const candidates: string[] = []
    if (this.voiceChannelId) candidates.push(this.voiceChannelId)
    const noticeId = await this.noticeChannelId()
    if (noticeId) candidates.push(noticeId)

    for (const id of candidates) {
      const ch = guild.channels.cache.get(id)
      if (!ch || !ch.isTextBased() || !ch.isSendable() || ch.isThread()) continue
      if (!ch.permissionsFor(me).has(needed)) continue
      return ch
    }
    return null
  }

  private async noticeChannelId(): Promise<string | null> {
    if (this.notice && Date.now() - this.notice.at < NOTICE_CACHE_MS) return this.notice.id
    try {
      const ws = await getWorkspaceByGuildId(db, this.guildId)
      this.notice = {
        id: ws && ws.id === this.workspaceId ? ws.noticeTextChannelId : null,
        at: Date.now(),
      }
    } catch {
      this.notice = { id: null, at: Date.now() }
    }
    return this.notice.id
  }
}
