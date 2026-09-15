import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { execa } from 'execa'
import { LINK_EXTRACT, linkSiteLabel, type MediaLink } from '@ume/shared'
import { env } from '../env'
import { PermanentError, RetryableError } from '../errors'
import type { ExtractorProvider, FetchOptions, FetchedAudio } from './types'

/** The subset of yt-dlp's --print-json output we read. */
interface YtInfo {
  id?: string
  title?: string
  track?: string | null
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

interface ExecaLikeError {
  code?: string
  timedOut?: boolean
  isCanceled?: boolean
  stderr?: unknown
  exitCode?: number
  message?: string
}

const MAX_MINUTES = Math.round(LINK_EXTRACT.maxDurationMs / 60_000)

/** stderr fingerprints that mean "this will never work" -> a user-safe reason, no retry. */
const PERMANENT_PATTERNS: Array<[RegExp, string]> = [
  [
    /private (video|track)|is private|this track is private/i,
    'This item is private and cannot be added.',
  ],
  [
    /age[- ]restricted|confirm your age|inappropriate for some users|age verification/i,
    'This item is age-restricted and cannot be added.',
  ],
  [
    /sign in to confirm|not a bot|login required|use --cookies|cookies-from-browser|requires? (a )?login/i,
    'The site asked for a sign-in, so this item cannot be fetched right now.',
  ],
  [
    /video unavailable|this video is not available|has been removed|does not exist|no longer available|404|not found|been deleted|track (is|was) removed/i,
    'This item is unavailable.',
  ],
  [
    /blocked it in your country|not available in your country|geo[- ]?restrict|geoblocked|copyright grounds/i,
    'This item is blocked in the region the worker runs from.',
  ],
  [
    /live event|is a live|premieres? in|live stream/i,
    'Live streams and premieres cannot be added.',
  ],
  [
    /does not pass filter|match-filter|skipping/i,
    `This item is longer than ${MAX_MINUTES} minutes.`,
  ],
  [/larger than max-filesize|max-filesize|file is larger/i, 'This item is too large to add.'],
  [
    /unsupported url|is not a valid url|incomplete youtube id|unable to extract|no video formats found|requested format is not available/i,
    'This link is not supported.',
  ],
  [/drm|protected content/i, 'This item is protected and cannot be added.'],
  [/playlist|album|is a set/i, 'Only single tracks can be added, not playlists or albums.'],
]

const TRANSIENT_PATTERNS =
  /network|timed? ?out|connection (reset|refused|aborted)|temporary failure|unable to download (webpage|api page|json metadata)|http error 5\d\d|429|too many requests|temporarily|read operation timed out|remote end closed|ssl|tls/i

function tailOf(text: string, n = 300): string {
  return text.trim().split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, n)
}

function classify(err: unknown, site: MediaLink['site']): Error {
  const e = err as ExecaLikeError
  if (e.code === 'ENOENT' || e.code === 'EACCES')
    return new RetryableError(`yt-dlp not found or not executable at ${env.ytdlpPath}`, {
      cause: err,
    })
  if (e.isCanceled) return new RetryableError('yt-dlp cancelled (shutdown)', { cause: err })
  if (e.timedOut)
    return new PermanentError('Fetching this item took too long.', {
      detail: `yt-dlp exceeded ${LINK_EXTRACT.timeoutMs} ms`,
      cause: err,
    })
  const text = `${typeof e.stderr === 'string' ? e.stderr : ''}\n${e.message ?? ''}`
  for (const [re, msg] of PERMANENT_PATTERNS)
    if (re.test(text)) return new PermanentError(msg, { detail: tailOf(text), cause: err })
  if (TRANSIENT_PATTERNS.test(text)) {
    return new RetryableError('yt-dlp network error', {
      userMessage: `${linkSiteLabel(site)} could not be reached. Retrying.`,
      cause: err,
    })
  }
  return new PermanentError(`This ${linkSiteLabel(site)} link could not be fetched.`, {
    detail: tailOf(text),
    cause: err,
  })
}

