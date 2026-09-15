import { readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'
import type { Logger } from 'pino'
import { and, eq } from '../lib/orm'
import { JOBS } from '@ume/shared'
import { getFlag, tracks, workspaces } from '@ume/db'
import { env } from '../lib/env'
import { PermanentError, RetryableError, describeError, isRetryable, userMessageOf } from '../lib/errors'
import { failTrack, loadTrack, processLocalAudio, setProcessing } from '../lib/media'
import { withTempDir } from '../lib/tmp'
import { defineJob, willRetry } from './types'

export const YTDLP_TIMEOUT_MS = 5 * 60 * 1000

export const YOUTUBE_TOS_WARNING =
  'link_extract flag is ON: the worker will download audio from YouTube with yt-dlp. This violates the YouTube Terms of Service ' +
  '(section "Permissions and Restrictions": you may not download content without permission), is the reason Groovy and Rythm were shut down, ' +
  'and yt-dlp is frequently blocked from datacenter IPs. Ume never markets this. Turn the flag off in the CEO console unless you accept that risk.'

interface YtInfo {
  id?: string
  title?: string
  artist?: string | null
  creator?: string | null
  uploader?: string | null
  channel?: string | null
  album?: string | null
  thumbnail?: string | null
  duration?: number | null
  ext?: string
  _filename?: string
  filename?: string
  requested_downloads?: Array<{ filepath?: string; _filename?: string }>
}

const PERMANENT_PATTERNS: Array<[RegExp, string]> = [
  [/video unavailable|this video is not available|has been removed|does not exist|no longer available/i, 'This video is unavailable.'],
  [/private video|is private/i, 'This video is private.'],
  [/age[- ]restricted|confirm your age|inappropriate for some users/i, 'This video is age-restricted and cannot be added.'],
  [/sign in to confirm|not a bot|login required|cookies/i, 'YouTube asked for a sign-in; this video cannot be fetched right now.'],
  [/copyright|blocked it in your country|not available in your country|geo/i, 'This video is blocked.'],
  [/live event|is a live|premieres? in/i, 'Live streams and premieres cannot be added.'],
  [/does not pass filter|skipping|duration/i, 'This video is longer than 30 minutes.'],
  [/file is larger than max-filesize|max-filesize/i, 'This video is too large to fetch.'],
  [/unsupported url|is not a valid url|incomplete youtube id/i, 'That is not a valid YouTube link.'],
]

function classifyYtdlp(err: unknown): Error {
  const e = err as { code?: string; timedOut?: boolean; stderr?: unknown; exitCode?: number; message?: string }
  if (e.code === 'ENOENT' || e.code === 'EACCES') return new RetryableError(`yt-dlp not found at ${env.ytdlpPath}`, { cause: err })
  if (e.timedOut) return new PermanentError('Fetching this video took too long.', { detail: 'yt-dlp timed out', cause: err })
  const text = `${typeof e.stderr === 'string' ? e.stderr : ''}\n${e.message ?? ''}`
  for (const [re, msg] of PERMANENT_PATTERNS) if (re.test(text)) return new PermanentError(msg, { detail: text.trim().split('\n').slice(-2).join(' | ').slice(0, 300), cause: err })
  if (/network|timed? ?out|connection|resolve|unable to download webpage|http error 5\d\d|429|too many requests|temporarily/i.test(text)) {
    return new RetryableError('yt-dlp network error', { userMessage: 'YouTube could not be reached. Retrying.', cause: err })
  }
  return new PermanentError('This video could not be fetched.', { detail: text.trim().split('\n').slice(-2).join(' | ').slice(0, 300), cause: err })
}

async function runYtdlp(sourceId: string, tmpDir: string, log: Logger): Promise<{ info: YtInfo; filePath: string }> {
  const url = `https://www.youtube.com/watch?v=${sourceId}`
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '-f',
    'bestaudio/best',
    '--max-filesize',
    '100m',
    '--match-filter',
    'duration<1800',
    '--no-part',
    '-o',
    path.join(tmpDir, '%(id)s.%(ext)s'),
    '--print-json',
  ]
  if (env.ytdlpCookies) args.push('--cookies', env.ytdlpCookies)
  args.push('--', url)
  let stdout: string
  try {
    const res = await execa(env.ytdlpPath, args, { timeout: YTDLP_TIMEOUT_MS, stdin: 'ignore', windowsHide: true })
    stdout = String(res.stdout ?? '')
  } catch (err) {
    throw classifyYtdlp(err)
  }
  let info: YtInfo = {}
  const line = stdout.trim().split('\n').find((l) => l.startsWith('{'))
  if (line) {
    try {
      info = JSON.parse(line) as YtInfo
    } catch {
      log.warn('yt-dlp printed invalid JSON; continuing without metadata')
    }
  }
  const candidates = [info.requested_downloads?.[0]?.filepath, info.requested_downloads?.[0]?._filename, info._filename, info.filename].filter(
    (p): p is string => typeof p === 'string' && p.length > 0,
  )
  for (const c of candidates) {
    const abs = path.isAbsolute(c) ? c : path.join(tmpDir, c)
    if (abs.startsWith(tmpDir)) {
      const exists = await readdir(tmpDir).then((files) => files.includes(path.basename(abs))).catch(() => false)
      if (exists) return { info, filePath: abs }
    }
  }
  const files = await readdir(tmpDir)
  const match = files.find((f) => f.startsWith(`${sourceId}.`) && !f.endsWith('.json'))
  if (!match) {
    // A --match-filter rejection exits 0 with nothing downloaded.
    throw new PermanentError('This video is longer than 30 minutes or could not be downloaded.', { detail: 'no file produced by yt-dlp' })
  }
  return { info, filePath: path.join(tmpDir, match) }
}

