import type { Metadata } from 'next'
import Link from 'next/link'
import { CreditCard, DollarSign, ExternalLink, TriangleAlert, Users } from 'lucide-react'
import { PLANS } from '@ume/shared'
import { getRevenueReport } from '@/lib/ceo/queries'
import { PageHeader, Section } from '@/components/ceo/page-header'
import { StatGrid, StatTile } from '@/components/ceo/stat-tile'
import { DataTable, Mono, type Column } from '@/components/ceo/data-table'
import { MrrByPlanChart } from '@/components/ceo/charts'
import { PlanBadge, SubscriptionBadge, WorkspaceStatusBadge } from '@/components/ceo/status-badge'
import { Absolute, Ago } from '@/components/ceo/time'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const metadata: Metadata = { title: 'Revenue' }

type Row = Awaited<ReturnType<typeof getRevenueReport>>['rows'][number]

const n = (v: number) => v.toLocaleString('en-US')
const stripeConfigured = () => !!process.env.STRIPE_SECRET_KEY

function StripeLink({ kind, id }: { kind: 'customers' | 'subscriptions'; id: string }) {
  return (
    <a
      href={`https://dashboard.stripe.com/${kind}/${id}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 hover:text-pink-soft"
      title={`Open ${kind === 'customers' ? 'customer' : 'subscription'} in Stripe`}
    >
      <Mono>{id}</Mono> <ExternalLink className="size-3 shrink-0" />
    </a>
  )
}

export default async function CeoRevenuePage() {
  const r = await getRevenueReport()
  const active = r.rows.filter(
    (x) =>
      x.ws.stripeSubscriptionStatus === 'active' || x.ws.stripeSubscriptionStatus === 'trialing',
  )
  const pastDue = r.rows.filter(
    (x) =>
      x.ws.stripeSubscriptionStatus === 'past_due' || x.ws.stripeSubscriptionStatus === 'unpaid',
  )
  const compedPaid = r.rows.filter((x) => x.ws.plan !== 'free' && !x.ws.stripeSubscriptionId)
  const priceEnvMissing = PLANS.filter((p) => p.stripePriceEnv && !process.env[p.stripePriceEnv])

  const columns: Column<Row>[] = [
    {
      key: 'ws',
      header: 'Workspace',
      render: (x) => (
        <div className="min-w-0">
          <Link href={`/ceo/workspaces/${x.ws.id}`} className="font-medium hover:text-pink-soft">
            {x.ws.guildName}
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
            <Mono>{x.ws.umeId}</Mono>
            <WorkspaceStatusBadge status={x.ws.status} />
          </div>
        </div>
      ),
    },
    { key: 'plan', header: 'Plan', render: (x) => <PlanBadge plan={x.ws.plan} /> },
    {
      key: 'sub',
      header: 'Subscription',
      render: (x) => <SubscriptionBadge status={x.ws.stripeSubscriptionStatus} />,
    },
    {
      key: 'renews',
      header: 'Renews',
      render: (x) =>
        x.ws.planRenewsAt ? (
          <Ago date={x.ws.planRenewsAt} />
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (x) =>
        x.ws.ownerUserId ? (
          <Link href={`/ceo/users/${x.ws.ownerUserId}`} className="text-fg-muted hover:text-fg">
            {x.ownerEmail ?? x.ws.ownerUserId}
          </Link>
        ) : (
          <span className="text-fg-subtle">unclaimed</span>
        ),
    },
    {
      key: 'customer',
      header: 'Stripe customer',
      render: (x) =>
        x.ws.stripeCustomerId ? (
          <StripeLink kind="customers" id={x.ws.stripeCustomerId} />
        ) : (
          <span className="text-fg-subtle">none</span>
        ),
    },
    {
      key: 'subscription',
      header: 'Stripe subscription',
      render: (x) =>
        x.ws.stripeSubscriptionId ? (
          <StripeLink kind="subscriptions" id={x.ws.stripeSubscriptionId} />
        ) : (
          <span className="text-fg-subtle">{x.ws.plan !== 'free' ? 'admin override' : 'none'}</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Revenue"
        description="MRR is list price × workspaces whose Stripe subscription is active or trialing. Discounts, taxes and refunds live in Stripe; this page never calls the Stripe API."
      />

      <StatGrid>
        <StatTile
          label="MRR"
          value={`$${n(r.mrrUsd)}`}
          detail={`${n(active.length)} active or trialing`}
          icon={<DollarSign className="size-4" />}
          tone="success"
        />
        <StatTile
          label="Paid workspaces"
          value={n(active.length)}
          detail={r.mrrByPlan.map((p) => `${p.name} ${n(p.active)}`).join(' · ')}
          icon={<Users className="size-4" />}
        />
        <StatTile
          label="Past due"
          value={n(pastDue.length)}
          detail={
            pastDue.length
              ? 'Stripe is retrying; the plan stays until the subscription is canceled'
              : 'No failed payments right now'
          }
          icon={<TriangleAlert className="size-4" />}
          tone={pastDue.length > 0 ? 'warning' : 'default'}
        />
        <StatTile
          label="Comped"
          value={n(compedPaid.length)}
          detail={
            compedPaid.length
              ? 'Paid plan set by admin override, no subscription'
              : 'Every paid plan is backed by a subscription'
          }
          icon={<CreditCard className="size-4" />}
        />
      </StatGrid>

      {!stripeConfigured() || priceEnvMissing.length ? (
        <Card className="border-warning/40">
          <CardHeader>
            <CardTitle className="text-warning">Stripe is not fully configured</CardTitle>
            <CardDescription>
              {!stripeConfigured()
                ? 'STRIPE_SECRET_KEY is not set, so Checkout and the Customer Portal are disabled in the app. '
                : ''}
              {priceEnvMissing.length
                ? `Missing price ids: ${priceEnvMissing.map((p) => p.stripePriceEnv).join(', ')}. Those plans cannot be bought until the env vars are set.`
                : ''}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle>MRR by plan</CardTitle>
            <CardDescription>Active and trialing subscriptions at list price.</CardDescription>
          </CardHeader>
          <CardContent>
            <MrrByPlanChart data={r.mrrByPlan} />
          </CardContent>
        </Card>
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Price list</CardTitle>
            <CardDescription>
              From @ume/shared PLANS. Change prices in code and in Stripe together.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {PLANS.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between py-2 first:pt-0 last:pb-0"
                >
                  <span className="inline-flex items-center gap-2">
                    <PlanBadge plan={p.id} />
                    <span className="text-fg-muted">{p.highlights[0]}</span>
                  </span>
                  <span className="tabular-nums">
                    {p.priceUsdMonthly ? `$${p.priceUsdMonthly}/mo` : 'free'}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Section
        title={`Billing records (${n(r.rows.length)})`}
        description="Every workspace on a paid plan or with a Stripe customer, newest renewal first. Capped at 200."
      >
        <DataTable
          columns={columns}
          rows={r.rows}
          rowKey={(x) => x.ws.id}
          empty="Nobody has paid yet. Plans are bought from Settings in the app."
        />
      </Section>

      {r.rows.length ? (
        <p className="text-xs text-fg-subtle">
          Most recent renewal on record:{' '}
          <Absolute date={r.rows.find((x) => x.ws.planRenewsAt)?.ws.planRenewsAt} fallback="none" />
          .
        </p>
      ) : null}
    </>
  )
}