function buildArgs(link: MediaLink, tmpDir: string): string[] {
  const args = [
    '--no-playlist',
    '--no-warnings',
    '--no-progress',
    '--no-part',
    '--no-mtime',
    '-f',
    'bestaudio/best',
    '--max-filesize',
    String(LINK_EXTRACT.maxDownloadBytes),
    '--match-filter',
    `duration<=${Math.floor(LINK_EXTRACT.maxDurationMs / 1000)}`,
    '-o',
    path.join(tmpDir, '%(id)s.%(ext)s'),
    '--print-json',
  ]
  if (env.ytdlpCookies) args.push('--cookies', env.ytdlpCookies)
  args.push(...env.ytdlpExtraArgs)
  args.push('--', link.canonicalUrl)
  return args
}

async function locateOutput(info: YtInfo, tmpDir: string): Promise<string | null> {
  const files = await readdir(tmpDir).catch(() => [] as string[])
  const candidates = [
    info.requested_downloads?.[0]?.filepath,
    info.requested_downloads?.[0]?._filename,
    info._filename,
    info.filename,
  ].filter((p): p is string => typeof p === 'string' && p.length > 0)
  for (const c of candidates) {
    const abs = path.resolve(tmpDir, c)
    if (abs.startsWith(tmpDir + path.sep) && files.includes(path.basename(abs))) return abs
  }
  const byId = info.id
    ? files.find((f) => f.startsWith(`${info.id}.`) && !f.endsWith('.json'))
    : undefined
  if (byId) return path.join(tmpDir, byId)
  const any = files.find((f) => !f.endsWith('.json') && !f.startsWith('.'))
  return any ? path.join(tmpDir, any) : null
}

/**
 * Local yt-dlp binary (YTDLP_PATH). Every site in SUPPORTED_LINK_SITES has an extractor in
 * yt-dlp; args are always an array (never a shell string) and the URL comes last after `--`.
 */
export const ytdlpProvider: ExtractorProvider = {
  name: 'ytdlp',
  async fetchAudio(link: MediaLink, tmpDir: string, opts: FetchOptions): Promise<FetchedAudio> {
    const args = buildArgs(link, tmpDir)
    opts.log.debug({ provider: 'ytdlp', site: link.site, argc: args.length }, 'running yt-dlp')
    let stdout: string
    try {
      const res = await execa(env.ytdlpPath, args, {
        timeout: LINK_EXTRACT.timeoutMs,
        stdin: 'ignore',
        windowsHide: true,
        cwd: tmpDir,
        cancelSignal: opts.signal,
        env: { PYTHONUNBUFFERED: '1' },
        extendEnv: true,
      })
      stdout = String(res.stdout ?? '')
    } catch (err) {
      throw classify(err, link.site)
    }

    let info: YtInfo = {}
    const line = stdout
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l.startsWith('{') && l.endsWith('}'))
    if (line) {
      try {
        info = JSON.parse(line) as YtInfo
      } catch {
        opts.log.warn('yt-dlp printed invalid JSON; continuing without metadata')
      }
    }

    const filePath = await locateOutput(info, tmpDir)
    if (!filePath) {
      // A --match-filter rejection exits 0 with nothing written.
      throw new PermanentError(
        `This item is longer than ${MAX_MINUTES} minutes or could not be downloaded.`,
        { detail: 'yt-dlp produced no file' },
      )
    }
    const durationMs =
      typeof info.duration === 'number' && Number.isFinite(info.duration)
        ? Math.round(info.duration * 1000)
        : null
    return {
      filePath,
      title: info.track ?? info.title ?? null,
      artist: info.artist ?? info.creator ?? null,
      album: info.album ?? null,
      durationMs,
      thumbnailUrl: info.thumbnail ?? null,
      uploader: info.uploader ?? info.channel ?? null,
    }
  },
}
