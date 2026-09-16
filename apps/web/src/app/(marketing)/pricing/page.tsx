import type { Metadata } from 'next'
import Link from 'next/link'
import { INACTIVITY, PLANS, UPLOAD, formatBytes } from '@ume/shared'
import { Container, SectionLead } from '@/components/site/container'
import { PlanGrid } from '@/components/marketing/pricing'
import { FaqSection, type FaqItem } from '@/components/marketing/faq'
import { FinalCta } from '@/components/marketing/cta'
import { inviteUrl, supportInviteUrl } from '@/lib/site/links'

export const metadata: Metadata = {
  title: 'Pricing',
  description: `Flat storage tiers per Discord server. Free ${formatBytes(PLANS[0]!.storageBytes)}, then Plus, Pro and Studio. Unlimited members and playlists on every plan.`,
  alternates: { canonical: '/pricing' },
}

const BILLING_FAQ: FaqItem[] = [
  {
    q: 'Is the plan per server or per account?',
    a: (
      <p>
        Per server. A plan attaches to one workspace, and the workspace Owner pays for it. If you
        run three servers you can keep two on Free and upgrade the busy one.
      </p>
    ),
  },
  {
    q: 'How do upgrades and downgrades work?',
    a: (
      <p>
        Upgrades take effect immediately and Stripe prorates the difference. Downgrades apply at the
        end of the current billing period. You manage everything, including cancelling and updating
        cards, from the Stripe customer portal linked in your workspace Billing settings.
      </p>
    ),
  },
  {
    q: 'What happens if I go over my quota?',
    a: (
      <p>
        Existing music keeps playing. New uploads and songs from links pause until you free up space
        or upgrade. Changing plans never deletes your tracks.
      </p>
    ),
  },
  {
    q: 'Does a paid workspace ever get auto-removed?',
    a: (
      <p>
        No. The {INACTIVITY.purgeAfterDays}-day inactivity purge only applies to Free workspaces. If
        a paid subscription lapses, the workspace downgrades to Free and the idle clock starts from
        that day, with the usual {INACTIVITY.firstNoticeAtDays}-day and{' '}
        {INACTIVITY.finalNoticeHoursBefore}-hour notices.
      </p>
    ),
  },
  {
    q: 'Why hours of music instead of file counts?',
    a: (
      <p>
        Every upload is transcoded to {UPLOAD.output.bitrateKbps} kbps Opus, the codec Discord voice
        already uses, and the original is deleted. Because the bitrate is constant, storage maps
        directly onto listening time, so we quote both.
      </p>
    ),
  },
  {
    q: 'Do you offer refunds?',
    a: (
      <p>
        If something on our side stopped your workspace working for a meaningful part of a billing
        period, contact us and we will refund that period. Otherwise plans are month to month and
        you can cancel any time.
      </p>
    ),
  },
  {
    q: 'Are the prices in USD?',
    a: <p>Yes. Stripe handles currency conversion and any applicable tax at checkout.</p>,
  },
]

export default function PricingPage() {
  const support = supportInviteUrl()
  return (
    <>
      <Container className="pb-8 pt-16 sm:pt-24">
        <div className="max-w-2xl">
          <h1 className="font-display text-5xl font-medium leading-[1.1] sm:text-6xl">
            Choose your storage plan.
          </h1>
          <SectionLead>
            Start with 1 GB free or choose a larger library. Every plan includes the 24/7 bot,
            unlimited members, and unlimited playlists.
          </SectionLead>
        </div>
      </Container>
      <Container className="py-8">
        <PlanGrid />
        <p className="mt-6 text-sm text-fg-subtle [text-wrap:pretty]">
          Hours are calculated at {UPLOAD.output.bitrateKbps} kbps Opus. Uploads up to{' '}
          {formatBytes(UPLOAD.maxOriginalBytes)} and {UPLOAD.maxDurationMs / 60_000} minutes per
          track on every plan. Need more than Studio?{' '}
          {support ? (
            <a
              href={support}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-soft underline underline-offset-4"
            >
              Ask on the support server
            </a>
          ) : (
            <Link href="/dmca" className="text-pink-soft underline underline-offset-4">
              Write to the address on our DMCA page
            </Link>
          )}{' '}
          and we will sort something out.
        </p>
      </Container>
      <FaqSection
        id="billing-faq"
        title="Billing questions."
        lead="How subscriptions, storage limits, and cancellations work."
        items={BILLING_FAQ}
      />
      <FinalCta inviteHref={inviteUrl()} />
    </>
  )
}
