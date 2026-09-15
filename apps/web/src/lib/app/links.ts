import 'server-only'
import { getFlag, type Workspace } from '@ume/db'
import type { MediaLink } from '@ume/shared'
import { db } from '@/lib/db'

/**
 * Metadata for a link entry, fetched from the site's public oEmbed endpoint where one
 * exists. Best effort: a 5 s timeout and a fallback to the URL's last path segment so
 * adding a song never fails because a third party was slow.
 */
export interface LinkMetadata {
  title: string
  author: string | null
  coverUrl: string | null
}

interface OEmbedResponse {
  title?: string
  author_name?: string
  thumbnail_url?: string
}

const OEMBED_TIMEOUT_MS = 5_000

function oembedEndpoint(link: MediaLink): string | null {
  const u = encodeURIComponent(link.canonicalUrl)
  switch (link.site) {
    case 'youtube':
      return `https://www.youtube.com/oembed?url=${u}&format=json`
    case 'soundcloud':
      return `https://soundcloud.com/oembed?url=${u}&format=json`
    case 'vimeo':
      return `https://vimeo.com/api/oembed.json?url=${u}`
    case 'mixcloud':
      return `https://www.mixcloud.com/oembed/?url=${u}&format=json`
    default:
      return null
  }
}

async function fetchOEmbed(endpoint: string): Promise<OEmbedResponse | null> {
  try {
    const res = await fetch(endpoint, {
      cache: 'no-store',
      signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = (await res.json()) as OEmbedResponse
    return typeof data === 'object' && data ? data : null
  } catch {
    return null
  }
}

/** Human-readable fallback title: the last path segment of the canonical URL. */
export function fallbackTitle(link: MediaLink): string {
  if (link.site === 'youtube') return `YouTube video ${link.id}`
  try {
    const url = new URL(link.canonicalUrl)
    const segs = url.pathname.split('/').filter(Boolean)
    const last = segs[segs.length - 1] ?? url.hostname
    const decoded = decodeURIComponent(last).replace(/\.[a-z0-9]{2,5}$/i, '')
    return decoded.replace(/[-_]+/g, ' ').trim() || url.hostname
  } catch {
    return link.id
  }
}

export async function fetchLinkMetadata(link: MediaLink): Promise<LinkMetadata> {
  const endpoint = oembedEndpoint(link)
  const meta = endpoint ? await fetchOEmbed(endpoint) : null
  const title = meta?.title?.trim() || fallbackTitle(link)
  const author = meta?.author_name?.trim() || null
  let coverUrl = meta?.thumbnail_url?.trim() || null
  if (!coverUrl && link.site === 'youtube') coverUrl = `https://i.ytimg.com/vi/${link.id}/hqdefault.jpg`
  return { title, author, coverUrl }
}

/**
 * Whether a link added to this workspace gets extracted to audio, or stays a
 * metadata-only entry. All three gates must be open: the global flag, the workspace
 * switch, and the Owner's rights attestation.
 */
export type ExtractionState = 'allowed' | 'flag_off' | 'workspace_off' | 'attestation_missing'

export async function extractionState(
  workspace: Pick<Workspace, 'linkExtractEnabled' | 'linkExtractAcceptedAt'>,
): Promise<ExtractionState> {
  if (!(await getFlag(db, 'link_extract'))) return 'flag_off'
  if (!workspace.linkExtractEnabled) return 'workspace_off'
  if (!workspace.linkExtractAcceptedAt) return 'attestation_missing'
  return 'allowed'
}

export const EXTRACTION_NOTICES: Record<Exclude<ExtractionState, 'allowed'>, string> = {
  flag_off: 'Saved as a link only: adding audio from links is switched off on Ume right now.',
  workspace_off: 'Saved as a link only: "Add from link" is switched off for this server in Settings.',
  attestation_missing:
    'Saved as a link only. The Owner needs to accept the rights attestation in Settings before Ume stores audio from links.',
}
