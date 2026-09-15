import { createHash } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { and, eq, inArray, ne, sql } from './orm'
import { fileTypeFromFile } from 'file-type'
import { parseFile } from 'music-metadata'
import type { Logger } from 'pino'
import { UPLOAD } from '@ume/shared'
import {
  blockedHashes,
  playlistTracks,
  effectiveQuotaBytes,
  recomputeWorkspaceUsage,
  recountPlaylist,
  touchActivity,
  tracks,
  workspaces,
  type Db,
  type Track,
  type Workspace,
} from '@ume/db'
import { keys, type Storage } from '@ume/storage'
import { PermanentError, RetryableError } from './errors'
import { extractCover, imageToJpeg, probe, transcodeToOpus, type ProbeResult } from './ffmpeg'

/** Containers we accept by magic bytes (file-type extension names). */
const ALLOWED_EXT = new Set(['mp3', 'm4a', 'mp4', 'flac', 'wav', 'ogg', 'opus', 'webm', 'aiff', 'aif', 'oga', 'mpga', 'aac', 'weba'])
/** ffprobe format names accepted when magic-byte detection is inconclusive (raw MPEG frames, etc.). */
const ALLOWED_FORMATS = ['mp3', 'mov', 'mp4', 'm4a', 'flac', 'wav', 'ogg', 'matroska', 'webm', 'aiff', 'aac']

export interface SourceMeta {
  title?: string | null
  artist?: string | null
  album?: string | null
  /** Cover bytes (tag picture or a fetched thumbnail). */
  coverBuffer?: Buffer | null
  /** Public cover URL to keep on the track when no cover object is produced. */
  coverUrl?: string | null
}

export interface ProcessContext {
  db: Db
  storage: Storage
  log: Logger
  workspace: Workspace
  track: Track
  /** Local path of the source file (already downloaded). */
  inputPath: string
  /** Job scratch dir. */
  tmpDir: string
  /** Metadata known before reading tags (YouTube info); tags fill the rest. */
  meta?: SourceMeta
  /** Skip music-metadata tag parsing (the source is not a user file). */
  skipTags?: boolean
}

export type ProcessOutcome = { kind: 'ready'; sizeBytes: number; durationMs: number } | { kind: 'deduped'; existingTrackId: string }

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

export async function downloadToFile(storage: Storage, key: string, dest: string): Promise<number> {
  let obj: Awaited<ReturnType<Storage['getObjectStream']>>
  try {
    obj = await storage.getObjectStream(key)
  } catch (err) {
    const name = (err as { name?: string }).name
    if (name === 'NoSuchKey' || name === 'NotFound') {
      throw new PermanentError('The uploaded file is missing from storage. Please upload it again.', { detail: `object ${key} not found`, cause: err })
    }
    throw new RetryableError(`storage download failed for ${key}`, { cause: err })
  }
  try {
    await pipeline(obj.stream, createWriteStream(dest))
  } catch (err) {
    throw new RetryableError(`storage stream failed for ${key}`, { cause: err })
  }
  const s = await stat(dest)
  return s.size
}

export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256')
  await pipeline(createReadStream(filePath), async function* (source) {
    for await (const chunk of source) hash.update(chunk as Buffer)
  })
  return hash.digest('hex')
}

/** Magic-byte + stream-layout validation. Returns the probe so callers do not probe twice. */
export async function validateAudio(inputPath: string): Promise<ProbeResult> {
  const detected = await fileTypeFromFile(inputPath).catch(() => undefined)
  if (detected && !ALLOWED_EXT.has(detected.ext)) {
    throw new PermanentError(`Unsupported file type (${detected.ext}). Upload MP3, M4A, FLAC, WAV, OGG, Opus, WebM or AIFF.`)
  }
  const p = await probe(inputPath)
  if (!detected) {
    const fmt = (p.formatName ?? '').toLowerCase()
    if (!ALLOWED_FORMATS.some((f) => fmt.split(',').includes(f))) {
      throw new PermanentError('Unsupported file type. Upload MP3, M4A, FLAC, WAV, OGG, Opus, WebM or AIFF.', { detail: `format ${p.formatName ?? 'unknown'}` })
    }
  }
  if (!p.hasAudio) throw new PermanentError('No audio found in this file.')
  if (p.hasVideo) throw new PermanentError('Video files are not supported. Upload the audio only.')
  if (p.durationMs > UPLOAD.maxDurationMs) {
    throw new PermanentError(`Tracks longer than ${Math.round(UPLOAD.maxDurationMs / 60000)} minutes are not allowed.`)
  }
  return p
}

