import type { MediaLink } from '@ume/shared'
import type { Logger } from 'pino'

/**
 * Metadata fallback for providers that only return bytes (Cobalt, direct files). Mirrors the
 * endpoints the bot and web use before the worker runs, so a track never ends up nameless.
 */
export interface OEmbedMeta {
  title: string | null
  author: string | null
  thumbnailUrl: string | null
}

const TIMEOUT_MS = 5_000

interface OEmbedResponse {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

export function oembedEndpoint(link: MediaLink): URL | null {
  switch (link.site) {
    case 'youtube': {
      const u = new URL('https://www.youtube.com/oembed')
      u.searchParams.set('url', link.canonicalUrl)
      u.searchParams.set('format', 'json')
      return u
    }
    case 'soundcloud': {
      const u = new URL('https://soundcloud.com/oembed')
      u.searchParams.set('url', link.canonicalUrl)
      u.searchParams.set('format', 'json')
      return u
    }
    case 'vimeo': {
      const u = new URL('https://vimeo.com/api/oembed.json')
      u.searchParams.set('url', link.canonicalUrl)
      return u
    }
    case 'mixcloud': {
      const u = new URL('https://www.mixcloud.com/oembed/')
      u.searchParams.set('url', link.canonicalUrl)
      u.searchParams.set('format', 'json')
      return u
    }
    default:
      return null
  }
}

export async function fetchOEmbedMeta(link: MediaLink, log: Logger): Promise<OEmbedMeta | null> {
  const endpoint = oembedEndpoint(link)
  if (!endpoint) return null
  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        accept: 'application/json',
        'user-agent': 'Ume/1.0 (+https://ume.app; link extractor)',
      },
    })
    if (!res.ok) return null
    const body = (await res.json()) as OEmbedResponse
    if (!body || typeof body !== 'object') return null
    return {
      title: body.title?.trim().slice(0, 200) || null,
      author: body.author_name?.trim().slice(0, 200) || null,
      thumbnailUrl:
        body.thumbnail_url && /^https?:\/\//.test(body.thumbnail_url) ? body.thumbnail_url : null,
    }
  } catch (err) {
    log.debug(
      { site: link.site, err: err instanceof Error ? err.message : String(err) },
      'oEmbed lookup failed',
    )
    return null
  }
}

/** "artist-song-name.mp3" -> "artist song name"; never empty. */
export function titleFromLink(link: MediaLink): string {
  let segment = ''
  try {
    const parts = new URL(link.canonicalUrl).pathname.split('/').filter(Boolean)
    segment = parts[parts.length - 1] ?? ''
  } catch {
    segment = link.id
  }
  try {
    segment = decodeURIComponent(segment)
  } catch {
    /* keep raw */
  }
  if (link.site === 'direct') segment = segment.replace(/\.[a-z0-9]{2,5}$/i, '')
  const cleaned = segment
    .replace(/[-_+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return (cleaned || link.id).slice(0, 200)
}
