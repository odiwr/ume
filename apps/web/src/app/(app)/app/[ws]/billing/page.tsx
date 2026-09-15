import type { Metadata } from 'next'
import { Check, CreditCard, ExternalLink, Sparkles } from 'lucide-react'
import { effectiveQuotaBytes } from '@ume/db'
import { CAP, PLANS, formatBytes, getPlan, isPaidPlan } from '@ume/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Notice, PageHeader, Section } from '@/components/app/page-header'
import { StorageBar } from '@/components/app/storage-bar'
import { Ago } from '@/components/app/time'
import { isStripeConfigured, priceIdForPlan } from '@/lib/stripe'
import { requireWorkspacePage } from '@/lib/app/workspace'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Billing', robots: { index: false } }

const ERRORS: Record<string, string> = {
  forbidden: 'Only members with the Manage billing permission can change the plan.',
  unconfigured: 'Billing is not set up on this Ume instance yet. Storage plans will open once Stripe is connected.',
  plan: 'That plan cannot be purchased right now.',
  stripe: 'Stripe did not respond. Nothing was charged. Try again in a minute.',
  no_customer: 'This server has no billing account yet. Pick a plan first.',
}

const NOTICES: Record<string, string> = {
  same_plan: 'You are already on that plan.',
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ ws: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { ws: umeId } = await params
  const query = await searchParams
  const { workspace } = await requireWorkspacePage(umeId, CAP.MANAGE_BILLING)

  const current = getPlan(workspace.plan)
  const quota = effectiveQuotaBytes(workspace)
  const stripeReady = isStripeConfigured()
  const checkout = typeof query.checkout === 'string' ? query.checkout : null
  const error = typeof query.error === 'string' ? ERRORS[query.error] : null
  const notice = typeof query.notice === 'string' ? NOTICES[query.notice] : null
  const overQuota = workspace.storageUsedBytes > quota
  const subscriptionStatus = workspace.stripeSubscriptionStatus
  const pastDue = subscriptionStatus === 'past_due' || subscriptionStatus === 'unpaid'

  return (
    <>
      <PageHeader
        title="Billing"
        description="Storage is per server and paid monthly. Changing plans never deletes music: over the limit, uploads pause until you trim or upgrade."
      />

      {checkout === 'success' ? (
        <Notice tone="success" icon={<Check className="size-4" />}>
          Payment received. Your new limit applies as soon as Stripe confirms the subscription, usually within a few seconds. Refresh if this page still shows the old plan.
        </Notice>
      ) : null}
      {checkout === 'cancelled' ? <Notice tone="info">Checkout was cancelled. Nothing was charged.</Notice> : null}
      {error ? <Notice tone="danger">{error}</Notice> : null}
      {notice ? <Notice tone="info">{notice}</Notice> : null}
      {pastDue ? (
        <Notice tone="warning">
          Your last payment failed. Playback keeps working and uploads are paused until the card is updated in the billing portal.
        </Notice>
      ) : null}
      {overQuota ? (
        <Notice tone="warning">
          This server uses {formatBytes(workspace.storageUsedBytes)} of a {formatBytes(quota)} limit. Uploads and link adds are paused; remove tracks or pick a bigger plan.
        </Notice>
      ) : null}

      <Section title="Current plan">
        <div className="grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-[1fr_auto] sm:items-start">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display text-xl font-semibold">{current.name}</span>
              <Badge tone={isPaidPlan(current.id) ? 'pink' : 'default'}>
                {current.priceUsdMonthly === 0 ? 'Free' : `$${current.priceUsdMonthly} / month`}
              </Badge>
              {subscriptionStatus ? <Badge tone={pastDue ? 'warning' : 'success'}>{subscriptionStatus.replace('_', ' ')}</Badge> : null}
              {workspace.storageQuotaOverrideBytes != null ? <Badge tone="sage">Custom limit</Badge> : null}
            </div>
            <StorageBar used={workspace.storageUsedBytes} quota={quota} />
            <p className="text-sm text-fg-muted tabular-nums">
              {workspace.trackCount.toLocaleString('en-US')} of {current.maxTracks.toLocaleString('en-US')} tracks
              {workspace.planRenewsAt ? (
                <>
                  {' · renews '}
                  <Ago date={workspace.planRenewsAt} />
                </>
              ) : null}
            </p>
          </div>
          {workspace.stripeCustomerId && stripeReady ? (
            <form method="post" action="/api/stripe/portal">
              <input type="hidden" name="ws" value={workspace.umeId} />
              <Button type="submit" variant="outline">
                <CreditCard className="size-4" /> Manage billing
              </Button>
            </form>
          ) : null}
        </div>
      </Section>

      <Section
        title="Plans"
        description="Every plan includes the 24/7 bot, unlimited playlists and members, and songs added from links. Paid servers are never removed for inactivity."
      >
        {!stripeReady ? (
          <Notice tone="info" icon={<Sparkles className="size-4" />}>
            Paid plans are not available on this instance yet. You can keep using the free tier.
          </Notice>
        ) : null}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => {
            const isCurrent = plan.id === current.id
            const purchasable = stripeReady && isPaidPlan(plan.id) && !!priceIdForPlan(plan.id)
            const isUpgrade = plan.storageBytes > current.storageBytes
            return (
              <div
                key={plan.id}
                className={cn(
                  'flex flex-col rounded-2xl border bg-surface p-5',
                  isCurrent ? 'border-pink shadow-glow' : 'border-border',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
                  {isCurrent ? <Badge tone="pink">Current</Badge> : null}
                </div>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums">
                  {plan.priceUsdMonthly === 0 ? 'Free' : `$${plan.priceUsdMonthly}`}
                  {plan.priceUsdMonthly > 0 ? <span className="text-sm font-normal text-fg-muted"> / month</span> : null}
                </p>
                <p className="mt-1 text-sm text-fg-muted">
                  {formatBytes(plan.storageBytes)} · about {plan.hoursOfMusic.toLocaleString('en-US')} hours of music
                </p>
                <ul className="mt-4 flex-1 space-y-1.5 text-sm">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-sage" />
                      <span className="[text-wrap:pretty]">{h}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5">
                  {isCurrent ? (
                    <Button variant="secondary" disabled className="w-full">
                      Your plan
                    </Button>
                  ) : plan.priceUsdMonthly === 0 ? (
                    <p className="text-xs text-fg-muted [text-wrap:pretty]">
                      Cancel from the billing portal to return to Free at the end of the period. Music over the free limit stays but uploads pause.
                    </p>
                  ) : purchasable ? (
                    <form method="post" action="/api/stripe/checkout">
                      <input type="hidden" name="ws" value={workspace.umeId} />
                      <input type="hidden" name="plan" value={plan.id} />
                      <Button type="submit" variant={isUpgrade ? 'primary' : 'outline'} className="w-full">
                        {isUpgrade ? 'Upgrade' : 'Switch'} to {plan.name}
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </form>
                  ) : (
                    <Button variant="secondary" disabled className="w-full">
                      Not available yet
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="How billing works">
        <div className="grid gap-3 text-sm text-fg-muted sm:grid-cols-2">
          <p className="[text-wrap:pretty]">
            <strong className="text-fg">Upgrades apply immediately.</strong> Stripe charges the difference for the rest of the month; the new limit lands as soon as the payment confirms.
          </p>
          <p className="[text-wrap:pretty]">
            <strong className="text-fg">Downgrades apply at the end of the period.</strong> If the library is bigger than the new limit, uploads pause until you trim it. Nothing is deleted.
          </p>
          <p className="[text-wrap:pretty]">
            <strong className="text-fg">Failed payments get a grace period.</strong> Playback continues; uploads pause until the card is fixed in the portal.
          </p>
          <p className="[text-wrap:pretty]">
            <strong className="text-fg">Invoices and receipts</strong> live in the billing portal, together with card changes and cancellation.
          </p>
        </div>
      </Section>
    </>
  )
}
