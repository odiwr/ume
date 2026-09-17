import type { Metadata } from 'next'
import Link from 'next/link'
import { ListMusic } from '@/components/ui/icons'
import { can } from '@ume/db'
import { CAP } from '@ume/shared'
import { EmptyState } from '@/components/ui/empty-state'
import { CreatePlaylistButton, PlaylistMenu } from '@/components/app/library/playlist-dialogs'
import { CoverArt } from '@/components/app/library/cover-art'
import { playlistCoverUrl } from '@/components/app/library/cover-url'
import { PageHeader } from '@/components/app/page-header'
import { listPlaylists } from '@/lib/app/queries'
import { requireWorkspacePage } from '@/lib/app/workspace'
import { formatDuration } from '@/lib/utils'

export const metadata: Metadata = { title: 'Library', robots: { index: false } }

export default async function LibraryPage({ params }: { params: Promise<{ ws: string }> }) {
  const { ws: umeId } = await params
  const { workspace, access } = await requireWorkspacePage(umeId, CAP.VIEW_LIBRARY)
  const playlists = await listPlaylists(workspace.id)
  const canManage = can(access, CAP.MANAGE_PLAYLISTS)
  const covers = await Promise.all(playlists.map((p) => playlistCoverUrl(p.coverStorageKey)))

  return (
    <>
      <PageHeader
        title="Library"
        actions={
          canManage && playlists.length ? (
            <CreatePlaylistButton
              workspaceId={workspace.id}
              umeId={umeId}
              count={playlists.length}
            />
          ) : null
        }
      />

      {playlists.length ? (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
          {playlists.map((p, i) => (
            <li key={p.id} className="group relative min-w-0">
              <Link
                href={`/app/${umeId}/library/${p.slug}`}
                className="flex flex-col gap-3 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-pink"
              >
                <CoverArt
                  name={p.name}
                  src={covers[i] ?? null}
                  className="w-full transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                />
                <span className="min-w-0 px-1">
                  <span className="block truncate font-display text-base font-semibold text-fg">
                    {p.name}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-fg-muted tabular-nums">
                    {p.trackCount.toLocaleString('en-US')} {p.trackCount === 1 ? 'track' : 'tracks'}
                    {p.totalDurationMs ? ` · ${formatDuration(p.totalDurationMs)}` : ''}
                  </span>
                </span>
              </Link>
              {canManage ? (
                <div className="absolute top-2 right-2 rounded-lg bg-surface/90">
                  <PlaylistMenu
                    workspaceId={workspace.id}
                    umeId={umeId}
                    playlist={p}
                    afterDelete="library"
                  />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          className="border-0 bg-surface-2"
          icon={<ListMusic className="size-6" />}
          title="No playlists yet"
          description={
            canManage
              ? 'Create a playlist, then add songs to it.'
              : 'An Admin needs to create a playlist before anyone can add music.'
          }
        >
          {canManage ? (
            <CreatePlaylistButton workspaceId={workspace.id} umeId={umeId} count={0} size="sm" />
          ) : null}
        </EmptyState>
      )}
    </>
  )
}
