import type { Metadata } from 'next'
import Link from 'next/link'
import { INACTIVITY, PLANS, SUPPORTED_LINK_SITES, UPLOAD, formatBytes } from '@ume/shared'
import { Hero } from '@/components/marketing/hero'
import { Features } from '@/components/marketing/features'
import { HowItWorks } from '@/components/marketing/how-it-works'
import { CommandsTeaser } from '@/components/marketing/commands-teaser'
import { PricingTeaser } from '@/components/marketing/pricing'
import { FaqSection, type FaqItem } from '@/components/marketing/faq'
import { FinalCta } from '@/components/marketing/cta'
import { inviteUrl } from '@/lib/site/links'

export const metadata: Metadata = {
  title: { absolute: 'Ume — a radio station for your Discord server' },
  description:
    'Ume lives in its own voice channel 24/7 and plays the music your members add. Drag in your files, paste a link, share a playlist, hand out DJ rights, never babysit a queue again.',
  alternates: { canonical: '/' },
}

const FAQ: FaqItem[] = [
  {
    q: 'Do I need to enable the Message Content intent?',
    a: (
      <p>
        No. Every Ume command is a slash command, which needs no privileged intents. The{' '}
        <code>~</code> prefix is an alias: it always works in a DM with Ume, and it works inside a
        server only if you enable the Message Content intent for your own bot instance. Most servers
        never touch it.
      </p>
    ),
  },
  {
    q: 'What happens when I add a song from a link?',
    a: (
      <p>
        Ume fetches the audio from the link ({SUPPORTED_LINK_SITES.map((s) => s.label).join(', ')}),
        transcodes it to {UPLOAD.output.bitrateKbps} kbps Opus like an upload, fills in the title,
        artist and cover, and files it in the playlist you named with your name on it. One link is
        one track: albums, sets and playlists are rejected. The source link is kept so the track can
        be traced back. Adding from a link is on by default; the workspace Owner can switch it off
        in Settings.
      </p>
    ),
  },
  {
    q: 'Can I add anything I find online?',
    a: (
      <p>
        No. Whoever uploads a file or adds a link confirms they hold the rights for that audio to be
        stored by Ume and played in their server, and the workspace Owner accepts the same
        attestation for the server when claiming it. Ume is a library for music your community is
        allowed to play, not a way around buying it. Rights holders can have a track disabled
        through the <Link href="/dmca">DMCA page</Link>.
      </p>
    ),
  },
  {
    q: `What happens after ${INACTIVITY.purgeAfterDays} idle days?`,
    a: (
      <p>
        Free workspaces with no activity for {INACTIVITY.purgeAfterDays} days are removed. Activity
        means a person in the home channel, any command, any playback, or any edit or upload on the
        web. You get a notice at {INACTIVITY.firstNoticeAtDays} days and a final one{' '}
        {INACTIVITY.finalNoticeHoursBefore} hours before, by email and in Discord. Paid workspaces
        are never auto-removed.
      </p>
    ),
  },
  {
    q: 'How does storage work across servers?',
    a: (
      <p>
        Storage is per server. Each server you claim gets its own workspace with its own quota,
        starting at {formatBytes(PLANS[0]!.storageBytes)} free. Every upload is transcoded to{' '}
        {UPLOAD.output.bitrateKbps} kbps Opus and the original is deleted, so a gigabyte is always
        about {PLANS[0]!.hoursOfMusic} hours of music no matter what you uploaded.
      </p>
    ),
  },
  {
    q: 'How big can an upload be?',
    a: (
      <p>
        Up to {formatBytes(UPLOAD.maxOriginalBytes)} per file and {UPLOAD.maxDurationMs / 60_000}{' '}
        minutes per track. Accepted formats:{' '}
        {UPLOAD.acceptedExtensions.map((e) => e.toUpperCase()).join(', ')}.
      </p>
    ),
  },
  {
    q: 'What about copyright and DMCA?',
    a: (
      <p>
        Rights holders can send a takedown through our <Link href="/dmca">DMCA page</Link>; we
        disable the track, notify the member who added it and the Owner, and block the file&apos;s
        hash from being added anywhere on Ume again. Three un-countered strikes in twelve months and
        the account is closed. The full policy is in the <Link href="/terms#copyright">Terms</Link>.
      </p>
    ),
  },
]

export default function LandingPage() {
  const invite = inviteUrl()
  return (
    <>
      <Hero inviteHref={invite} />
      <Features />
      <HowItWorks />
      <CommandsTeaser />
      <PricingTeaser />
      <FaqSection
        title="Frequently asked questions."
        lead="Setup, storage, and adding music."
        items={FAQ}
      />
      <FinalCta inviteHref={invite} />
    </>
  )
}
