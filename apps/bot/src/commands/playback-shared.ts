import { errorEmbed } from '../lib/embeds'
import { db, listPlaylistTracks, type Playlist, type Workspace } from '../lib/db'
import { voice, ensurePlayer, type GuildPlayer, type QueueItem } from '../voice'
import type { CommandContext } from './context'

/** The guild player, joining the home channel first if the connection dropped. Replies and returns null on failure. */
export async function requirePlayer(ctx: CommandContext, ws: Workspace, opts: { joinIfNeeded?: boolean } = {}): Promise<GuildPlayer | null> {
  const guild = ctx.guild!
  const v = voice()
  if (!v.isConnected(guild.id)) {
    if (!ws.homeVoiceChannelId) {
      await ctx.reply({ embeds: [errorEmbed('I have no home channel yet. Join a voice channel and run `/home`.', 'No home channel')] })
      return null
    }
    if (!opts.joinIfNeeded) {
      await ctx.reply({ embeds: [errorEmbed(`I am not connected to <#${ws.homeVoiceChannelId}> right now — reconnecting. Try again in a moment.`, 'Not connected')] })
      v.join(guild, ws.homeVoiceChannelId, ws.id).catch(() => {})
      return null
    }
    try {
      await v.join(guild, ws.homeVoiceChannelId, ws.id)
    } catch (err) {
      await ctx.reply({ embeds: [errorEmbed(`Could not join <#${ws.homeVoiceChannelId}>: ${(err as Error).message}`, 'Could not join')] })
      return null
    }
  }
  return ensurePlayer(ctx.client, guild.id, ws.id)
}

export function addedByLabel(entry: { addedByUserId: string | null; addedByDiscordId: string | null; addedBy?: { name: string } | null }): string | null {
  if (entry.addedByDiscordId) return `<@${entry.addedByDiscordId}>`
  if (entry.addedBy?.name) return entry.addedBy.name
  return null
}

/** Playable items of a playlist plus how many linked-only entries were skipped. */
export async function playlistQueue(playlist: Playlist): Promise<{ items: QueueItem[]; skippedLinked: number; notReady: number }> {
  const rows = await listPlaylistTracks(db, playlist.id)
  const items: QueueItem[] = []
  let skippedLinked = 0
  let notReady = 0
  for (const r of rows) {
    if (r.track.status !== 'ready') {
      notReady++
      continue
    }
    if (!r.track.storageKey) {
      skippedLinked++
      continue
    }
    items.push({ track: r.track, playlistName: playlist.name, addedBy: addedByLabel(r) })
  }
  return { items, skippedLinked, notReady }
}

export function itemLabel(item: QueueItem): string {
  return item.track.artist ? `${item.track.artist} — ${item.track.title}` : item.track.title
}
