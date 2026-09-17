import 'server-only'
import { getStorage } from '@ume/storage'

/**
 * The bucket is private, so covers are shown through short-lived presigned GET URLs
 * signed at render time. Returns null when there is no cover or storage is not configured.
 */
export async function playlistCoverUrl(key: string | null): Promise<string | null> {
  if (!key) return null
  try {
    return getStorage().publicUrl(key) ?? (await getStorage().presignDownload(key, 60 * 60))
  } catch (err) {
    console.error('[playlist cover] could not sign url', err)
    return null
  }
}
