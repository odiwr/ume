import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { effectiveQuotaBytes, recomputeWorkspaceUsage, tracks, workspaces, type Workspace } from '@ume/db'
import { UPLOAD, getPlan } from '@ume/shared'
import { db } from '@/lib/db'

/**
 * Quota reservation for uploads. The original file size is reserved up front with a
 * guarded UPDATE (so two concurrent uploads cannot both squeeze past the quota); the
 * worker replaces it with the real Opus size after transcoding, and a failed upload
 * releases it. Never deletes anything.
 */
export type ReserveResult = { ok: true } | { ok: false; reason: 'quota' | 'tracks' | 'disconnected' }

export async function reserveUpload(ws: Workspace, sizeBytes: number): Promise<ReserveResult> {
  const quota = effectiveQuotaBytes(ws)
  const maxTracks = getPlan(ws.plan).maxTracks
  if (ws.status !== 'connected') return { ok: false, reason: 'disconnected' }
  if (ws.storageUsedBytes + sizeBytes > quota) return { ok: false, reason: 'quota' }
  if (ws.trackCount + 1 > maxTracks) return { ok: false, reason: 'tracks' }
  const updated = await db
    .update(workspaces)
    .set({
      storageUsedBytes: sql`${workspaces.storageUsedBytes} + ${sizeBytes}`,
      trackCount: sql`${workspaces.trackCount} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaces.id, ws.id),
        eq(workspaces.status, 'connected'),
        sql`${workspaces.storageUsedBytes} + ${sizeBytes} <= ${quota}`,
        sql`${workspaces.trackCount} + 1 <= ${maxTracks}`,
      ),
    )
    .returning({ id: workspaces.id })
  if (!updated.length) return { ok: false, reason: 'quota' }
  return { ok: true }
}

/** Mark an upload failed and give its reserved bytes back. */
export async function failUpload(workspaceId: string, trackId: string, message: string): Promise<void> {
  await db
    .update(tracks)
    .set({ status: 'failed', errorMessage: message.slice(0, 500), sizeBytes: 0, updatedAt: new Date() })
    .where(and(eq(tracks.id, trackId), eq(tracks.workspaceId, workspaceId)))
  await recomputeWorkspaceUsage(db, workspaceId)
}

export function extensionOf(filename: string): string {
  return (filename.split('.').pop() ?? '').toLowerCase()
}

export function isAcceptedUpload(filename: string, mimeType: string): boolean {
  const ext = extensionOf(filename)
  if (!(UPLOAD.acceptedExtensions as readonly string[]).includes(ext)) return false
  const mime = mimeType.toLowerCase().split(';')[0]?.trim() ?? ''
  // Browsers report an empty or generic type for some audio containers; the extension allow-list still applies.
  if (!mime || mime === 'application/octet-stream') return true
  return (UPLOAD.acceptedMimeTypes as readonly string[]).includes(mime)
}
