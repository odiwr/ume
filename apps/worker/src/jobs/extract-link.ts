import {
  JOBS,
  LINK_EXTRACT,
  SUPPORTED_LINK_SITES,
  linkSiteLabel,
  parseMediaLink,
  type LinkSite,
  type MediaLink,
} from '@ume/shared'
import { getFlag, tracks, workspaces, type Track } from '@ume/db'
import { and, eq } from '../lib/orm'
import { env } from '../lib/env'
import { PermanentError, describeError, isRetryable, userMessageOf } from '../lib/errors'
import { fetchImageBuffer, fetchLinkAudio } from '../lib/extractors'
import { failTrack, loadTrack, processLocalAudio, setProcessing } from '../lib/media'
import { withTempDir } from '../lib/tmp'
import { defineJob, willRetry } from './types'

/** Logged once at boot whenever the link_extract flag is on. */
export const YOUTUBE_TOS_WARNING =
  'WARNING: the link_extract flag is ON, so "add a song from a link" will download audio from YouTube. ' +
  'Downloading YouTube content is against the YouTube Terms of Service ("Permissions and Restrictions") and is why Groovy and Rythm were shut down in 2021. ' +
  'Mitigations in place: owners accept a rights attestation, takedowns block content hashes, yt-dlp/Cobalt run behind a provider interface that can live on a residential connection (WORKER_QUEUES=extract-link), ' +
  'and the CEO console can turn the flag off (links then become metadata-only entries). Ume never markets this as a converter.'

const THUMBNAIL_TIMEOUT_MS = 10_000
const SITES = new Set<string>(SUPPORTED_LINK_SITES.map((s) => s.site))

/**
 * The job payload may be sparse (older enqueuers only send `sourceId`); the track row is the
 * source of truth. Returns a parsed link or null when nothing usable exists.
 */
