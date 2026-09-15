/**
 * Object key layout. Everything for a workspace lives under one prefix so a purge is
 * a single prefix delete.
 *
 *   ws/<workspaceId>/uploads/<trackId>/<safe-filename>   original upload (deleted after transcode)
 *   ws/<workspaceId>/tracks/<trackId>.opus               normalized Opus (what the bot streams)
 *   ws/<workspaceId>/covers/<trackId>.jpg                cover art
 *   ws/<workspaceId>/buckets/<bucketId>.jpg              bucket cover
 */
export function safeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file'
  return base.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'file'
}

export const keys = {
  workspacePrefix: (workspaceId: string) => `ws/${workspaceId}/`,
  upload: (workspaceId: string, trackId: string, filename: string) =>
    `ws/${workspaceId}/uploads/${trackId}/${safeFilename(filename)}`,
  track: (workspaceId: string, trackId: string) => `ws/${workspaceId}/tracks/${trackId}.opus`,
  cover: (workspaceId: string, trackId: string) => `ws/${workspaceId}/covers/${trackId}.jpg`,
  bucketCover: (workspaceId: string, bucketId: string) => `ws/${workspaceId}/buckets/${bucketId}.jpg`,
}
