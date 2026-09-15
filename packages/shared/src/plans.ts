import { UPLOAD } from './constants'

/**
 * Storage plans. Prices are per workspace (the server owner pays), monthly.
 * Cloudflare R2 costs ~$0.015/GB-month with zero egress, so storage is nearly free
 * to us; tiers are priced on value ("hours of music") with flat, decreasing $/GB —
 * not an exponential curve, since our marginal cost per GB is flat.
 * Every track is normalized to Opus at UPLOAD.output.bitrateKbps, so bytes map to hours.
 */
export const OPUS_BYTES_PER_HOUR = Math.round(((UPLOAD.output.bitrateKbps * 1000) / 8) * 3600)

const GB = 1024 * 1024 * 1024

export interface Plan {
  id: 'free' | 'plus' | 'pro' | 'studio'
  name: string
  priceUsdMonthly: number
  storageBytes: number
  /** Derived: whole hours of music at the normalized bitrate. */
  hoursOfMusic: number
  maxTracks: number
  stripePriceEnv: string | null
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
    storageBytes: 1 * GB,
    maxTracks: 300,
    stripePriceEnv: null,
    extras: ['Unlimited buckets & members', '24/7 bot', 'Removed after 60 idle days'],
  }),
  make({
    id: 'plus',
    name: 'Plus',
    priceUsdMonthly: 4,
    storageBytes: 10 * GB,
    maxTracks: 3_000,
    stripePriceEnv: 'STRIPE_PRICE_PLUS',
    extras: ['Never auto-removed', 'Priority ingest queue'],
  }),
  make({
    id: 'pro',
    name: 'Pro',
    priceUsdMonthly: 12,
    storageBytes: 50 * GB,
    maxTracks: 15_000,
    stripePriceEnv: 'STRIPE_PRICE_PRO',
    extras: ['Never auto-removed', 'Priority ingest queue'],
  }),
  make({
    id: 'studio',
    name: 'Studio',
    priceUsdMonthly: 35,
    storageBytes: 250 * GB,
    maxTracks: 75_000,
    stripePriceEnv: 'STRIPE_PRICE_STUDIO',
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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`
}
