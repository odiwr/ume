import Link from 'next/link'
import { ArrowRight, Check } from '@/components/ui/icons'
import { PLANS, formatBytes, type Plan } from '@ume/shared'
import { Container, Section, SectionLead, SectionTitle } from '@/components/site/container'
import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const RECOMMENDED: Plan['id'] = 'plus'

export function PlanCard({ plan, cta }: { plan: Plan; cta?: { href: string; label: string } }) {
  const recommended = plan.id === RECOMMENDED
  return (
    <div
      className={cn(
        'relative flex flex-col rounded-3xl p-6 sm:p-7',
        recommended ? 'bg-sage-light' : 'bg-surface-2/70',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">{plan.name}</h3>
        {recommended ? <span className="text-xs font-medium text-sage">Recommended</span> : null}
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-1">
        <span className="font-display text-5xl font-medium tracking-tight">
          ${plan.priceUsdMonthly}
        </span>
        <span className="text-sm text-fg-subtle">/ month</span>
      </p>
      <p className="mt-2 text-sm text-fg-muted">
        {formatBytes(plan.storageBytes)} · about {plan.hoursOfMusic.toLocaleString('en-US')} hours
        of music
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
          className={buttonClasses(recommended ? 'primary' : 'secondary', 'md', 'w-full border-0')}
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
    <Section id="pricing" className="bg-surface/40">
      <Container>
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <SectionTitle className="[text-wrap:balance]">
              Start free. Add storage when you need it.
            </SectionTitle>
            <SectionLead className="[text-wrap:pretty]">
              Every plan includes the 24/7 bot, unlimited members, and unlimited playlists. Choose
              how much music to store. Pricing is per server.
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
