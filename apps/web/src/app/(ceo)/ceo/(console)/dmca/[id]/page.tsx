import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink } from 'lucide-react'
import { formatBytes, linkSiteLabel } from '@ume/shared'
import { getDmcaNotice } from '@/lib/ceo/queries'
import { formatDuration } from '@/lib/utils'
import { PageHeader, KeyValue, Section } from '@/components/ceo/page-header'
import { Mono } from '@/components/ceo/data-table'
import {
  DmcaStatusBadge,
  TrackStatusBadge,
  WorkspaceStatusBadge,
} from '@/components/ceo/status-badge'
import { Absolute } from '@/components/ceo/time'
import { DmcaActions } from '@/components/ceo/dmca-actions'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const d = await getDmcaNotice(id)
  return { title: d ? `Notice from ${d.notice.claimantName}` : 'DMCA notice' }
}

export default async function CeoDmcaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const d = await getDmcaNotice(id)
  if (!d) notFound()
  const { notice, track, workspace } = d

  return (
    <>
      <PageHeader
        back={{ href: '/ceo/dmca', label: 'DMCA' }}
        title={`Notice from ${notice.claimantName}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Mono>{notice.id}</Mono>
            <DmcaStatusBadge status={notice.status} />
            <span>
              received <Absolute date={notice.createdAt} />
            </span>
          </span>
        }
      />

      <Section
        title="Decision"
        description="Every button is audited under ceo.dmca.* and ceo.track.*."
      >
        <DmcaActions notice={notice} track={track} hashBlocked={d.hashBlocked} />
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Section title="Claim">
          <Card>
            <CardContent>
              <KeyValue
                items={[
                  { label: 'Claimant', value: notice.claimantName },
                  {
                    label: 'Email',
                    value: (
                      <a href={`mailto:${notice.claimantEmail}`} className="hover:text-pink-soft">
                        {notice.claimantEmail}
                      </a>
                    ),
                  },
                  { label: 'Address', value: notice.claimantAddress },
                  {
                    label: 'Infringing URL',
                    value: (
                      <a
                        href={notice.infringingUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 break-all hover:text-pink-soft"
                      >
                        {notice.infringingUrl} <ExternalLink className="size-3 shrink-0" />
                      </a>
                    ),
                  },
                  { label: 'Signature', value: notice.signature },
                  {
                    label: 'Statements',
                    value: (
                      <span className="inline-flex flex-wrap gap-1.5">
                        <Badge tone={notice.goodFaithStatement ? 'success' : 'danger'}>
                          good faith {notice.goodFaithStatement ? 'yes' : 'missing'}
                        </Badge>
                        <Badge tone={notice.accuracyStatement ? 'success' : 'danger'}>
                          accuracy {notice.accuracyStatement ? 'yes' : 'missing'}
                        </Badge>
                      </span>
                    ),
                  },
                  {
                    label: 'Submitted from IP',
                    value: notice.ip ? <Mono>{notice.ip}</Mono> : null,
                  },
                  { label: 'Last updated', value: <Absolute date={notice.updatedAt} /> },
                ]}
              />
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
                  Work described
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm [text-wrap:pretty]">
                  {notice.workDescription}
                </p>
              </div>
            </CardContent>
          </Card>
        </Section>

        <Section title="Track">
          <Card>
            <CardContent>
              {track ? (
                <KeyValue
                  items={[
                    { label: 'Title', value: track.title },
                    { label: 'Artist', value: track.artist },
                    { label: 'Status', value: <TrackStatusBadge status={track.status} /> },
                    { label: 'Track id', value: <Mono>{track.id}</Mono> },
                    {
                      label: 'Source',
                      value:
                        track.source === 'link'
                          ? `${linkSiteLabel(track.sourceSite)} link`
                          : 'upload',
                    },
                    {
                      label: 'Source URL',
                      value: track.sourceUrl ? (
                        <a
                          href={track.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 break-all hover:text-pink-soft"
                        >
                          {track.sourceUrl} <ExternalLink className="size-3 shrink-0" />
                        </a>
                      ) : null,
                    },
                    { label: 'Duration', value: formatDuration(track.durationMs) },
                    { label: 'Size', value: formatBytes(track.sizeBytes) },
                    {
                      label: 'SHA-256',
                      value: track.sha256 ? (
                        <span className="inline-flex flex-wrap items-center gap-1.5">
                          <Mono className="break-all">{track.sha256}</Mono>
                          <Badge tone={d.hashBlocked ? 'danger' : 'default'}>
                            {d.hashBlocked ? 'blocked' : 'not blocked'}
                          </Badge>
                        </span>
                      ) : (
                        <span className="text-fg-subtle">
                          none recorded (link extracted before hashing, or still processing)
                        </span>
                      ),
                    },
                    {
                      label: 'Uploaded by',
                      value: track.uploadedByUserId ? (
                        <Link
                          href={`/ceo/users/${track.uploadedByUserId}`}
                          className="hover:text-pink-soft"
                        >
                          <Mono>{track.uploadedByUserId}</Mono>
                        </Link>
                      ) : track.uploadedByDiscordId ? (
                        <Mono>discord:{track.uploadedByDiscordId}</Mono>
                      ) : null,
                    },
                    { label: 'Added', value: <Absolute date={track.createdAt} /> },
                    {
                      label: 'Workspace',
                      value: workspace ? (
                        <span className="inline-flex items-center gap-2">
                          <Link
                            href={`/ceo/workspaces/${workspace.id}`}
                            className="hover:text-pink-soft"
                          >
                            {workspace.guildName}
                          </Link>
                          <WorkspaceStatusBadge status={workspace.status} />
                        </span>
                      ) : null,
                    },
                  ]}
                />
              ) : (
                <div className="text-sm text-fg-muted [text-wrap:pretty]">
                  <p>
                    No track is linked to this notice. Either the URL did not match a track when the
                    notice was filed, or the track was deleted since.
                  </p>
                  {workspace ? (
                    <p className="mt-2">
                      The notice names workspace{' '}
                      <Link
                        href={`/ceo/workspaces/${workspace.id}`}
                        className="text-fg hover:text-pink-soft"
                      >
                        {workspace.guildName}
                      </Link>
                      ; look for the track there.
                    </p>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </Section>
      </div>
    </>
  )
}
