import type { MediaLink } from '@ume/shared'
import { logger } from './logger'

/**
 * Best-effort metadata for a link before the worker extracts it. Sites with a public
 * oEmbed endpoint give us a title, author and cover in one request; everything else
 * falls back to the URL's last path segment so the entry is never nameless.
 */
export interface LinkMeta {
  title: string
  author: string | null
  coverUrl: string | null
  /** True when the title came from the site rather than the URL. */
  fromSite: boolean
}

const OEMBED_TIMEOUT_MS = 5_000

interface OEmbedResponse {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

function oembedEndpoint(link: MediaLink): URL | null {
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

async function fetchOEmbed(link: MediaLink): Promise<OEmbedResponse | null> {
  const endpoint = oembedEndpoint(link)
  if (!endpoint) return null
  try {
    const res = await fetch(endpoint, {
      signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS),
      headers: { accept: 'application/json', 'user-agent': 'Ume/1.0 (+discord music bot)' },
    })
    if (!res.ok) return null
    const body = (await res.json()) as OEmbedResponse
    return body && typeof body === 'object' ? body : null
  } catch (err) {
    logger.debug({ err, site: link.site }, 'oEmbed lookup failed; falling back to the URL')
    return null
  }
}

/** "artist-song-name.mp3" -> "artist song name"; never empty. */
export function titleFromUrl(link: MediaLink): string {
  let segment = ''
  try {
    const u = new URL(link.canonicalUrl)
    const parts = u.pathname.split('/').filter(Boolean)
    segment = parts[parts.length - 1] ?? ''
    // SoundCloud/Audius/Bandcamp ids are "artist/track": the track half is the better title.
    if (link.site === 'soundcloud' || link.site === 'audius' || link.site === 'bandcamp' || link.site === 'mixcloud') {
      segment = parts[parts.length - 1] ?? segment
    }
  } catch {
    segment = link.id
  }
  try {
    segment = decodeURIComponent(segment)
  } catch {
    /* keep raw */
  }
  if (link.site === 'direct') segment = segment.replace(/\.[a-z0-9]{2,5}$/i, '')
  const cleaned = segment.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (cleaned || link.id).slice(0, 200)
}

export async function lookupLinkMeta(link: MediaLink): Promise<LinkMeta> {
  const oe = await fetchOEmbed(link)
  const title = oe?.title?.trim()
  if (title) {
    return {
      title: title.slice(0, 200),
      author: oe?.author_name?.trim().slice(0, 200) || null,
      coverUrl: oe?.thumbnail_url?.startsWith('http') ? oe.thumbnail_url : null,
      fromSite: true,
    }
  }
  return { title: titleFromUrl(link), author: null, coverUrl: null, fromSite: false }
}
