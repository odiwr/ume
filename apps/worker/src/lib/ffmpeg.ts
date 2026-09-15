import { stat } from 'node:fs/promises'
import { execa, type Options as ExecaOptions } from 'execa'
import { UPLOAD } from '@ume/shared'
import { env } from './env'
import { PermanentError, RetryableError } from './errors'

/** Hard ceiling for any single ffmpeg/ffprobe process. */
export const FFMPEG_TIMEOUT_MS = 10 * 60 * 1000

export interface ProbeResult {
  durationMs: number
  hasAudio: boolean
  /** True only for a *real* video stream (attached cover art does not count). */
  hasVideo: boolean
  codec: string | null
  /** Container name(s) as reported by ffprobe, e.g. "mov,mp4,m4a,3gp,3g2,mj2". */
  formatName: string | null
}

interface ExecaLikeError {
  timedOut?: boolean
  exitCode?: number
  stderr?: unknown
  code?: string
  shortMessage?: string
  message?: string
}

const baseOpts: ExecaOptions = {
  timeout: FFMPEG_TIMEOUT_MS,
  windowsHide: true,
  stdin: 'ignore',
  env: { AV_LOG_FORCE_NOCOLOR: '1' },
  extendEnv: true,
}

function tail(s: unknown, n = 400): string {
  const str = typeof s === 'string' ? s : ''
  return str.trim().split('\n').slice(-6).join(' | ').slice(-n)
}

/** Wraps an execa failure into a job error. Missing binaries are infra problems; everything else is the file's fault. */
function toJobError(err: unknown, what: string, userMessage: string): Error {
  const e = err as ExecaLikeError
  if (e.code === 'ENOENT' || e.code === 'EACCES') {
    return new RetryableError(`${what}: binary not found or not executable (${e.code})`, { cause: err })
  }
  if (e.timedOut) {
    return new PermanentError(`${userMessage} It took too long to process.`, { detail: `${what} timed out`, cause: err })
  }
  return new PermanentError(userMessage, { detail: `${what} exit ${e.exitCode ?? '?'}: ${tail(e.stderr) || e.shortMessage || e.message}`, cause: err })
}

interface FfprobeJson {
  format?: { duration?: string; format_name?: string }
  streams?: Array<{
    codec_type?: string
    codec_name?: string
    duration?: string
    disposition?: { attached_pic?: number }
  }>
}

const PICTURE_CODECS = new Set(['mjpeg', 'png', 'bmp', 'gif', 'webp', 'tiff'])

async function probeWithFfprobe(inputPath: string): Promise<ProbeResult> {
  const { stdout } = await execa(
    env.ffprobePath,
    ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', '-i', inputPath],
    baseOpts,
  )
  const json = JSON.parse(String(stdout)) as FfprobeJson
  const streams = json.streams ?? []
  const audio = streams.find((s) => s.codec_type === 'audio')
  const video = streams.filter((s) => s.codec_type === 'video')
  const realVideo = video.some((s) => !(s.disposition?.attached_pic === 1) && !PICTURE_CODECS.has(s.codec_name ?? ''))
  const durationSec = Number(json.format?.duration ?? audio?.duration ?? 0)
  return {
    durationMs: Number.isFinite(durationSec) && durationSec > 0 ? Math.round(durationSec * 1000) : 0,
    hasAudio: !!audio,
    hasVideo: realVideo,
    codec: audio?.codec_name ?? null,
    formatName: json.format?.format_name ?? null,
  }
}

