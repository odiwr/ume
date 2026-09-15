import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { can, getFlag } from '@ume/db'
import { CAP } from '@ume/shared'
import { AddLinkForm } from '@/components/app/library/add-link-form'
import { AutoRefresh } from '@/components/app/library/auto-refresh'
import { PlaylistMenu } from '@/components/app/library/playlist-dialogs'
import { TrackTable, type TrackRow } from '@/components/app/library/track-table'
import { Uploader } from '@/components/app/library/uploader'
import { PageHeader, Section } from '@/components/app/page-header'
import { db } from '@/lib/db'
import { EXTRACTION_NOTICES, extractionState } from '@/lib/app/links'
import { getPlaylistBySlug, listEntries } from '@/lib/app/queries'
import { requireWorkspacePage } from '@/lib/app/workspace'
import { formatDuration } from '@/lib/utils'

export const metadata: Metadata = { title: 'Playlist', robots: { index: false } }

export default async function PlaylistPage({ params }: { params: Promise<{ ws: string; playlist: string }> }) {
  const { ws: umeId, playlist: slug } = await params
  const { workspace, access, user } = await requireWorkspacePage(umeId, CAP.VIEW_LIBRARY)
  const playlist = await getPlaylistBySlug(workspace.id, slug)
  if (!playlist) notFound()

  const [entries, uploadsEnabled, extraction] = await Promise.all([listEntries(workspace.id, playlist.id), getFlag(db, 'uploads_enabled'), extractionState(workspace)])

  const canAdd = can(access, CAP.ADD_TRACK)
  const perms = {
    addTrack: canAdd,
    editMeta: can(access, CAP.EDIT_TRACK_META),
    deleteAny: can(access, CAP.DELETE_ANY_TRACK),
    deleteOwn: can(access, CAP.DELETE_OWN_TRACK),
  }
  const rows: TrackRow[] = entries.map((e) => ({
    entryId: e.id,
    trackId: e.track.id,
    title: e.track.title,
    artist: e.track.artist,
    album: e.track.album,
    durationMs: e.track.durationMs,
    coverUrl: e.track.coverUrl,
    status: e.track.status,
    errorMessage: e.track.errorMessage,
    source: e.track.source,
    sourceSite: e.track.sourceSite,
    sourceUrl: e.track.sourceUrl,
    addedAt: e.addedAt.toISOString(),
    addedVia: e.addedVia,
    addedBy: e.addedBy,
    addedByDiscordId: e.addedByDiscordId,
    mine: e.addedByUserId === user.id,
  }))
  const inFlight = rows.some((r) => r.status === 'pending' || r.status === 'processing')
  const readOnlyReason = workspace.status !== 'connected' ? 'This workspace is disconnected and read-only until a new token is entered.' : !canAdd ? 'Your role cannot add music here.' : null
  const uploadDisabledReason = readOnlyReason ?? (!uploadsEnabled ? 'Uploads are paused on Ume right now. Adding from a link still works.' : null)
  const extractionNotice = extraction === 'allowed' ? null : EXTRACTION_NOTICES[extraction]

  return (
    <>
      <AutoRefresh active={inFlight} />
      <PageHeader
        back={{ href: `/app/${umeId}/library`, label: 'Library' }}
        title={playlist.name}
        description={
          <>
            {playlist.description ? `${playlist.description} · ` : ''}
            {playlist.trackCount.toLocaleString('en-US')} ready {playlist.trackCount === 1 ? 'track' : 'tracks'}, {formatDuration(playlist.totalDurationMs)}. In Discord:{' '}
            <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-xs text-fg">/play {playlist.name}</code>
          </>
        }
        actions={can(access, CAP.MANAGE_PLAYLISTS) ? <PlaylistMenu workspaceId={workspace.id} umeId={umeId} playlist={playlist} /> : null}
      />

      {canAdd ? (
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Uploader workspaceId={workspace.id} playlistId={playlist.id} disabled={!!uploadDisabledReason} disabledReason={uploadDisabledReason ?? undefined} />
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h2 className="font-display text-base font-semibold">Add a song from a link</h2>
            <p className="mb-3 mt-1 text-xs text-fg-muted [text-wrap:pretty]">Ume fetches the audio in the background and fills in the title, artist and cover.</p>
            <AddLinkForm workspaceId={workspace.id} playlistId={playlist.id} disabled={!!readOnlyReason} extractionNotice={readOnlyReason ?? extractionNotice} />
          </div>
        </div>
      ) : null}

      <Section title="Tracks" description={inFlight ? 'Some tracks are still being processed; this list refreshes on its own.' : undefined}>
        <TrackTable workspaceId={workspace.id} playlistId={playlist.id} rows={rows} perms={perms} />
      </Section>
    </>
  )
}
