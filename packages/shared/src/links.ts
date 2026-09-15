import { createHash } from 'node:crypto'
import { parseYouTubeId } from './discord'

/**
 * The link extractor accepts a fixed allow-list of sites. Each link resolves to a
 * (site, id) pair used for de-duplication, plus a canonical URL the worker fetches.
 * Playlists, albums and sets are rejected on purpose: one link = one track.
 */
export type LinkSite = 'youtube' | 'soundcloud' | 'bandcamp' | 'audius' | 'mixcloud' | 'vimeo' | 'archive' | 'direct'

export interface MediaLink {
  site: LinkSite
  id: string
  canonicalUrl: string
}

export const SUPPORTED_LINK_SITES: ReadonlyArray<{ site: LinkSite; label: string; example: string }> = [
  { site: 'youtube', label: 'YouTube', example: 'https://www.youtube.com/watch?v=RMPX_vgqQnM' },
  { site: 'soundcloud', label: 'SoundCloud', example: 'https://soundcloud.com/artist/track' },
  { site: 'bandcamp', label: 'Bandcamp', example: 'https://artist.bandcamp.com/track/song' },
  { site: 'audius', label: 'Audius', example: 'https://audius.co/artist/song' },
  { site: 'mixcloud', label: 'Mixcloud', example: 'https://www.mixcloud.com/user/mix/' },
  { site: 'vimeo', label: 'Vimeo', example: 'https://vimeo.com/123456789' },
  { site: 'archive', label: 'Internet Archive', example: 'https://archive.org/details/item' },
  { site: 'direct', label: 'Direct audio file', example: 'https://example.com/song.mp3' },
]

export const LINK_EXTRACT = {
  /** Longest track the extractor will fetch. */
  maxDurationMs: 30 * 60 * 1000,
  /** Largest download before transcoding. */
  maxDownloadBytes: 200 * 1024 * 1024,
  /** Per-job wall clock. */
  timeoutMs: 6 * 60 * 1000,
  audioExtensions: ['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'opus', 'oga', 'webm', 'aiff', 'aif'],
} as const

function host(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')
}

function segs(url: URL): string[] {
  return url.pathname.split('/').filter(Boolean)
}

export function parseMediaLink(input: string): MediaLink | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const h = host(url)
  const p = segs(url)

  const yt = parseYouTubeId(input)
  if (yt) return { site: 'youtube', id: yt, canonicalUrl: `https://www.youtube.com/watch?v=${yt}` }

  if (h === 'soundcloud.com' || h === 'on.soundcloud.com') {
    if (h === 'on.soundcloud.com') return null // short links must be expanded by the client first
    if (p.length < 2 || p[1] === 'sets' || p[0] === 'discover' || p[0] === 'search') return null
    const id = `${p[0]}/${p[1]}`.toLowerCase()
    return { site: 'soundcloud', id, canonicalUrl: `https://soundcloud.com/${p[0]}/${p[1]}` }
  }

  if (h.endsWith('.bandcamp.com')) {
    const sub = h.slice(0, -'.bandcamp.com'.length)
    if (p[0] !== 'track' || !p[1]) return null // albums are not single tracks
    return { site: 'bandcamp', id: `${sub}/${p[1]}`.toLowerCase(), canonicalUrl: `https://${sub}.bandcamp.com/track/${p[1]}` }
  }

  if (h === 'audius.co') {
    if (p.length < 2 || p[1] === 'playlist' || p[1] === 'album' || p[0] === 'search') return null
    return { site: 'audius', id: `${p[0]}/${p[1]}`.toLowerCase(), canonicalUrl: `https://audius.co/${p[0]}/${p[1]}` }
  }

  if (h === 'mixcloud.com') {
    if (p.length < 2 || p[1] === 'playlists') return null
    return { site: 'mixcloud', id: `${p[0]}/${p[1]}`.toLowerCase(), canonicalUrl: `https://www.mixcloud.com/${p[0]}/${p[1]}/` }
  }

  if (h === 'vimeo.com' || h === 'player.vimeo.com') {
    const id = p.find((s) => /^\d{5,}$/.test(s))
    if (!id) return null
    return { site: 'vimeo', id, canonicalUrl: `https://vimeo.com/${id}` }
  }

  if (h === 'archive.org') {
    if (p[0] !== 'details' || !p[1]) return null
    return { site: 'archive', id: p[1].toLowerCase(), canonicalUrl: `https://archive.org/details/${p[1]}` }
  }

  const ext = (p[p.length - 1] ?? '').split('.').pop()?.toLowerCase() ?? ''
  if ((LINK_EXTRACT.audioExtensions as readonly string[]).includes(ext)) {
    const clean = `${url.origin}${url.pathname}`
    return { site: 'direct', id: createHash('sha1').update(clean).digest('hex'), canonicalUrl: clean }
  }

  return null
}

export function linkSiteLabel(site: string | null | undefined): string {
  return SUPPORTED_LINK_SITES.find((s) => s.site === site)?.label ?? 'Link'
}