/** Fallback when ffprobe is not installed: parse `ffmpeg -i` stderr. */
async function probeWithFfmpeg(inputPath: string): Promise<ProbeResult> {
  const res = await execa(env.ffmpegPath, ['-hide_banner', '-i', inputPath, '-f', 'null', '-'], {
    ...baseOpts,
    reject: false,
  })
  const text = String(res.stderr ?? '')
  const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text)
  const durationMs = m ? Math.round((Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) * 1000) : 0
  const audioLine = /Stream #\d+:\d+.*?:\s*Audio:\s*([\w-]+)/.exec(text)
  const videoLines = [...text.matchAll(/Stream #\d+:\d+.*?:\s*Video:\s*([\w-]+)[^\n]*/g)]
  const realVideo = videoLines.some((v) => !PICTURE_CODECS.has(v[1] ?? '') && !/attached pic/i.test(v[0]))
  const input = /Input #0,\s*([^,]+(?:,[^,]+)*?),\s*from/.exec(text)
  if (!audioLine && !m && res.exitCode !== 0 && (res as unknown as ExecaLikeError).code) {
    throw Object.assign(new Error('ffmpeg failed'), { code: (res as unknown as ExecaLikeError).code })
  }
  return {
    durationMs,
    hasAudio: !!audioLine,
    hasVideo: realVideo,
    codec: audioLine?.[1] ?? null,
    formatName: input?.[1]?.trim() ?? null,
  }
}

/** Duration, stream layout and codec of a media file. Never shells out with a string. */
export async function probe(inputPath: string): Promise<ProbeResult> {
  try {
    return await probeWithFfprobe(inputPath)
  } catch (err) {
    const e = err as ExecaLikeError
    if (e.code === 'ENOENT') {
      try {
        return await probeWithFfmpeg(inputPath)
      } catch (err2) {
        throw toJobError(err2, 'ffmpeg -i', 'We could not read this file as audio.')
      }
    }
    if (err instanceof SyntaxError) {
      throw new PermanentError('We could not read this file as audio.', { detail: 'ffprobe returned invalid JSON', cause: err })
    }
    throw toJobError(err, 'ffprobe', 'We could not read this file as audio.')
  }
}

/**
 * Transcode anything ffmpeg can decode to the canonical Ume rendition:
 * stereo 48 kHz Opus in Ogg at UPLOAD.output.bitrateKbps with EBU R128 loudness normalization.
 * Returns the output size in bytes.
 */
export async function transcodeToOpus(inputPath: string, outputPath: string): Promise<number> {
  const o = UPLOAD.output
  const args = [
    '-y',
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-vn',
    '-sn',
    '-dn',
    '-map_metadata',
    '-1',
    '-ac',
    String(o.channels),
    '-ar',
    String(o.sampleRate),
    '-c:a',
    o.codec,
    '-b:a',
    `${o.bitrateKbps}k`,
    '-vbr',
    'on',
    '-application',
    'audio',
    '-frame_duration',
    '20',
    '-af',
    `loudnorm=${o.loudnorm}`,
    '-f',
    o.container,
    outputPath,
  ]
  try {
    await execa(env.ffmpegPath, args, baseOpts)
  } catch (err) {
    throw toJobError(err, 'ffmpeg transcode', 'We could not convert this file. It may be corrupt or not really audio.')
  }
  const s = await stat(outputPath).catch(() => null)
  if (!s || s.size === 0) throw new PermanentError('We could not convert this file.', { detail: 'empty output' })
  return s.size
}

/**
 * Best-effort cover extraction (embedded picture stream -> 600px-wide JPEG).
 * Returns the JPEG size, or null when there is no picture / ffmpeg fails.
 */
export async function extractCover(inputPath: string, outputJpg: string): Promise<number | null> {
  const args = [
    '-y',
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    '-i',
    inputPath,
    '-an',
    '-vcodec',
    'mjpeg',
    '-frames:v',
    '1',
    '-vf',
    'scale=600:-1',
    '-q:v',
    '4',
    outputJpg,
  ]
  try {
    await execa(env.ffmpegPath, args, { ...baseOpts, timeout: 60_000 })
  } catch {
    return null
  }
  const s = await stat(outputJpg).catch(() => null)
  return s && s.size > 0 ? s.size : null
}

/** Re-encode an arbitrary image (e.g. a YouTube thumbnail) to a bounded JPEG. */
export async function imageToJpeg(inputPath: string, outputJpg: string): Promise<number | null> {
  return extractCover(inputPath, outputJpg)
}