function resolveLink(
  data: { sourceSite?: string; sourceId?: string; sourceUrl?: string },
  track: Track,
): MediaLink | null {
  const site = (data.sourceSite || track.sourceSite || '') as string
  const id = data.sourceId || track.sourceId || ''
  const url = data.sourceUrl || track.sourceUrl || ''
  const fromUrl = url ? parseMediaLink(url) : null
  if (fromUrl) return fromUrl
  if (!SITES.has(site) || !id) {
    // Legacy rows: a bare 11-char YouTube id with no site recorded.
    if (!site && /^[\w-]{11}$/.test(id))
      return { site: 'youtube', id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` }
    return null
  }
  const s = site as LinkSite
  switch (s) {
    case 'youtube':
      return /^[\w-]{11}$/.test(id)
        ? { site: s, id, canonicalUrl: `https://www.youtube.com/watch?v=${id}` }
        : null
    case 'soundcloud':
      return { site: s, id, canonicalUrl: `https://soundcloud.com/${id}` }
    case 'bandcamp': {
      const [sub, slug] = id.split('/')
      return sub && slug
        ? { site: s, id, canonicalUrl: `https://${sub}.bandcamp.com/track/${slug}` }
        : null
    }
    case 'audius':
      return { site: s, id, canonicalUrl: `https://audius.co/${id}` }
    case 'mixcloud':
      return { site: s, id, canonicalUrl: `https://www.mixcloud.com/${id}/` }
    case 'vimeo':
      return /^\d{5,}$/.test(id) ? { site: s, id, canonicalUrl: `https://vimeo.com/${id}` } : null
    case 'archive':
      return { site: s, id, canonicalUrl: `https://archive.org/details/${id}` }
    case 'direct':
      return null // a direct link is only usable with its URL
    default:
      return null
  }
}

/**
 * extract-link {trackId, workspaceId, sourceSite, sourceId, sourceUrl}
 * With the global flag or the workspace switch off, the track stays a metadata-only entry
 * (ready, no storage key). Otherwise the configured provider fetches the audio and the track
 * goes through the same transcode / dedupe / quota path as an upload.
 */
export const extractLink = defineJob({
  name: JOBS.extractLink,
  concurrency: 1,
  async run(ctx, job) {
    const { trackId, workspaceId } = job.data
    const log = ctx.log.child({ job: job.name, jobId: job.id, trackId, workspaceId })
    const db = ctx.db

    const track = await loadTrack(db, workspaceId, trackId)
    if (!track) return void log.warn('track not found; skipping')
    if (track.source !== 'link')
      return void log.warn({ source: track.source }, 'not a link track; skipping')
    if (track.status === 'ready' && track.storageKey)
      return void log.info('already extracted; skipping')
    if (track.status === 'failed' || track.status === 'disabled')
      return void log.info({ status: track.status }, 'skipping')

    const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
    if (!workspace || workspace.status === 'purged' || workspace.status === 'purging') {
      return void log.warn({ status: workspace?.status }, 'workspace unavailable; skipping')
    }

    const enabled = (await getFlag(db, 'link_extract')) && workspace.linkExtractEnabled
    if (!enabled) {
      await db
        .update(tracks)
        .set({
          status: 'ready',
          storageKey: null,
          coverStorageKey: null,
          sizeBytes: 0,
          errorMessage: null,
          readyAt: track.readyAt ?? new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(tracks.id, trackId), eq(tracks.workspaceId, workspaceId)))
      log.info(
        { global: await getFlag(db, 'link_extract'), workspace: workspace.linkExtractEnabled },
        'link extraction is off; track kept as a metadata-only entry',
      )
      return
    }

    const link = resolveLink(job.data, track)
    if (!link) {
      await failTrack(db, ctx.storage(), log, track, {
        userMessage: 'This link is not supported.',
        willRetry: false,
      })
      return
    }
    const siteLog = log.child({
      site: link.site,
      sourceId: link.id,
      provider: link.site === 'direct' ? 'direct' : env.extractorProvider,
    })
    if (link.site === 'youtube')
      siteLog.warn('fetching YouTube audio (link_extract is on; see the startup warning)')

    await setProcessing(db, track)
    const storage = ctx.storage()

    try {
      await withTempDir(`link-${link.site}`, async (tmpDir) => {
        const { provider, audio } = await fetchLinkAudio(link, tmpDir, {
          log: siteLog,
          signal: job.signal,
        })
        siteLog.info(
          { provider, durationMs: audio.durationMs ?? null, hasThumb: !!audio.thumbnailUrl },
          'audio fetched',
        )

        if (audio.durationMs && audio.durationMs > LINK_EXTRACT.maxDurationMs) {
          // The provider told us up front; do not spend CPU on the transcode.
          throw new PermanentError(
            `This item is longer than ${Math.round(LINK_EXTRACT.maxDurationMs / 60_000)} minutes.`,
            {
              detail: `provider reported ${audio.durationMs} ms`,
            },
          )
        }

        const cover = await fetchImageBuffer(audio.thumbnailUrl, {
          timeoutMs: THUMBNAIL_TIMEOUT_MS,
        })
        // Direct files: let the file's own tags win (null falls through to tags, then the row).
        const direct = link.site === 'direct'
        const title = direct ? null : audio.title?.trim() || track.title
        const artist = direct
          ? null
          : (audio.artist ?? audio.uploader ?? track.artist)?.trim() || null
        const outcome = await processLocalAudio({
          db,
          storage,
          log: siteLog,
          workspace,
          track,
          inputPath: audio.filePath,
          tmpDir,
          // Site downloads carry the site's own tags at best; prefer what the provider said.
          skipTags: !direct,
          meta: {
            title,
            artist,
            album: audio.album ?? null,
            coverBuffer: cover,
            coverUrl: audio.thumbnailUrl ?? track.coverUrl ?? null,
          },
        })
        if (outcome.kind === 'ready') {
          await db
            .update(tracks)
            .set({
              sourceSite: track.sourceSite ?? link.site,
              sourceId: track.sourceId ?? link.id,
              sourceUrl: track.sourceUrl ?? link.canonicalUrl,
              sourceAuthor:
                (audio.uploader ?? audio.artist ?? track.sourceAuthor ?? null)
                  ?.trim()
                  .slice(0, 200) || null,
              updatedAt: new Date(),
            })
            .where(and(eq(tracks.id, trackId), eq(tracks.workspaceId, workspaceId)))
        }
        siteLog.info(outcome, `${linkSiteLabel(link.site)} link extracted`)
      })
    } catch (err) {
      const retryable = isRetryable(err)
      const retrying = retryable && willRetry(job)
      siteLog[retryable ? 'warn' : 'info'](
        { err: describeError(err), retrying },
        'link extraction failed',
      )
      await failTrack(db, storage, siteLog, track, {
        userMessage: retrying
          ? `${linkSiteLabel(link.site)} could not be reached. Retrying shortly.`
          : userMessageOf(err),
        willRetry: retrying,
      })
      if (retryable) throw err
    }
  },
})
