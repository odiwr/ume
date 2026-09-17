import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { can, getFlag } from '@ume/db'
import { CAP } from '@ume/shared'
import { AddLinkForm } from '@/components/app/library/add-link-form'
import { AutoRefresh } from '@/components/app/library/auto-refresh'
import { CoverArt } from '@/components/app/library/cover-art'
import { CoverEditor } from '@/components/app/library/cover-editor'
import { playlistCoverUrl } from '@/components/app/library/cover-url'
import { PlaylistMenu } from '@/components/app/library/playlist-dialogs'
import { TrackTable, type TrackRow } from '@/components/app/library/track-table'
import { Uploader } from '@/components/app/library/uploader'
import { Section } from '@/components/app/page-header'
import { ChevronLeft } from '@/components/ui/icons'
import { db } from '@/lib/db'
import { EXTRACTION_NOTICES, extractionState } from '@/lib/app/links'
import { getPlaylistBySlug, listEntries } from '@/lib/app/queries'
import { requireWorkspacePage } from '@/lib/app/workspace'
import { formatDuration } from '@/lib/utils'

export const metadata: Metadata = { title: 'Playlist', robots: { index: false } }

export default async function PlaylistPage({
  params,
}: {
  params: Promise<{ ws: string; playlist: string }>
}) {
  const { ws: umeId, playlist: slug } = await params
  const { workspace, access, user } = await requireWorkspacePage(umeId, CAP.VIEW_LIBRARY)
  const playlist = await getPlaylistBySlug(workspace.id, slug)
  if (!playlist) notFound()

  const [entries, uploadsEnabled, extraction, coverUrl] = await Promise.all([
    listEntries(workspace.id, playlist.id),
    getFlag(db, 'uploads_enabled'),
    extractionState(workspace),
    playlistCoverUrl(playlist.coverStorageKey),
  ])

  const canAdd = can(access, CAP.ADD_TRACK)
  const canManage = can(access, CAP.MANAGE_PLAYLISTS)
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
  const readOnlyReason =
    workspace.status !== 'connected'
      ? 'This workspace is disconnected and read-only until a new token is entered.'
      : !canAdd
        ? 'Your role cannot add music here.'
        : null
  const uploadDisabledReason =
    readOnlyReason ??
    (!uploadsEnabled
      ? 'Uploads are paused on Ume right now. Adding from a link still works.'
      : null)
  const extractionNotice = extraction === 'allowed' ? null : EXTRACTION_NOTICES[extraction]

  return (
    <>
      <AutoRefresh active={inFlight} />
      <div className="space-y-4">
        <Link
          href={`/app/${umeId}/library`}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg text-sm font-medium text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink"
        >
          <ChevronLeft className="size-4" aria-hidden /> Library
        </Link>
        <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
          <div className="w-full max-w-60 shrink-0 sm:w-48 lg:w-56">
            {canManage ? (
              <CoverEditor
                workspaceId={workspace.id}
                playlistId={playlist.id}
                name={playlist.name}
                src={coverUrl}
              />
            ) : (
              <CoverArt
                name={playlist.name}
                src={coverUrl}
                priority
                className="w-full"
                initialClassName="text-6xl"
              />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3 pb-1">
            <h1 className="font-display text-3xl font-semibold tracking-tight break-words text-fg sm:text-4xl [text-wrap:balance]">
              {playlist.name}
            </h1>
            {playlist.description ? (
              <p className="max-w-2xl text-sm text-fg-muted [text-wrap:pretty]">
                {playlist.description}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fg-muted">
              <span className="tabular-nums">
                {playlist.trackCount.toLocaleString('en-US')}{' '}
                {playlist.trackCount === 1 ? 'track' : 'tracks'} ·{' '}
                {formatDuration(playlist.totalDurationMs)}
              </span>
              <code className="max-w-full truncate rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs text-fg">
                /play {playlist.name}
              </code>
            </div>
          </div>
          {canManage ? (
            <div className="self-start sm:self-end">
              <PlaylistMenu workspaceId={workspace.id} umeId={umeId} playlist={playlist} />
            </div>
          ) : null}
        </header>
      </div>

      {canAdd ? (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Uploader
            workspaceId={workspace.id}
            playlistId={playlist.id}
            disabled={!!uploadDisabledReason}
            disabledReason={uploadDisabledReason ?? undefined}
          />
          <div className="rounded-2xl bg-surface-2 p-5 sm:p-6">
            <h2 className="mb-4 font-display text-base font-semibold">Add a song from a link</h2>
            <AddLinkForm
              workspaceId={workspace.id}
              playlistId={playlist.id}
              disabled={!!readOnlyReason}
              extractionNotice={readOnlyReason ?? extractionNotice}
            />
          </div>
        </div>
      ) : null}

      <Section
        title="Tracks"
        description={inFlight ? 'Some tracks are still processing.' : undefined}
      >
        <TrackTable workspaceId={workspace.id} playlistId={playlist.id} rows={rows} perms={perms} />
      </Section>
    </>
  )
}
