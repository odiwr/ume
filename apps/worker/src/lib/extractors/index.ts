import path from 'node:path'
import { LINK_EXTRACT, type MediaLink } from '@ume/shared'
import { env, type ExtractorProvider as ProviderName } from '../env'
import { cobaltProvider } from './cobalt'
import { downloadUrlToFile } from './download'
import { titleFromLink } from './oembed'
import type { ExtractorProvider, FetchOptions, FetchedAudio } from './types'
import { ytdlpProvider } from './ytdlp'

export type { ExtractorProvider, FetchOptions, FetchedAudio } from './types'
export { fetchImageBuffer } from './download'
export { titleFromLink } from './oembed'

const providers: Record<ProviderName, ExtractorProvider> = {
  ytdlp: ytdlpProvider,
  cobalt: cobaltProvider,
}

/** The backend chosen by EXTRACTOR_PROVIDER (default ytdlp). */
export function getExtractor(name: ProviderName = env.extractorProvider): ExtractorProvider {
  return providers[name] ?? ytdlpProvider
}

/** A direct audio URL needs no extractor: stream it to disk under the same caps. */
async function fetchDirect(
  link: MediaLink,
  tmpDir: string,
  opts: FetchOptions,
): Promise<FetchedAudio> {
  const ext = (
    path.extname(new URL(link.canonicalUrl).pathname).replace('.', '') || 'bin'
  ).toLowerCase()
  const safeExt = (LINK_EXTRACT.audioExtensions as readonly string[]).includes(ext) ? ext : 'bin'
  const filePath = path.join(tmpDir, `${link.id}.${safeExt}`)
  const res = await downloadUrlToFile(link.canonicalUrl, filePath, { signal: opts.signal })
  const fromHeader = res.filename
    ? res.filename
        .replace(/\.[a-z0-9]{2,5}$/i, '')
        .replace(/[-_+]+/g, ' ')
        .trim()
    : ''
  return {
    filePath,
    title: fromHeader || titleFromLink(link),
    artist: null,
    album: null,
    durationMs: null,
    thumbnailUrl: null,
    uploader: null,
  }
}

/**
 * Fetch the audio behind a parsed link into `tmpDir`. Direct files skip the provider;
 * every other site goes through the configured backend.
 */
export async function fetchLinkAudio(
  link: MediaLink,
  tmpDir: string,
  opts: FetchOptions,
): Promise<{ provider: string; audio: FetchedAudio }> {
  if (link.site === 'direct')
    return { provider: 'direct', audio: await fetchDirect(link, tmpDir, opts) }
  const provider = getExtractor()
  return { provider: provider.name, audio: await provider.fetchAudio(link, tmpDir, opts) }
}
