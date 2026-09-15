import type { Metadata } from 'next'
import Link from 'next/link'
import { ListMusic } from 'lucide-react'
import { can } from '@ume/db'
import { CAP, PLAYLIST } from '@ume/shared'
import { EmptyState } from '@/components/ui/empty-state'
import { CreatePlaylistButton, PlaylistMenu } from '@/components/app/library/playlist-dialogs'
import { PageHeader } from '@/components/app/page-header'
import { Ago } from '@/components/app/time'
import { displayName } from '@/lib/app/format'
import { listPlaylists } from '@/lib/app/queries'
import { requireWorkspacePage } from '@/lib/app/workspace'
import { formatDuration } from '@/lib/utils'

export const metadata: Metadata = { title: 'Library', robots: { index: false } }

export default async function LibraryPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const { workspace, access } = await requireWorkspacePage(umeId, CAP.VIEW_LIBRARY)
  const playlists = await listPlaylists(workspace.id)
  const canManage = can(access, CAP.MANAGE_PLAYLISTS)
  const totalTracks = playlists.reduce((n, p) => n + p.trackCount, 0)

  return (
    <>
      <PageHeader
        title="Library"
        description={
          playlists.length
            ? `${playlists.length} playlist${playlists.length === 1 ? '' : 's'}, ${totalTracks.toLocaleString('en-US')} ready track${totalTracks === 1 ? '' : 's'}. Play any of them in Discord with /play.`
            : 'Playlists are the whole structure: flat, shared, and playable with /play <name>.'
        }
        actions={canManage ? <CreatePlaylistButton workspaceId={workspace.id} umeId={umeId} count={playlists.length} /> : null}
      />

      {playlists.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {playlists.map((p) => (
            <div key={p.id} className="group relative flex flex-col rounded-2xl border border-border bg-surface transition-colors hover:border-border-strong hover:bg-surface-2">
              <Link href={`/app/${umeId}/library/${p.slug}`} className="flex flex-1 flex-col gap-4 p-5 focus-visible:outline-none">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-surface-3 text-fg-muted transition-colors group-hover:bg-pink/15 group-hover:text-pink">
                    <ListMusic className="size-5" aria-hidden />
                  </span>
                  <span className="text-xs text-fg-subtle tabular-nums">
                    {p.trackCount.toLocaleString('en-US')} {p.trackCount === 1 ? 'track' : 'tracks'}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-display text-lg font-semibold">{p.name}</h3>
                  <p className="mt-0.5 truncate text-xs text-fg-muted">
                    {p.description ? p.description : <>{formatDuration(p.totalDurationMs)} of music</>}
                  </p>
                </div>
                <p className="mt-auto text-[11px] text-fg-subtle">
                  {p.createdBy ? `By ${displayName(p.createdBy)} · ` : ''}
                  updated <Ago date={p.updatedAt} />
                </p>
              </Link>
              {canManage ? (
                <div className="absolute right-3 top-3">
                  <PlaylistMenu workspaceId={workspace.id} umeId={umeId} playlist={p} afterDelete="library" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<ListMusic className="size-6" />}
          title="No playlists yet"
          description={
            canManage
              ? `Create the first one. A workspace can hold up to ${PLAYLIST.maxPerWorkspace} playlists, each with up to ${PLAYLIST.maxTracks.toLocaleString('en-US')} tracks.`
              : 'A Master needs to create a playlist before anyone can add music.'
          }
        >
          {canManage ? <CreatePlaylistButton workspaceId={workspace.id} umeId={umeId} count={0} size="sm" /> : null}
        </EmptyState>
      )}
    </>
  )
}
