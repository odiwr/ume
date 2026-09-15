import { createWriteStream } from 'node:fs'
import { stat, unlink } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { LINK_EXTRACT } from '@ume/shared'
import { PermanentError, RetryableError } from '../errors'

const USER_AGENT = 'Ume/1.0 (+https://ume.app; link extractor)'

export interface DownloadOptions {
  maxBytes?: number
  timeoutMs?: number
  signal?: AbortSignal
  headers?: Record<string, string>
}

export interface DownloadResult {
  bytes: number
  contentType: string | null
  /** From Content-Disposition when the server sent one. */
  filename: string | null
}

function combineSignals(timeoutMs: number, extra?: AbortSignal): AbortSignal {
  const signals = [AbortSignal.timeout(timeoutMs)]
  if (extra) signals.push(extra)
  return AbortSignal.any(signals)
}

function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim())
    } catch {
      /* fall through */
    }
  }
  const plain = /filename\s*=\s*"?([^";]+)"?/.exec(header)
  return plain?.[1]?.trim() || null
}

/**
 * Stream an HTTP(S) URL to disk with a byte cap and a wall-clock timeout. Anything over the
 * cap is a PermanentError (the file will never fit), network trouble is Retryable.
 */
export async function downloadUrlToFile(
  url: string,
  dest: string,
  opts: DownloadOptions = {},
): Promise<DownloadResult> {
  const maxBytes = opts.maxBytes ?? LINK_EXTRACT.maxDownloadBytes
  const timeoutMs = opts.timeoutMs ?? LINK_EXTRACT.timeoutMs
  if (!/^https?:\/\//i.test(url))
    throw new PermanentError('That link is not supported.', {
      detail: `non-http url ${url.slice(0, 80)}`,
    })

  let res: Response
  try {
    res = await fetch(url, {
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept: '*/*', ...(opts.headers ?? {}) },
      signal: combineSignals(timeoutMs, opts.signal),
    })
  } catch (err) {
    if (opts.signal?.aborted) throw new RetryableError('download cancelled', { cause: err })
    throw new RetryableError(
      `download failed to start: ${err instanceof Error ? err.message : String(err)}`,
      {
        userMessage: 'The link could not be reached. Retrying.',
        cause: err,
      },
    )
  }

  if (res.status === 404 || res.status === 410)
    throw new PermanentError('That link no longer exists.', { detail: `HTTP ${res.status}` })
  if (res.status === 401 || res.status === 403)
    throw new PermanentError('That link is not publicly accessible.', {
      detail: `HTTP ${res.status}`,
    })
  if (res.status === 429 || res.status >= 500) {
    throw new RetryableError(`download HTTP ${res.status}`, {
      userMessage: 'The site is busy. Retrying.',
    })
  }
  if (!res.ok || !res.body)
    throw new PermanentError('That link could not be downloaded.', { detail: `HTTP ${res.status}` })

  const declared = Number(res.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new PermanentError('That file is too large to add.', {
      detail: `content-length ${declared} > ${maxBytes}`,
    })
  }

  let received = 0
  const capped = async function* (source: AsyncIterable<Uint8Array>) {
    for await (const chunk of source) {
      received += chunk.byteLength
      if (received > maxBytes)
        throw new PermanentError('That file is too large to add.', {
          detail: `exceeded ${maxBytes} bytes while streaming`,
        })
      yield chunk
    }
  }
  try {
    await pipeline(Readable.fromWeb(res.body as never), capped, createWriteStream(dest))
  } catch (err) {
    await unlink(dest).catch(() => undefined)
    if (err instanceof PermanentError) throw err
    if (opts.signal?.aborted) throw new RetryableError('download cancelled', { cause: err })
    const timedOut =
      err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
    if (timedOut)
      throw new PermanentError('Downloading that link took too long.', {
        detail: `timeout after ${timeoutMs} ms`,
        cause: err,
      })
    throw new RetryableError(
      `download stream failed: ${err instanceof Error ? err.message : String(err)}`,
      {
        userMessage: 'The download was interrupted. Retrying.',
        cause: err,
      },
    )
  }
  const s = await stat(dest)
  if (s.size === 0) throw new PermanentError('That link returned an empty file.')
  return {
    bytes: s.size,
    contentType: res.headers.get('content-type'),
    filename: filenameFromDisposition(res.headers.get('content-disposition')),
  }
}

/** Small bounded fetch for thumbnails: never throws, null on any problem. */
export async function fetchImageBuffer(
  url: string | null | undefined,
  opts: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<Buffer | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null
  const maxBytes = opts.maxBytes ?? 5 * 1024 * 1024
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
      headers: { 'user-agent': USER_AGENT },
    })
    if (!res.ok) return null
    const declared = Number(res.headers.get('content-length') ?? '')
    if (Number.isFinite(declared) && declared > maxBytes) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > maxBytes) return null
    return buf
  } catch {
    return null
  }
}
