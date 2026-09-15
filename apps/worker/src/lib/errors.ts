/**
 * Job errors carry two things pg-boss does not know about: a short, user-safe message
 * that is written to `tracks.error_message`, and whether retrying could help.
 *
 *  - PermanentError: validation / content problems (bad file, too long, blocked). Never retried.
 *  - RetryableError: infra problems (storage, network, a binary missing). Retried per JOB_OPTIONS.
 */
export class JobError extends Error {
  readonly userMessage: string
  readonly retryable: boolean
  constructor(message: string, opts: { userMessage?: string; retryable: boolean; cause?: unknown }) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined)
    this.name = new.target.name
    this.userMessage = opts.userMessage ?? message
    this.retryable = opts.retryable
  }
}

export class PermanentError extends JobError {
  constructor(userMessage: string, opts: { detail?: string; cause?: unknown } = {}) {
    super(opts.detail ? `${userMessage} (${opts.detail})` : userMessage, {
      userMessage,
      retryable: false,
      cause: opts.cause,
    })
  }
}

export class RetryableError extends JobError {
  constructor(message: string, opts: { userMessage?: string; cause?: unknown } = {}) {
    super(message, { userMessage: opts.userMessage ?? 'Temporary problem while processing. Retrying.', retryable: true, cause: opts.cause })
  }
}

const TRANSIENT_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH',
  'ENOENT', // a binary (ffmpeg / yt-dlp) missing is a deployment problem, not the user's
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_SOCKET',
])

/** Unknown errors (DB, S3, network) are treated as retryable; only our own PermanentErrors are final. */
export function isRetryable(err: unknown): boolean {
  if (err instanceof JobError) return err.retryable
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; name?: unknown; $retryable?: unknown; $metadata?: { httpStatusCode?: number } }
    if (typeof e.code === 'string' && TRANSIENT_CODES.has(e.code)) return true
    if (e.$retryable) return true
    const status = e.$metadata?.httpStatusCode
    if (typeof status === 'number') return status >= 500 || status === 429 || status === 408
  }
  return true
}

/** Short, user-safe text for `tracks.error_message`. */
export function userMessageOf(err: unknown): string {
  if (err instanceof JobError) return err.userMessage
  return 'Processing failed. Please try uploading again.'
}

/** Compact description for logs. */
export function describeError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as { cause?: unknown }).cause
    const c = cause instanceof Error ? ` <- ${cause.name}: ${cause.message}` : ''
    return `${err.name}: ${err.message}${c}`
  }
  return String(err)
}
