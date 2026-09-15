/** Worker environment. Everything is optional except the database URL (read by @ume/shared). */

export type ExtractorProvider = 'ytdlp' | 'cobalt'

function parseProvider(raw: string | undefined): ExtractorProvider {
  const v = (raw ?? '').trim().toLowerCase()
  if (v === 'cobalt') return 'cobalt'
  return 'ytdlp'
}

/** `WORKER_QUEUES=extract-link,send-email` -> ['extract-link', 'send-email']; empty = all queues. */
export function parseQueueList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/** `YTDLP_EXTRA_ARGS="--extractor-args youtube:player_client=web"` -> argv tokens (whitespace split, simple quotes honoured). */
export function parseExtraArgs(raw: string | undefined): string[] {
  const out: string[] = []
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g
  for (const m of (raw ?? '').matchAll(re)) out.push(m[1] ?? m[2] ?? m[3] ?? '')
  return out.filter((s) => s.length > 0)
}

export const env = {
  appUrl: (
    process.env.APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  ).replace(/\/$/, ''),
  discordBotToken: process.env.DISCORD_BOT_TOKEN ?? '',
  ffmpegPath: process.env.FFMPEG_PATH || 'ffmpeg',
  ffprobePath:
    process.env.FFPROBE_PATH ||
    (process.env.FFMPEG_PATH && /ffmpeg(\.exe)?$/i.test(process.env.FFMPEG_PATH)
      ? process.env.FFMPEG_PATH.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1')
      : 'ffprobe'),
  /** Which queues this instance consumes. Empty = every queue. */
  workerQueues: parseQueueList(process.env.WORKER_QUEUES),
  /** Link extractor backend: a local yt-dlp binary or a self-hosted Cobalt API. */
  extractorProvider: parseProvider(process.env.EXTRACTOR_PROVIDER),
  ytdlpPath: process.env.YTDLP_PATH || 'yt-dlp',
  ytdlpCookies: process.env.YTDLP_COOKIES || '',
  ytdlpExtraArgs: parseExtraArgs(process.env.YTDLP_EXTRA_ARGS),
  cobaltApiUrl: (process.env.COBALT_API_URL ?? '').trim().replace(/\/$/, ''),
  cobaltApiKey: (process.env.COBALT_API_KEY ?? '').trim(),
}

export function dashboardUrl(umeId: string): string {
  return `${env.appUrl}/app/${umeId}`
}

export function settingsUrl(umeId: string): string {
  return `${env.appUrl}/app/${umeId}/settings`
}
