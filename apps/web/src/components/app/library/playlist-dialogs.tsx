'use client'
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { MoreVertical, Pencil, Plus, Trash } from 'lucide-react'
import { PLAYLIST } from '@ume/shared'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input, Label, Textarea } from '@/components/ui/input'
import { useAction } from '@/components/app/use-action'
import { createPlaylist, deletePlaylist, renamePlaylist } from '@/lib/app/actions/playlists'

export function CreatePlaylistButton({ workspaceId, umeId, count, size = 'md' }: { workspaceId: string; umeId: string; count: number; size?: 'sm' | 'md' }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const { run, pending } = useAction()
  const router = useRouter()
  const full = count >= PLAYLIST.maxPerWorkspace
  return (
    <>
      <Button size={size} onClick={() => setOpen(true)} disabled={full} title={full ? `Limit of ${PLAYLIST.maxPerWorkspace} playlists reached` : undefined}>
        <Plus className="size-4" /> New playlist
      </Button>
      <Dialog open={open} onOpenChange={(o) => (!pending ? setOpen(o) : undefined)}>
        <DialogContent title="New playlist" description="Playlists are flat: one level, any number of songs. You can rename it any time.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await run(() => createPlaylist(workspaceId, { name }), { success: 'Playlist created.' })
              if (res.ok) {
                setOpen(false)
                setName('')
                router.push(`/app/${umeId}/library/${res.data.slug}`)
              }
            }}
          >
            <div>
              <Label htmlFor="playlist-name">Name</Label>
              <Input
                id="playlist-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Late night drives"
                maxLength={PLAYLIST.nameMaxLength}
                autoFocus
                required
              />
              <p className="mt-1 text-xs text-fg-subtle tabular-nums">
                {name.length}/{PLAYLIST.nameMaxLength}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" loading={pending} disabled={!name.trim()}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function PlaylistMenu({
  workspaceId,
  umeId,
  playlist,
  afterDelete,
}: {
  workspaceId: string
  umeId: string
  playlist: { id: string; name: string; description: string | null; slug: string; trackCount: number }
  afterDelete?: 'library' | 'stay'
}) {
  const [dialog, setDialog] = React.useState<'rename' | 'delete' | null>(null)
  const [name, setName] = React.useState(playlist.name)
  const [description, setDescription] = React.useState(playlist.description ?? '')
  const { run, pending } = useAction()
  const router = useRouter()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex size-9 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg data-[state=open]:bg-surface-2"
          aria-label={`Actions for ${playlist.name}`}
        >
          <MoreVertical className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem
            onSelect={() => {
              setName(playlist.name)
              setDescription(playlist.description ?? '')
              setDialog('rename')
            }}
          >
            <Pencil className="size-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onSelect={() => setDialog('delete')}>
            <Trash className="size-4" /> Delete playlist
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === 'rename'} onOpenChange={(o) => (!o && !pending ? setDialog(null) : undefined)}>
        <DialogContent title="Rename playlist" description="The link changes with the name; Discord commands use the new name right away.">
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await run(() => renamePlaylist(workspaceId, playlist.id, { name, description }), { success: 'Playlist updated.' })
              if (res.ok) {
                setDialog(null)
                if (res.data.slug !== playlist.slug && afterDelete !== 'library') router.replace(`/app/${umeId}/library/${res.data.slug}`)
              }
            }}
          >
            <div>
              <Label htmlFor={`rename-${playlist.id}`}>Name</Label>
              <Input id={`rename-${playlist.id}`} value={name} onChange={(e) => setName(e.target.value)} maxLength={PLAYLIST.nameMaxLength} required autoFocus />
            </div>
            <div>
              <Label htmlFor={`desc-${playlist.id}`}>Description (optional)</Label>
              <Textarea id={`desc-${playlist.id}`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="What belongs here, what does not." />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" loading={pending} disabled={!name.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === 'delete'} onOpenChange={(o) => (!o && !pending ? setDialog(null) : undefined)}>
        <DialogContent
          title={`Delete “${playlist.name}”?`}
          description={
            playlist.trackCount
              ? `${playlist.trackCount} song${playlist.trackCount === 1 ? '' : 's'} will leave this playlist. Songs that are in no other playlist are deleted from storage. This cannot be undone.`
              : 'This playlist is empty. Deleting it cannot be undone.'
          }
        >
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={pending}>
              Keep it
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={pending}
              onClick={async () => {
                const res = await run(() => deletePlaylist(workspaceId, playlist.id), {
                  success: (d) => (d.removedTracks ? `Playlist deleted; ${d.removedTracks} song${d.removedTracks === 1 ? '' : 's'} removed from storage.` : 'Playlist deleted.'),
                })
                if (res.ok) {
                  setDialog(null)
                  if (afterDelete !== 'library') router.replace(`/app/${umeId}/library`)
                }
              }}
            >
              Delete playlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
