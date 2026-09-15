import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'
import { PLANS, formatBytes, type Plan } from '@ume/shared'
import { Container, Eyebrow, Section, SectionLead, SectionTitle } from '@/components/site/container'
import { Badge } from '@/components/ui/badge'
import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const RECOMMENDED: Plan['id'] = 'plus'

export function PlanCard({ plan, cta }: { plan: Plan; cta?: { href: string; label: string } }) {
  const recommended = plan.id === RECOMMENDED
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-2xl border bg-surface p-6',
        recommended ? 'border-pink/50 shadow-[0_0_0_1px_rgb(228_100_176/0.25),0_20px_60px_-24px_rgb(228_100_176/0.45)]' : 'border-border',
      )}
    >
      {recommended ? (
        <Badge tone="pink" className="absolute -top-3 left-6">
          Most servers pick this
        </Badge>
      ) : null}
      <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
      <p className="mt-3 flex items-baseline gap-1">
        <span className="font-display text-4xl font-bold tracking-tight">${plan.priceUsdMonthly}</span>
        <span className="text-sm text-fg-subtle">/ month per server</span>
      </p>
      <p className="mt-2 text-sm text-fg-muted">
        {formatBytes(plan.storageBytes)} · about {plan.hoursOfMusic.toLocaleString('en-US')} hours of music
      </p>
      <ul className="mt-6 flex flex-col gap-2.5 text-sm">
        {plan.highlights.map((h) => (
          <li key={h} className="flex items-start gap-2 text-fg-muted">
            <Check className="mt-0.5 size-4 shrink-0 text-pink" aria-hidden />
            <span>{h}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-6">
        <Link
          href={cta?.href ?? '/login'}
          className={buttonClasses(recommended ? 'primary' : 'outline', 'md', 'w-full')}
        >
          {cta?.label ?? (plan.priceUsdMonthly === 0 ? 'Start free' : `Get ${plan.name}`)}
        </Link>
      </div>
    </div>
  )
}

export function PlanGrid() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {PLANS.map((p) => (
        <PlanCard key={p.id} plan={p} />
      ))}
    </div>
  )
}

export function PricingTeaser() {
  return (
    <Section id="pricing" className="border-t border-border bg-surface/40">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Eyebrow>Pricing</Eyebrow>
            <SectionTitle>Flat tiers. Pay for storage, not for seats.</SectionTitle>
            <SectionLead>
              One plan per server, unlimited members and playlists on every tier. Every upload is normalized to Opus, so a
              gigabyte is always about {PLANS[0]!.hoursOfMusic} hours.
            </SectionLead>
          </div>
          <Link href="/pricing" className={buttonClasses('ghost', 'md', 'self-start md:self-auto')}>
            Billing details
            <ArrowRight className="size-4" />
          </Link>
        </div>
        <div className="mt-12">
          <PlanGrid />
        </div>
      </Container>
    </Section>
  )
}
