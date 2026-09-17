import type { Metadata } from 'next'
import Link from 'next/link'
import { Link2, ShieldAlert } from '@/components/ui/icons'
import { SUPPORTED_LINK_SITES } from '@ume/shared'
import { db, getAllFlags } from '@/lib/db'
import { setFlagValueAction } from '@/lib/ceo/actions'
import { PageHeader, Section } from '@/components/ceo/page-header'
import { DataTable, Mono, type Column } from '@/components/ceo/data-table'
import { FlagToggle } from '@/components/ceo/flag-controls'
import { ActionForm, ActionSubmit } from '@/components/ceo/action-form'
import { Ago } from '@/components/ceo/time'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input, Label } from '@/components/ui/input'

export const metadata: Metadata = { title: 'Flags' }

type Flag = Awaited<ReturnType<typeof getAllFlags>>[number]

const LABELS: Record<string, string> = {
  link_extract: 'Link extractor',
  uploads_enabled: 'File uploads',
  signups_open: 'New sign-ups',
  auto_purge_enabled: 'Inactivity auto-purge',
  maintenance_banner: 'Maintenance banner',
}

const OFF_WARNINGS: Record<string, string> = {
  link_extract:
    'Turn the link extractor OFF for every workspace? New links become metadata-only entries and queued extract-link jobs are skipped. Existing extracted tracks keep playing.',
  uploads_enabled:
    'Block file uploads for every workspace? In-flight transcodes finish; new uploads are refused.',
  signups_open:
    'Close sign-ups? Existing users can still log in; new accounts are refused at the OAuth callback.',
  auto_purge_enabled:
    'Pause the inactivity sweep? No notices go out and nothing is purged until it is back on.',
}

export default async function CeoFlagsPage() {
  const flags = await getAllFlags(db)
  const linkExtract = flags.find((f) => f.key === 'link_extract')
  const banner = flags.find((f) => f.key === 'maintenance_banner')
  const bannerMessage = typeof banner?.value.message === 'string' ? banner.value.message : ''

  const columns: Column<Flag>[] = [
    {
      key: 'flag',
      header: 'Flag',
      render: (f) => (
        <div className="min-w-0">
          <p className="font-medium">{LABELS[f.key] ?? f.key}</p>
          <div className="mt-0.5">
            <Mono>{f.key}</Mono>
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'What it gates',
      className: 'max-w-md whitespace-normal',
      render: (f) => (
        <span className="text-xs text-fg-muted [text-wrap:pretty]">
          {f.key === 'link_extract' ? 'See the card above.' : f.description}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Changed',
      render: (f) => <Ago date={f.updatedAt} fallback="default" />,
    },
    {
      key: 'state',
      header: 'State',
      align: 'right',
      render: (f) => (
        <FlagToggle
          flagKey={f.key}
          enabled={f.enabled}
          label={LABELS[f.key] ?? f.key}
          confirmOff={OFF_WARNINGS[f.key]}
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Flags" />

      {linkExtract ? (
        <Card className={linkExtract.enabled ? 'bg-blush' : 'bg-warning/10'}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="size-4 text-pink" /> Link extractor
                  <Badge tone={linkExtract.enabled ? 'success' : 'warning'}>
                    {linkExtract.enabled ? 'on' : 'off'}
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1 max-w-3xl [text-wrap:pretty]">
                  “Add a song from a link” downloads the audio from {SUPPORTED_LINK_SITES.length}{' '}
                  supported sites and stores it as Opus. It is ON by the founder’s decision of 15
                  September 2026, recorded in docs/PLAN_REVIEW.md. This switch is the global
                  override; each workspace also has its own toggle.
                </CardDescription>
              </div>
              <FlagToggle
                flagKey="link_extract"
                enabled={linkExtract.enabled}
                label="Link extractor"
                confirmOff={OFF_WARNINGS.link_extract}
              />
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
            <div className="rounded-xl bg-warning/10 p-4">
              <p className="flex items-center gap-1.5 font-semibold text-warning">
                <ShieldAlert className="size-4" /> The risk
              </p>
              <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">
                Extracting audio from YouTube breaks YouTube’s Terms of Service. Groovy and Rythm
                were shut down by cease-and-desist in 2021 for exactly this. yt-dlp is also blocked
                from datacenter IPs, so the extractor worker should run on a residential connection
                (WORKER_QUEUES=extract-link).
              </p>
            </div>
            <div className="rounded-xl bg-surface p-4">
              <p className="font-semibold">The guardrails</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-fg-muted">
                <li>Owners accept a rights attestation before the first extraction.</li>
                <li>Every extracted file is hashed; a DMCA takedown blocks the hash everywhere.</li>
                <li>Marketing says “add a song from a link”, never “converter”.</li>
                <li>
                  Takedowns are handled at{' '}
                  <Link href="/ceo/dmca" className="underline underline-offset-2 hover:text-fg">
                    DMCA
                  </Link>
                  .
                </li>
              </ul>
            </div>
            <div className="rounded-xl bg-surface p-4">
              <p className="font-semibold">What OFF does</p>
              <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">
                Links can still be added, but they become metadata-only entries: title, artist and
                source URL are kept, no audio is fetched, and the bot cannot play them. Jobs already
                queued are skipped. Tracks extracted while it was on keep playing. Turning it back
                on resumes extraction for new links only.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Section title="All flags">
        <DataTable columns={columns} rows={flags} rowKey={(f) => f.key} />
      </Section>

      <Section title="Maintenance banner">
        <Card>
          <CardContent>
            <ActionForm
              action={setFlagValueAction}
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
            >
              <input type="hidden" name="key" value="maintenance_banner" />
              <div className="flex-1">
                <Label htmlFor="banner-message">Message</Label>
                <Input
                  id="banner-message"
                  name="message"
                  defaultValue={bannerMessage}
                  maxLength={500}
                  placeholder="e.g. Uploads are paused for 30 minutes while we move storage. Playback is unaffected."
                />
              </div>
              <ActionSubmit variant="secondary">Save message</ActionSubmit>
            </ActionForm>
            <p className="mt-2 text-xs text-fg-subtle">
              {banner?.enabled
                ? 'The banner is live.'
                : 'The banner is hidden until you switch maintenance_banner on above.'}
              {bannerMessage ? '' : ' No message is set; an empty banner shows nothing.'}
            </p>
          </CardContent>
        </Card>
      </Section>
    </>
  )
}
