import type { Metadata } from 'next'
import Link from 'next/link'
import { INACTIVITY, PLANS, UPLOAD, formatBytes } from '@ume/shared'
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
    'Ume lives in its own voice channel 24/7 and plays the music your members add. Drag in your files, share a playlist, hand out DJ rights, never babysit a queue again.',
  alternates: { canonical: '/' },
}

const FAQ: FaqItem[] = [
  {
    q: 'Do I need to enable the Message Content intent?',
    a: (
      <p>
        No. Every Ume command is a slash command, which needs no privileged intents. The <code>~</code> prefix is an
        alias: it always works in a DM with Ume, and it works inside a server only if you enable the Message Content
        intent for your own bot instance. Most servers never touch it.
      </p>
    ),
  },
  {
    q: 'What happens when I add a YouTube link?',
    a: (
      <p>
        Ume creates a <strong>linked</strong> entry: the title, artist and thumbnail from YouTube, stored alongside your
        uploads so the playlist reads as one list. Ume is not a YouTube converter and does not download or re-host
        YouTube audio on the hosted service.
      </p>
    ),
  },
  {
    q: `What happens after ${INACTIVITY.purgeAfterDays} idle days?`,
    a: (
      <p>
        Free workspaces with no activity for {INACTIVITY.purgeAfterDays} days are removed. Activity means a person in the
        home channel, any command, any playback, or any edit or upload on the web. You get a notice at{' '}
        {INACTIVITY.firstNoticeAtDays} days and a final one {INACTIVITY.finalNoticeHoursBefore} hours before, by email and
        in Discord. Paid workspaces are never auto-removed.
      </p>
    ),
  },
  {
    q: 'How does storage work across servers?',
    a: (
      <p>
        Storage is per server. Each server you claim gets its own workspace with its own quota, starting at{' '}
        {formatBytes(PLANS[0]!.storageBytes)} free. Every upload is transcoded to {UPLOAD.output.bitrateKbps} kbps Opus
        and the original is deleted, so a gigabyte is always about {PLANS[0]!.hoursOfMusic} hours of music no matter what
        you uploaded.
      </p>
    ),
  },
  {
    q: 'How big can an upload be?',
    a: (
      <p>
        Up to {formatBytes(UPLOAD.maxOriginalBytes)} per file and {UPLOAD.maxDurationMs / 60_000} minutes per track.
        Accepted formats: {UPLOAD.acceptedExtensions.map((e) => e.toUpperCase()).join(', ')}.
      </p>
    ),
  },
  {
    q: 'What about copyright and DMCA?',
    a: (
      <p>
        You may only upload music you have the right to share. Rights holders can send a takedown through our{' '}
        <Link href="/dmca">DMCA page</Link>; we disable the track, notify the uploader, and block the file from being
        re-uploaded. Repeat infringers lose their account. The full policy is in the <Link href="/terms">Terms</Link>.
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
        title="Questions people ask before adding a bot."
        lead="Short answers. The long versions live in the Terms and Privacy pages."
        items={FAQ}
      />
      <FinalCta inviteHref={invite} />
    </>
  )
}
