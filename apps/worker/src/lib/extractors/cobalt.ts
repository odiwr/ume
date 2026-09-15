import path from 'node:path'
import { LINK_EXTRACT, linkSiteLabel, type MediaLink } from '@ume/shared'
import { env } from '../env'
import { PermanentError, RetryableError } from '../errors'
import { downloadUrlToFile } from './download'
import { fetchOEmbedMeta, titleFromLink } from './oembed'
import type { ExtractorProvider, FetchOptions, FetchedAudio } from './types'

/**
 * Self-hosted Cobalt API (https://github.com/imputnet/cobalt, API v10+).
 * POST { url, downloadMode: 'audio', audioFormat: 'best' } -> { status: 'tunnel' | 'redirect', url, filename }
 * The API does its own site handling; we only download what it points us at.
 */
interface CobaltResponse {
  status?: 'tunnel' | 'redirect' | 'picker' | 'error' | string
  url?: string
  filename?: string
  error?: { code?: string; context?: Record<string, unknown> }
  picker?: unknown[]
}

const MAX_MINUTES = Math.round(LINK_EXTRACT.maxDurationMs / 60_000)

/** Cobalt error codes -> user-safe reasons. Anything not listed is treated as permanent. */
const PERMANENT_CODES: Array<[RegExp, string]> = [
  [/content\.(video|post)\.private|content\.private/, 'This item is private and cannot be added.'],
  [/content\.(video|post)\.age|age/, 'This item is age-restricted and cannot be added.'],
  [
    /content\.(video|post)\.unavailable|unavailable|not_found|content\.post\.(unavailable|deleted)/,
    'This item is unavailable.',
  ],
  [
    /content\.(video|post)\.region|region/,
    'This item is blocked in the region the extractor runs from.',
  ],
  [/content\.(video|post)\.live|live/, 'Live streams cannot be added.'],
  [/content\.too_long|too_long|duration/, `This item is longer than ${MAX_MINUTES} minutes.`],
  [
    /link\.(invalid|unsupported)|unsupported|invalid_body|link\.missing/,
    'This link is not supported.',
  ],
  [
    /youtube\.login|login|auth/,
    'The site asked for a sign-in, so this item cannot be fetched right now.',
  ],
  [/content\.(video|post)\.paid|paid/, 'This item is behind a paywall.'],
  [/drm/, 'This item is protected and cannot be added.'],
]

const RETRYABLE_CODES =
  /rate_exceeded|capacity|fetch\.(fail|critical|empty|rate|short_link)|service\.(unavailable|disabled)|youtube\.(temporary|api_error|codec)|generic|instance/

function classifyCode(code: string | undefined, site: MediaLink['site']): Error {
  const c = (code ?? '').toLowerCase()
  if (RETRYABLE_CODES.test(c)) {
    return new RetryableError(`cobalt ${c || 'error'}`, {
      userMessage: `${linkSiteLabel(site)} could not be reached. Retrying.`,
    })
  }
  for (const [re, msg] of PERMANENT_CODES)
    if (re.test(c)) return new PermanentError(msg, { detail: `cobalt ${c}` })
  return new PermanentError(`This ${linkSiteLabel(site)} link could not be fetched.`, {
    detail: `cobalt ${c || 'unknown error'}`,
  })
}

async function requestCobalt(link: MediaLink, opts: FetchOptions): Promise<CobaltResponse> {
  if (!env.cobaltApiUrl)
    throw new RetryableError('COBALT_API_URL is not set (EXTRACTOR_PROVIDER=cobalt)')
  const headers: Record<string, string> = {
    accept: 'application/json',
    'content-type': 'application/json',
  }
  if (env.cobaltApiKey) headers.authorization = `Api-Key ${env.cobaltApiKey}`
  let res: Response
  try {
    res = await fetch(env.cobaltApiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: link.canonicalUrl, downloadMode: 'audio', audioFormat: 'best' }),
      signal: opts.signal
        ? AbortSignal.any([AbortSignal.timeout(60_000), opts.signal])
        : AbortSignal.timeout(60_000),
    })
  } catch (err) {
    throw new RetryableError(
      `cobalt request failed: ${err instanceof Error ? err.message : String(err)}`,
      { cause: err },
    )
  }
  let body: CobaltResponse | null = null
  try {
    body = (await res.json()) as CobaltResponse
  } catch {
    body = null
  }
  if (res.status === 401 || res.status === 403)
    throw new RetryableError(`cobalt rejected the API key (HTTP ${res.status})`)
  if (res.status === 429 || res.status >= 500)
    throw new RetryableError(`cobalt HTTP ${res.status}`, {
      userMessage: 'The extractor is busy. Retrying.',
    })
  if (!body) throw new RetryableError(`cobalt returned a non-JSON body (HTTP ${res.status})`)
  return body
}

export const cobaltProvider: ExtractorProvider = {
  name: 'cobalt',
  async fetchAudio(link: MediaLink, tmpDir: string, opts: FetchOptions): Promise<FetchedAudio> {
    const body = await requestCobalt(link, opts)
    opts.log.debug({ provider: 'cobalt', site: link.site, status: body.status }, 'cobalt responded')

    if (body.status === 'error') throw classifyCode(body.error?.code, link.site)
    if (body.status === 'picker')
      throw new PermanentError('Only single tracks can be added, not playlists or albums.', {
        detail: 'cobalt picker response',
      })
    if ((body.status !== 'tunnel' && body.status !== 'redirect') || !body.url) {
      throw new PermanentError(`This ${linkSiteLabel(link.site)} link could not be fetched.`, {
        detail: `cobalt status ${body.status ?? 'missing'}`,
      })
    }

    const ext =
      (path.extname(body.filename ?? '').replace('.', '') || 'bin')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') || 'bin'
    const filePath = path.join(tmpDir, `${link.id.replace(/[^\w.-]+/g, '_')}.${ext}`)
    await downloadUrlToFile(body.url, filePath, { signal: opts.signal })

    // Cobalt returns bytes and a filename, nothing more: ask the site's oEmbed endpoint for the rest.
    const oe = await fetchOEmbedMeta(link, opts.log)
    const fromFilename = body.filename
      ? body.filename
          .replace(/\.[a-z0-9]{2,5}$/i, '')
          .replace(/[-_+]+/g, ' ')
          .trim()
      : ''
    return {
      filePath,
      title: oe?.title ?? (fromFilename || titleFromLink(link)),
      artist: null,
      album: null,
      durationMs: null,
      thumbnailUrl: oe?.thumbnailUrl ?? null,
      uploader: oe?.author ?? null,
    }
  },
}
