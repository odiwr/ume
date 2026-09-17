/**
 * Object key layout. Everything for a workspace lives under one prefix so a purge is
 * a single prefix delete.
 *
 *   ws/<workspaceId>/uploads/<trackId>/<safe-filename>   original upload (deleted after transcode)
 *   ws/<workspaceId>/tracks/<trackId>.opus               normalized Opus (what the bot streams)
 *   ws/<workspaceId>/covers/<trackId>.jpg                cover art
 *   ws/<workspaceId>/playlists/<playlistId>-<version>.<ext>  playlist cover (version busts caches)
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
  playlistCover: (
    workspaceId: string,
    playlistId: string,
    version: string,
    ext: 'jpg' | 'png' | 'webp',
  ) => `ws/${workspaceId}/playlists/${playlistId}-${version}.${ext}`,
}

/** True when `key` is a cover key for exactly this playlist in exactly this workspace. */
export function isPlaylistCoverKey(key: string, workspaceId: string, playlistId: string): boolean {
  const prefix = `ws/${workspaceId}/playlists/${playlistId}-`
  if (!key.startsWith(prefix)) return false
  return /^[a-z0-9]{8,32}\.(jpg|png|webp)$/.test(key.slice(prefix.length))
}
