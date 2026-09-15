import type { MediaLink } from '@ume/shared'
import type { Logger } from 'pino'

/** What a provider hands back: a local audio file plus whatever metadata it learned on the way. */
export interface FetchedAudio {
  /** Absolute path inside `tmpDir`. */
  filePath: string
  title?: string | null
  artist?: string | null
  album?: string | null
  durationMs?: number | null
  thumbnailUrl?: string | null
  /** Channel / account that published the item (kept as `tracks.source_author`). */
  uploader?: string | null
}

export interface FetchOptions {
  log: Logger
  /** Aborted when the worker is shutting down or the job is cancelled. */
  signal?: AbortSignal
}

/**
 * A link extractor backend. Implementations must:
 *  - write the audio into `tmpDir` (the job removes the directory afterwards),
 *  - respect LINK_EXTRACT.timeoutMs and LINK_EXTRACT.maxDownloadBytes,
 *  - throw PermanentError for content problems (private, removed, too long, unsupported)
 *    and RetryableError for network / provider outages.
 */
export interface ExtractorProvider {
  readonly name: 'ytdlp' | 'cobalt'
  fetchAudio(link: MediaLink, tmpDir: string, opts: FetchOptions): Promise<FetchedAudio>
}
