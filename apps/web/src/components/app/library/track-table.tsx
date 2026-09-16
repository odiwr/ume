'use client'
import * as React from 'react'
import { CircleAlert, ExternalLink, ListMusic, MoreVertical, Pencil, RotateCcw, Trash, Upload } from '@/components/ui/icons'
import { linkSiteLabel } from '@ume/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { EmptyState } from '@/components/ui/empty-state'
import { Input, Label } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { UserAvatar } from '@/components/app/avatar'
import { Ago } from '@/components/app/time'
import { useAction } from '@/components/app/use-action'
import { removeTrackFromPlaylist, retryTrack, updateTrackMeta } from '@/lib/app/actions/tracks'
import { displayName, trackStatusTone } from '@/lib/app/format'
import { formatDuration } from '@/lib/utils'

export interface TrackRow {
  entryId: string
  trackId: string
  title: string
  artist: string | null
  album: string | null
  durationMs: number | null
  coverUrl: string | null
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'disabled'
  errorMessage: string | null
  source: 'upload' | 'link'
  sourceSite: string | null
  sourceUrl: string | null
  addedAt: string
  addedVia: 'web' | 'discord'
  addedBy: { id: string; name: string; image: string | null; discordUsername: string | null; discordAvatar: string | null } | null
  addedByDiscordId: string | null
  mine: boolean
}

export interface TrackPermissions {
  editMeta: boolean
  deleteAny: boolean
  deleteOwn: boolean
  addTrack: boolean
}