async function fetchThumbnail(url: string | null | undefined, dest: string): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//.test(url)) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > 5 * 1024 * 1024) return null
    await writeFile(dest, buf)
    return buf
  } catch {
    return null
  }
}

/**
 * extract-link {trackId, workspaceId, sourceId}
 * Off by default: with the flag off the track becomes a "linked" entry (metadata only).
 */
export const extractLink = defineJob({
  name: JOBS.extractLink,
  concurrency: 1,
  async run(ctx, job) {
    const { trackId, workspaceId, sourceId } = job.data
    const log = ctx.log.child({ job: job.name, jobId: job.id, trackId, workspaceId, sourceId })
    const db = ctx.db

    const track = await loadTrack(db, workspaceId, trackId)
    if (!track) return void log.warn('track not found; skipping')
    if (track.status === 'ready' && track.storageKey) return void log.info('already ingested; skipping')
    if (track.status === 'failed' || track.status === 'disabled') return void log.info({ status: track.status }, 'skipping')
    if (!/^[\w-]{11}$/.test(sourceId)) {
      await failTrack(db, ctx.storage(), log, track, { userMessage: 'That is not a valid YouTube link.', willRetry: false })
      return
    }
    const workspace = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
    if (!workspace || workspace.status === 'purged' || workspace.status === 'purging') {
      return void log.warn({ status: workspace?.status }, 'workspace unavailable; skipping')
    }

    const enabled = (await getFlag(db, 'link_extract')) && workspace.linkExtractEnabled
    if (!enabled) {
      await db
        .update(tracks)
        .set({ status: 'ready', storageKey: null, sizeBytes: 0, errorMessage: null, readyAt: track.readyAt ?? new Date(), updatedAt: new Date() })
        .where(and(eq(tracks.id, trackId), eq(tracks.workspaceId, workspaceId)))
      log.info('link_extract is off; track kept as a linked entry')
      return
    }

    log.warn('downloading YouTube audio (link_extract flag is on; see startup warning)')
    await setProcessing(db, track)
    const storage = ctx.storage()

    try {
      await withTempDir(`yt-${sourceId}`, async (tmpDir) => {
        const { info, filePath } = await runYtdlp(sourceId, tmpDir, log)
        const thumb = await fetchThumbnail(info.thumbnail, path.join(tmpDir, 'thumb.bin'))
        const outcome = await processLocalAudio({
          db,
          storage,
          log,
          workspace,
          track,
          inputPath: filePath,
          tmpDir,
          skipTags: true,
          meta: {
            title: info.title ?? track.title,
            artist: info.artist ?? info.creator ?? info.uploader ?? info.channel ?? track.artist ?? null,
            album: info.album ?? null,
            coverBuffer: thumb,
            coverUrl: info.thumbnail ?? track.coverUrl ?? null,
          },
        })
        if (outcome.kind === 'ready') {
          await db
            .update(tracks)
            .set({ sourceAuthor: info.channel ?? info.uploader ?? track.sourceAuthor ?? null, sourceUrl: track.sourceUrl ?? `https://www.youtube.com/watch?v=${sourceId}` })
            .where(and(eq(tracks.id, trackId), eq(tracks.workspaceId, workspaceId)))
        }
        log.info(outcome, 'youtube ingested')
      })
    } catch (err) {
      const retryable = isRetryable(err)
      const retrying = retryable && willRetry(job)
      log[retryable ? 'warn' : 'info']({ err: describeError(err), retrying }, 'youtube ingest failed')
      await failTrack(db, storage, log, track, {
        userMessage: retrying ? 'YouTube could not be reached. Retrying shortly.' : userMessageOf(err),
        willRetry: retrying,
      })
      if (retryable) throw err
    }
  },
})
