import {
  AudioPlayerStatus,
  NoSubscriberBehavior,
  StreamType,
  createAudioPlayer,
  createAudioResource,
  type AudioPlayer,
  type AudioResource,
  type VoiceConnection,
} from '@discordjs/voice'
import { eq, sql } from '../lib/orm'
import { getStorage } from '@ume/storage'
import type { Client } from 'discord.js'
import { db, tracks, touchActivity, type Track } from '../lib/db'
import { logger } from '../lib/logger'
import { NowPlaying } from './now-playing'

/** A queued item carries the track plus the "who added it" line for /np. */
export interface QueueItem {
  track: Track
  playlistName: string | null
  addedBy: string | null
}

const ACTIVITY_DEBOUNCE_MS = 5 * 60 * 1000

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/**
 * One player per guild. Streams normalized Ogg/Opus straight from object storage —
 * no ffmpeg, no transcoding. A playlist loops forever: when the queue runs dry it is
 * reshuffled and started again.
 */
export class GuildPlayer {
  readonly player: AudioPlayer
  readonly guildId: string
  readonly workspaceId: string
  private readonly client: Client<true>
  queue: QueueItem[] = []
  current: QueueItem | null = null
  /** Source pool for looping; null when playing an ad-hoc search result. */
  playlist: { id: string; name: string; items: QueueItem[] } | null = null
  startedAt: Date | null = null
  private resource: AudioResource<QueueItem> | null = null
  private lastActivityTouch = 0
  private stopping = false
  /** Voice channel status line + the now-playing card in chat. */
  private readonly nowPlaying: NowPlaying