export interface ParsedTags {
  title: string | null
  artist: string | null
  album: string | null
  durationMs: number | null
  picture: { data: Buffer; format: string } | null
}

export async function readTags(inputPath: string): Promise<ParsedTags> {
  try {
    const m = await parseFile(inputPath, { duration: false, skipCovers: false })
    const pic = m.common.picture?.[0]
    return {
      title: m.common.title?.trim() || null,
      artist: (m.common.artist ?? m.common.artists?.[0] ?? m.common.albumartist)?.trim() || null,
      album: m.common.album?.trim() || null,
      durationMs: m.format.duration ? Math.round(m.format.duration * 1000) : null,
      picture: pic ? { data: Buffer.from(pic.data), format: pic.format } : null,
    }
  } catch {
    return { title: null, artist: null, album: null, durationMs: null, picture: null }
  }
}

/** Quota check that ignores this track's own (reserved) bytes. */
export async function quotaAllows(db: Db, workspaceId: string, trackId: string, newBytes: number): Promise<{ ok: boolean; used: number; quota: number }> {
  const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, workspaceId) })
  if (!ws) throw new PermanentError('Workspace no longer exists.')
  const [agg] = await db
    .select({ bytes: sql<number>`coalesce(sum(${tracks.sizeBytes}), 0)::bigint` })
    .from(tracks)
    .where(and(eq(tracks.workspaceId, workspaceId), ne(tracks.id, trackId), ne(tracks.status, 'failed')))
  const used = Number(agg?.bytes ?? 0)
  const quota = effectiveQuotaBytes(ws)
  return { ok: used + newBytes <= quota, used, quota }
}

export async function playlistIdsForTrack(db: Db, trackId: string): Promise<string[]> {
  const rows = await db.select({ playlistId: playlistTracks.playlistId }).from(playlistTracks).where(eq(playlistTracks.trackId, trackId))
  return [...new Set(rows.map((r) => r.playlistId))]
}

export async function recountPlaylists(db: Db, playlistIds: string[]): Promise<void> {
  for (const id of playlistIds) await recountPlaylist(db, id)
}

/** Best-effort removal of the objects a track may own. */
export async function deleteTrackObjects(
  storage: Storage,
  log: Logger,
  workspaceId: string,
  trackId: string,
  opts: { original?: string | null; outputs?: boolean } = {},
): Promise<void> {
  const list: string[] = []
  if (opts.outputs !== false) list.push(keys.track(workspaceId, trackId), keys.cover(workspaceId, trackId))
  if (opts.original) list.push(opts.original)
  if (!list.length) return
  try {
    await storage.deleteObjects(list)
  } catch (err) {
    log.warn({ trackId, keys: list, err: err instanceof Error ? err.message : String(err) }, 'object cleanup failed (reconcile will retry)')
  }
}

/**
 * Same bytes already live in this workspace: move the new track's playlist rows onto the
 * existing ready track, drop the new track and its original object.
 */
export async function mergeDuplicate(ctx: ProcessContext, existing: Track): Promise<void> {
  const { db, storage, log, track } = ctx
  const mine = await db.query.playlistTracks.findMany({ where: eq(playlistTracks.trackId, track.id) })
  const theirs = await db.query.playlistTracks.findMany({ where: eq(playlistTracks.trackId, existing.id) })
  const already = new Set(theirs.map((b) => b.playlistId))
  const affected = new Set<string>()
  for (const bt of mine) {
    affected.add(bt.playlistId)
    if (already.has(bt.playlistId)) {
      await db.delete(playlistTracks).where(eq(playlistTracks.id, bt.id))
    } else {
      await db.update(playlistTracks).set({ trackId: existing.id }).where(eq(playlistTracks.id, bt.id))
      already.add(bt.playlistId)
    }
  }
  await db.delete(tracks).where(and(eq(tracks.id, track.id), eq(tracks.workspaceId, track.workspaceId)))
  await deleteTrackObjects(storage, log, track.workspaceId, track.id, { original: track.originalStorageKey, outputs: true })
  await recountPlaylists(db, [...affected])
  await recomputeWorkspaceUsage(db, track.workspaceId)
  log.info({ trackId: track.id, existingTrackId: existing.id, playlists: affected.size }, 'duplicate merged into existing track')
}

