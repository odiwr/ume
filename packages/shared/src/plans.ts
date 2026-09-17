import { UPLOAD } from './constants'

/**
 * Storage plans. Prices are per workspace (the server owner pays), monthly or yearly.
 * Prices come from docs/COSTS.md (September 2026): each paid tier covers its marginal
 * cost (storage, voice egress, transcodes), Stripe fees and a reserve. Plus is $5 because
 * Stripe's 30-cent fixed fee is over 10% of a charge below about $4.70. Yearly prices are
 * ten months for twelve, which also cuts the share lost to fixed fees.
 * Cloudflare R2 costs ~$0.015/GB-month with zero egress, so storage is nearly free
 * to us; tiers are priced on value ("hours of music") with flat, decreasing $/GB —
 * not an exponential curve, since our marginal cost per GB is flat.
 * Every track is normalized to Opus at UPLOAD.output.bitrateKbps, so bytes map to hours.
 */
export const OPUS_BYTES_PER_HOUR = Math.round(((UPLOAD.output.bitrateKbps * 1000) / 8) * 3600)

const GB = 1024 * 1024 * 1024

export type BillingInterval = 'month' | 'year'
export const BILLING_INTERVALS: readonly BillingInterval[] = ['month', 'year'] as const

export interface Plan {
  id: 'free' | 'plus' | 'pro' | 'studio'
  name: string
  priceUsdMonthly: number
  /** Billed once a year. 0 for Free. */
  priceUsdYearly: number
  storageBytes: number
  /** Derived: whole hours of music at the normalized bitrate. */
  hoursOfMusic: number
  maxTracks: number
  /** Env var holding the monthly Stripe price id. */
  stripePriceEnv: string | null
  /** Env var holding the yearly Stripe price id. */
  stripePriceEnvYearly: string | null
  highlights: string[]
}

function hours(bytes: number): number {
  return Math.floor(bytes / OPUS_BYTES_PER_HOUR)
}

function make(p: Omit<Plan, 'hoursOfMusic' | 'highlights'> & { extras?: string[] }): Plan {
  const h = hours(p.storageBytes)
  const gb = Math.round(p.storageBytes / GB)
  return {
    ...p,
    hoursOfMusic: h,
    highlights: [
      `${gb} GB of music (~${h.toLocaleString('en-US')} hours)`,
      `${p.maxTracks.toLocaleString('en-US')} tracks`,
      ...(p.extras ?? []),
    ],
  }
}

export const PLANS: readonly Plan[] = [
  make({
    id: 'free',
    name: 'Free',
    priceUsdMonthly: 0,
    priceUsdYearly: 0,
    storageBytes: 1 * GB,
    maxTracks: 300,
    stripePriceEnv: null,
    stripePriceEnvYearly: null,
    extras: ['Unlimited playlists & members', '24/7 bot', 'Removed after 60 idle days'],
  }),
  make({
    id: 'plus',
    name: 'Plus',
    priceUsdMonthly: 5,
    priceUsdYearly: 50,
    storageBytes: 10 * GB,
    maxTracks: 3_000,
    stripePriceEnv: 'STRIPE_PRICE_PLUS',
    stripePriceEnvYearly: 'STRIPE_PRICE_PLUS_YEARLY',
    extras: ['Never auto-removed', 'Priority ingest queue'],
  }),
  make({
    id: 'pro',
    name: 'Pro',
    priceUsdMonthly: 12,
    priceUsdYearly: 120,
    storageBytes: 50 * GB,
    maxTracks: 15_000,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    stripePriceEnvYearly: 'STRIPE_PRICE_PRO_YEARLY',
    extras: ['Never auto-removed', 'Priority ingest queue'],
  }),
  make({
    id: 'studio',
    name: 'Studio',
    priceUsdMonthly: 35,
    priceUsdYearly: 350,
    storageBytes: 250 * GB,
    maxTracks: 75_000,
    stripePriceEnv: 'STRIPE_PRICE_STUDIO',
    stripePriceEnvYearly: 'STRIPE_PRICE_STUDIO_YEARLY',
    extras: ['Never auto-removed', 'Priority ingest queue', 'Early features'],
  }),
] as const

export type PlanId = Plan['id']

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0]!
}

export function isPaidPlan(id: string | null | undefined): boolean {
  return getPlan(id).priceUsdMonthly > 0
}

export function planPrice(plan: Plan, interval: BillingInterval): number {
  return interval === 'year' ? plan.priceUsdYearly : plan.priceUsdMonthly
}

export function planPriceEnv(plan: Plan, interval: BillingInterval): string | null {
  return interval === 'year' ? plan.stripePriceEnvYearly : plan.stripePriceEnv
}

/** Months saved by paying yearly, rounded (2 for ten-months-for-twelve pricing). */
export function yearlyMonthsFree(plan: Plan): number {
  if (!plan.priceUsdMonthly) return 0
  return Math.round(12 - plan.priceUsdYearly / plan.priceUsdMonthly)
}

/** Monthly-equivalent revenue for MRR: a yearly subscription counts as a twelfth. */
export function monthlyEquivalentUsd(plan: Plan, interval: BillingInterval): number {
  return interval === 'year' ? plan.priceUsdYearly / 12 : plan.priceUsdMonthly
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  const fixed = v
    .toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)
    .replace(/\.0+$/, '')
    .replace(/(\.\d*[1-9])0+$/, '$1')
  return `${fixed} ${units[i]}`
}
