/**
 * Product-wide constants. Anything a human might want to tune lives here.
 */
export const BRAND = {
  name: 'Ume',
  tagline: 'A 24/7 music bot that never leaves the room.',
  colors: {
    pink: '#E464B0',
    black: '#0A0A0A',
    offWhite: '#F2F2F2',
    sage: '#B5C1B4',
    beige: '#D6CABF',
    gray: '#B3B3B3',
  },
} as const

export const COMMAND_PREFIX = '~'

/** Uploads */
export const UPLOAD = {
  /** Hard cap on the *original* file a user may upload. Transcoded output is far smaller. */
  maxOriginalBytes: 100 * 1024 * 1024, // 100 MB
  /** Longest single track we will keep (Discord listeners rarely want more). */
  maxDurationMs: 30 * 60 * 1000, // 30 minutes
  /** Output codec settings. Discord voice is Opus; storing Opus means zero-transcode playback. */
  output: {
    container: 'ogg',
    codec: 'libopus',
    bitrateKbps: 128,
    sampleRate: 48_000,
    channels: 2,
    /** Single-pass EBU R128 loudness normalization so tracks sit at the same level. */
    loudnorm: 'I=-14:TP=-1.5:LRA=11',
    extension: 'ogg',
    mimeType: 'audio/ogg',
  },
  acceptedMimeTypes: [
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/flac',
    'audio/x-flac',
    'audio/wav',
    'audio/x-wav',
    'audio/ogg',
    'audio/opus',
    'audio/webm',
    'audio/aiff',
    'audio/x-aiff',
  ],
  acceptedExtensions: ['mp3', 'm4a', 'aac', 'flac', 'wav', 'ogg', 'opus', 'webm', 'aiff', 'aif'],
} as const

/** Buckets (the user-facing "folders"). Root-only: buckets never nest. */
export const BUCKET = {
  maxPerWorkspace: 50,
  nameMinLength: 1,
  nameMaxLength: 40,
  maxTracks: 2_000,
} as const

/** Inactivity / auto-purge policy (days). */
export const INACTIVITY = {
  purgeAfterDays: 60,
  firstNoticeAtDays: 30,
  /** Final notice this many hours before the purge. */
  finalNoticeHoursBefore: 48,
} as const

/** Claim tokens issued by the bot (`~reload`). */
export const CLAIM_TOKEN = {
  prefix: 'ume_',
  /** Unclaimed tokens expire after this long. */
  ttlMs: 24 * 60 * 60 * 1000,
} as const

/** Invites (share links + email invites). */
export const INVITE = {
  linkTokenLength: 32,
  defaultExpiryDays: 7,
  maxExpiryDays: 365,
} as const

/** Bot heartbeat cadence; the CEO dashboard treats a workspace as offline past 3 missed beats. */
export const BOT_HEARTBEAT_MS = 30_000

/** Discord voice bitrate baseline (kbps) — used for UI copy only. */
export const DISCORD_VOICE_DEFAULT_KBPS = 64

/** Purge confirmation code lifetime. */
export const DANGER_CONFIRM_TTL_MS = 5 * 60 * 1000