// ---------------------------------------------------------------------------
// The pipeline shared by uploads and YouTube ingestion
// ---------------------------------------------------------------------------

export async function processLocalAudio(ctx: ProcessContext): Promise<ProcessOutcome> {
  const { db, storage, log, track, inputPath, tmpDir } = ctx
  const workspaceId = track.workspaceId

  // 1. Content hash: blocklist + dedupe before spending CPU on it.
  const sha256 = await sha256File(inputPath)
  const blocked = await db.query.blockedHashes.findFirst({ where: eq(blockedHashes.sha256, sha256) })
  if (blocked) throw new PermanentError('This content is blocked.', { detail: `sha256 ${sha256} is on the blocklist` })

  const twin = await db.query.tracks.findFirst({
    where: and(eq(tracks.workspaceId, workspaceId), eq(tracks.sha256, sha256), ne(tracks.id, track.id)),
  })
  if (twin) {
    if (twin.status === 'ready') {
      await mergeDuplicate(ctx, twin)
      return { kind: 'deduped', existingTrackId: twin.id }
    }
    if (twin.status === 'disabled') throw new PermanentError('This content is blocked.', { detail: `duplicate of disabled track ${twin.id}` })
    if (twin.status === 'failed') {
      // A failed twin only holds the unique (workspace, sha256) slot; free it.
      await db.update(tracks).set({ sha256: null, updatedAt: new Date() }).where(eq(tracks.id, twin.id))
    } else {
      throw new RetryableError(`same content is being processed as ${twin.id}`, { userMessage: 'The same file is already being processed.' })
    }
  }

  // 2. Validate the container and streams.
  const probed = await validateAudio(inputPath)

  // 3. Tags (uploads) merged with what the caller already knows (YouTube info).
  const tags = ctx.skipTags ? null : await readTags(inputPath)
  const title = (ctx.meta?.title ?? tags?.title ?? track.title ?? path.parse(track.originalFilename ?? 'Untitled').name).trim().slice(0, 200) || 'Untitled'
  const artist = (ctx.meta?.artist ?? tags?.artist ?? track.artist ?? null)?.trim().slice(0, 200) || null
  const album = (ctx.meta?.album ?? tags?.album ?? track.album ?? null)?.trim().slice(0, 200) || null
  const durationMs = probed.durationMs || tags?.durationMs || track.durationMs || 0
  if (durationMs > UPLOAD.maxDurationMs) {
    throw new PermanentError(`Tracks longer than ${Math.round(UPLOAD.maxDurationMs / 60000)} minutes are not allowed.`)
  }

  // 4. Transcode.
  const opusPath = path.join(tmpDir, `${track.id}.${UPLOAD.output.extension}`)
  const opusBytes = await transcodeToOpus(inputPath, opusPath)

  // 5. Cover: tag picture > caller-provided bytes > embedded video stream.
  const coverPath = path.join(tmpDir, `${track.id}.jpg`)
  let coverBytes: number | null = null
  const pictureBytes = tags?.picture?.data ?? ctx.meta?.coverBuffer ?? null
  if (pictureBytes && pictureBytes.length > 0) {
    const rawPath = path.join(tmpDir, `${track.id}.cover-src`)
    await writeFile(rawPath, pictureBytes)
    coverBytes = await imageToJpeg(rawPath, coverPath)
  }
  if (!coverBytes) coverBytes = await extractCover(inputPath, coverPath)

  const sizeBytes = opusBytes + (coverBytes ?? 0)

  // 6. Quota (the plan may have changed since the upload was reserved).
  const q = await quotaAllows(db, workspaceId, track.id, sizeBytes)
  if (!q.ok) throw new PermanentError('Over storage quota. Free up space or upgrade the plan, then upload again.', { detail: `used ${q.used} + ${sizeBytes} > ${q.quota}` })

  // 7. Upload outputs.
  const trackKey = keys.track(workspaceId, track.id)
  const coverKey = coverBytes ? keys.cover(workspaceId, track.id) : null
  try {
    await storage.putObject(trackKey, createReadStream(opusPath), UPLOAD.output.mimeType, opusBytes)
    if (coverKey && coverBytes) await storage.putObject(coverKey, await readFile(coverPath), 'image/jpeg', coverBytes)
  } catch (err) {
    throw new RetryableError('storage upload failed', { cause: err })
  }

  // 8. Commit.
  const now = new Date()
  await db
    .update(tracks)
    .set({
      status: 'ready',
      title,
      artist,
      album,
      durationMs,
      storageKey: trackKey,
      coverStorageKey: coverKey,
      coverUrl: coverKey ? (storage.publicUrl(coverKey) ?? ctx.meta?.coverUrl ?? track.coverUrl ?? null) : (ctx.meta?.coverUrl ?? track.coverUrl ?? null),
      sizeBytes,
      sha256,
      originalStorageKey: null,
      errorMessage: null,
      readyAt: now,
      updatedAt: now,
    })
    .where(and(eq(tracks.id, track.id), eq(tracks.workspaceId, workspaceId)))

  if (track.originalStorageKey) {
    await storage.deleteObject(track.originalStorageKey).catch((err: unknown) => {
      log.warn({ trackId: track.id, key: track.originalStorageKey, err: err instanceof Error ? err.message : String(err) }, 'original delete failed (reconcile will retry)')
    })
  }

  await recomputeWorkspaceUsage(db, workspaceId)
  await recountPlaylists(db, await playlistIdsForTrack(db, track.id))
  await touchActivity(db, workspaceId, {
    kind: 'web_action',
    userId: track.uploadedByUserId,
    discordUserId: track.uploadedByDiscordId,
    metadata: { action: 'track.ready', trackId: track.id, source: track.source },
  })

  log.info({ trackId: track.id, workspaceId, sizeBytes, durationMs, codec: probed.codec }, 'track ready')
  return { kind: 'ready', sizeBytes, durationMs }
}