  constructor(client: Client<true>, guildId: string, workspaceId: string) {
    this.client = client
    this.guildId = guildId
    this.workspaceId = workspaceId
    this.nowPlaying = new NowPlaying(client, guildId, workspaceId)
    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause, maxMissedFrames: 250 },
    })
    this.player.on(AudioPlayerStatus.Idle, (old) => {
      if (old.status === AudioPlayerStatus.Idle) return
      if (this.stopping) return
      void this.next()
    })
    this.player.on('error', (err) => {
      logger.warn(
        { err, guildId: this.guildId, track: this.current?.track.id },
        'audio player error, skipping',
      )
      void this.next()
    })
  }

  attach(connection: VoiceConnection, voiceChannelId: string | null): void {
    connection.subscribe(this.player)
    this.nowPlaying.setVoiceChannel(voiceChannelId)
  }

  setVoiceChannel(id: string | null): void {
    this.nowPlaying.setVoiceChannel(id)
  }

  get status(): AudioPlayerStatus {
    return this.player.state.status
  }

  get isPlaying(): boolean {
    return this.status === AudioPlayerStatus.Playing || this.status === AudioPlayerStatus.Buffering
  }

  get isPaused(): boolean {
    return this.status === AudioPlayerStatus.Paused || this.status === AudioPlayerStatus.AutoPaused
  }

  /** Milliseconds of the current track already played. */
  get elapsedMs(): number {
    return this.resource?.playbackDuration ?? 0
  }

  /** Replace the queue with a shuffled playlist and start it. */
  async playPlaylist(playlist: { id: string; name: string }, items: QueueItem[]): Promise<void> {
    this.playlist = { id: playlist.id, name: playlist.name, items }
    this.queue = shuffle(items)
    this.stopping = false
    await this.next()
  }

  /** Play a one-off list (search result); playlist looping is disabled. */
  async playItems(items: QueueItem[]): Promise<void> {
    this.playlist = null
    this.queue = items.slice()
    this.stopping = false
    await this.next()
  }

  /** Restart the last playlist (used by auto-resume when someone joins an idle channel). */
  async restartLastPlaylist(): Promise<boolean> {
    if (!this.playlist || !this.playlist.items.length) return false
    await this.playPlaylist({ id: this.playlist.id, name: this.playlist.name }, this.playlist.items)
    return true
  }

  pause(): boolean {
    const ok = this.player.pause(true)
    if (ok) this.publishNowPlaying()
    return ok
  }

  unpause(): boolean {
    const ok = this.player.unpause()
    if (ok) this.publishNowPlaying()
    return ok
  }

  /** Push the current state to the status line and the now-playing card (rate limited there). */
  private publishNowPlaying(): void {
    const item = this.current
    if (!item) {
      this.nowPlaying.update({ kind: 'stopped' })
      return
    }
    const next = this.queue[0] ?? null
    if (this.isPaused) {
      this.nowPlaying.update({ kind: 'paused', item, elapsedMs: this.elapsedMs, next })
    } else {
      this.nowPlaying.update({
        kind: 'playing',
        item,
        startedAtMs: Date.now() - this.elapsedMs,
        next,
      })
    }
  }

  skip(): void {
    // Stopping the player emits Idle -> next().
    this.player.stop(true)
  }

  stop(): void {
    this.stopping = true
    this.queue = []
    this.playlist = null
    this.current = null
    this.resource = null
    this.startedAt = null
    this.player.stop(true)
    this.nowPlaying.update({ kind: 'stopped' })
  }

  destroy(): void {
    this.stop()
    this.nowPlaying.dispose()
    this.player.removeAllListeners()
  }

  async next(): Promise<void> {
    if (this.stopping) return
    if (!this.queue.length && this.playlist?.items.length) this.queue = shuffle(this.playlist.items)
    const item = this.queue.shift()
    if (!item) {
      this.current = null
      this.resource = null
      this.startedAt = null
      this.nowPlaying.update({ kind: 'stopped' })
      return
    }
    if (!item.track.storageKey) return this.next()
    try {
      const { stream } = await getStorage().getObjectStream(item.track.storageKey)
      const resource = createAudioResource(stream, {
        inputType: StreamType.OggOpus,
        inlineVolume: false,
        metadata: item,
      })
      this.current = item
      this.resource = resource
      this.startedAt = new Date()
      this.player.play(resource)
      this.nowPlaying.update({
        kind: 'playing',
        item,
        startedAtMs: Date.now(),
        next: this.queue[0] ?? null,
      })
      void this.afterStart(item)
    } catch (err) {
      logger.warn(
        { err, guildId: this.guildId, track: item.track.id },
        'could not open track stream, skipping',
      )
      // Avoid a hot loop over a broken playlist: only continue if something else is queued.
      if (this.queue.length) return this.next()
      this.current = null
      this.resource = null
      this.nowPlaying.update({ kind: 'stopped' })
    }
  }

  private async afterStart(item: QueueItem): Promise<void> {
    try {
      await db
        .update(tracks)
        .set({ playCount: sql`${tracks.playCount} + 1`, lastPlayedAt: new Date() })
        .where(eq(tracks.id, item.track.id))
      const now = Date.now()
      if (now - this.lastActivityTouch > ACTIVITY_DEBOUNCE_MS) {
        this.lastActivityTouch = now
        await touchActivity(db, this.workspaceId, {
          kind: 'play',
          metadata: { trackId: item.track.id, playlistId: this.playlist?.id ?? null },
        })
      }
    } catch (err) {
      logger.warn({ err, guildId: this.guildId }, 'failed to record play')
    }
  }
}

const players = new Map<string, GuildPlayer>()

export function getPlayer(guildId: string): GuildPlayer | undefined {
  return players.get(guildId)
}

export function ensurePlayer(
  client: Client<true>,
  guildId: string,
  workspaceId: string,
): GuildPlayer {
  let p = players.get(guildId)
  if (!p) {
    p = new GuildPlayer(client, guildId, workspaceId)
    players.set(guildId, p)
  }
  return p
}

export function destroyPlayer(guildId: string): void {
  const p = players.get(guildId)
  if (!p) return
  p.destroy()
  players.delete(guildId)
}

export function allPlayers(): GuildPlayer[] {
  return [...players.values()]
}