export function TrackTable({ workspaceId, playlistId, rows, perms }: { workspaceId: string; playlistId: string; rows: TrackRow[]; perms: TrackPermissions }) {
  const [editing, setEditing] = React.useState<TrackRow | null>(null)
  const [removing, setRemoving] = React.useState<TrackRow | null>(null)

  if (!rows.length) {
    return (
      <EmptyState
        icon={<ListMusic className="size-6" />}
        title="This playlist is empty"
        description={perms.addTrack ? 'Drop audio files above or add a song from a link. Everyone with access sees who added what.' : 'Nobody has added a song here yet.'}
      />
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            <tr className="border-b border-border">
              <th className="w-12 px-4 py-2.5">#</th>
              <th className="px-2 py-2.5">Title</th>
              <th className="px-2 py-2.5">Added by</th>
              <th className="px-2 py-2.5">Added</th>
              <th className="px-2 py-2.5 text-right">Length</th>
              <th className="px-2 py-2.5">Status</th>
              <th className="w-12 px-2 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, i) => {
              const status = trackStatusTone(row.status)
              const canRemove = perms.deleteAny || (row.mine && perms.deleteOwn)
              return (
                <tr key={row.entryId} className="group transition-colors hover:bg-surface-2">
                  <td className="px-4 py-2 text-xs text-fg-subtle tabular-nums">{i + 1}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-3">
                      <Cover src={row.coverUrl} />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{row.title}</p>
                        <p className="flex items-center gap-1.5 truncate text-xs text-fg-muted">
                          {row.artist ? <span className="truncate">{row.artist}</span> : null}
                          {row.artist ? <span aria-hidden>·</span> : null}
                          <span className="inline-flex items-center gap-1">
                            {row.source === 'upload' ? <Upload className="size-3" aria-hidden /> : <ExternalLink className="size-3" aria-hidden />}
                            {row.source === 'upload' ? 'Upload' : linkSiteLabel(row.sourceSite)}
                          </span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={row.addedBy} size={22} />
                      <span className="max-w-36 truncate text-xs text-fg-muted">{row.addedBy ? displayName(row.addedBy) : row.addedByDiscordId ? 'Via Discord' : 'Removed user'}</span>
                    </div>
                  </td>
                  <td className="px-2 py-2 text-xs text-fg-muted">
                    <Ago date={row.addedAt} />
                  </td>
                  <td className="px-2 py-2 text-right text-xs text-fg-muted tabular-nums">{formatDuration(row.durationMs)}</td>
                  <td className="px-2 py-2">
                    {row.status === 'failed' && row.errorMessage ? (
                      <Tooltip content={row.errorMessage}>
                        <span>
                          <Badge tone={status.tone}>
                            <CircleAlert className="size-3" aria-hidden /> {status.label}
                          </Badge>
                        </span>
                      </Tooltip>
                    ) : row.status === 'ready' && row.source === 'link' && !row.durationMs ? (
                      <Tooltip content="Saved as a link only: no audio stored. The bot cannot play it until the Owner accepts the rights attestation and the song is re-added.">
                        <span>
                          <Badge tone="beige">Link only</Badge>
                        </span>
                      </Tooltip>
                    ) : (
                      <Badge tone={status.tone}>
                        {row.status === 'pending' || row.status === 'processing' ? <span className="size-1.5 animate-pulse rounded-full bg-current" aria-hidden /> : null}
                        {status.label}
                      </Badge>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg data-[state=open]:bg-surface-3"
                        aria-label={`Actions for ${row.title}`}
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        {perms.editMeta ? (
                          <DropdownMenuItem onSelect={() => setEditing(row)}>
                            <Pencil className="size-4" /> Edit details
                          </DropdownMenuItem>
                        ) : null}
                        {row.sourceUrl ? (
                          <DropdownMenuItem asChild>
                            <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-4" /> Open on {linkSiteLabel(row.sourceSite)}
                            </a>
                          </DropdownMenuItem>
                        ) : null}
                        {row.status === 'failed' && perms.addTrack ? <RetryItem workspaceId={workspaceId} trackId={row.trackId} /> : null}
                        {canRemove ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem destructive onSelect={() => setRemoving(row)}>
                              <Trash className="size-4" /> Remove from playlist
                            </DropdownMenuItem>
                          </>
                        ) : null}
                        {!perms.editMeta && !row.sourceUrl && !canRemove && row.status !== 'failed' ? (
                          <DropdownMenuItem disabled>No actions available</DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <EditTrackDialog workspaceId={workspaceId} row={editing} onClose={() => setEditing(null)} />
      <RemoveTrackDialog workspaceId={workspaceId} playlistId={playlistId} row={removing} onClose={() => setRemoving(null)} />
    </>
  )
}

function Cover({ src }: { src: string | null }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={36} height={36} className="size-9 shrink-0 rounded-md bg-surface-3 object-cover" loading="lazy" />
  }
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-3 text-fg-subtle" aria-hidden>
      <ListMusic className="size-4" />
    </span>
  )
}

function RetryItem({ workspaceId, trackId }: { workspaceId: string; trackId: string }) {
  const { run } = useAction()
  return (
    <DropdownMenuItem onSelect={() => run(() => retryTrack(workspaceId, trackId), { success: 'Queued again.' })}>
      <RotateCcw className="size-4" /> Retry
    </DropdownMenuItem>
  )
}

function EditTrackDialog({ workspaceId, row, onClose }: { workspaceId: string; row: TrackRow | null; onClose: () => void }) {
  const [title, setTitle] = React.useState('')
  const [artist, setArtist] = React.useState('')
  const [album, setAlbum] = React.useState('')
  const { run, pending } = useAction()
  React.useEffect(() => {
    if (row) {
      setTitle(row.title)
      setArtist(row.artist ?? '')
      setAlbum(row.album ?? '')
    }
  }, [row])
  return (
    <Dialog open={!!row} onOpenChange={(o) => (!o && !pending ? onClose() : undefined)}>
      {row ? (
        <DialogContent title="Edit track details" description="Fix what the file or the site got wrong. This changes what /np and the library show.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await run(() => updateTrackMeta(workspaceId, row.trackId, { title, artist: artist || null, album: album || null }), { success: 'Track updated.' })
              if (res.ok) onClose()
            }}
          >
            <div>
              <Label htmlFor="track-title">Title</Label>
              <Input id="track-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required autoFocus />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="track-artist">Artist</Label>
                <Input id="track-artist" value={artist} onChange={(e) => setArtist(e.target.value)} maxLength={200} placeholder="Unknown" />
              </div>
              <div>
                <Label htmlFor="track-album">Album</Label>
                <Input id="track-album" value={album} onChange={(e) => setAlbum(e.target.value)} maxLength={200} placeholder="Single" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" loading={pending} disabled={!title.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function RemoveTrackDialog({ workspaceId, playlistId, row, onClose }: { workspaceId: string; playlistId: string; row: TrackRow | null; onClose: () => void }) {
  const { run, pending } = useAction()
  return (
    <Dialog open={!!row} onOpenChange={(o) => (!o && !pending ? onClose() : undefined)}>
      {row ? (
        <DialogContent
          title={`Remove “${row.title}”?`}
          description="It leaves this playlist now. If it is in no other playlist, the stored audio is deleted as well."
        >
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={pending}
              onClick={async () => {
                const res = await run(() => removeTrackFromPlaylist(workspaceId, playlistId, row.trackId), {
                  success: (d) => (d.deleted ? 'Removed and deleted from storage.' : 'Removed from this playlist.'),
                })
                if (res.ok) onClose()
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