/**
 * Mark a track failed (or pending again when a retry is coming), release its quota
 * reservation and remove any objects it produced. Never throws.
 */
export async function failTrack(
  db: Db,
  storage: Storage,
  log: Logger,
  track: Track,
  opts: { userMessage: string; willRetry: boolean },
): Promise<void> {
  const now = new Date()
  try {
    if (opts.willRetry) {
      await db
        .update(tracks)
        .set({ status: 'pending', errorMessage: opts.userMessage, updatedAt: now })
        .where(and(eq(tracks.id, track.id), eq(tracks.workspaceId, track.workspaceId)))
      await deleteTrackObjects(storage, log, track.workspaceId, track.id, { outputs: true })
    } else {
      await db
        .update(tracks)
        .set({
          status: 'failed',
          errorMessage: opts.userMessage,
          sizeBytes: 0,
          storageKey: null,
          coverStorageKey: null,
          originalStorageKey: null,
          updatedAt: now,
        })
        .where(and(eq(tracks.id, track.id), eq(tracks.workspaceId, track.workspaceId)))
      await deleteTrackObjects(storage, log, track.workspaceId, track.id, { outputs: true, original: track.originalStorageKey })
    }
    await recomputeWorkspaceUsage(db, track.workspaceId)
    await recountPlaylists(db, await playlistIdsForTrack(db, track.id))
  } catch (err) {
    log.error({ trackId: track.id, err: err instanceof Error ? err.message : String(err) }, 'failTrack bookkeeping failed')
  }
}

/** Load a track scoped to its workspace, or null. */
export async function loadTrack(db: Db, workspaceId: string, trackId: string): Promise<Track | null> {
  const t = await db.query.tracks.findFirst({ where: and(eq(tracks.id, trackId), eq(tracks.workspaceId, workspaceId)) })
  return t ?? null
}

export async function setProcessing(db: Db, track: Track): Promise<void> {
  await db
    .update(tracks)
    .set({ status: 'processing', errorMessage: null, updatedAt: new Date() })
    .where(and(eq(tracks.id, track.id), eq(tracks.workspaceId, track.workspaceId), inArray(tracks.status, ['pending', 'processing'])))
}
