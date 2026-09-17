import { test } from 'node:test'
import assert from 'node:assert/strict'
import { UPLOAD } from './constants'
import { OPUS_BYTES_PER_HOUR, PLANS, formatBytes, getPlan, isPaidPlan } from './plans'

const GB = 1024 ** 3

test('four plans in ascending order', () => {
  assert.deepEqual(
    PLANS.map((p) => p.id),
    ['free', 'plus', 'pro', 'studio'],
  )
  assert.deepEqual(
    PLANS.map((p) => p.name),
    ['Free', 'Plus', 'Pro', 'Studio'],
  )
})

test('prices and storage match PLAN_REVIEW.md (Free 1 GB, Plus $4/10 GB, Pro $12/50 GB, Studio $35/250 GB)', () => {
  const expected: Record<string, [price: number, gb: number]> = {
    free: [0, 1],
    plus: [4, 10],
    pro: [12, 50],
    studio: [35, 250],
  }
  for (const p of PLANS) {
    const [price, gb] = expected[p.id]!
    assert.equal(p.priceUsdMonthly, price, p.id)
    assert.equal(p.storageBytes, gb * GB, p.id)
  }
})

test('quotas, prices and track limits strictly increase; $/GB strictly decreases', () => {
  for (let i = 1; i < PLANS.length; i++) {
    const lower = PLANS[i - 1]!
    const higher = PLANS[i]!
    assert.ok(higher.storageBytes > lower.storageBytes, higher.id)
    assert.ok(higher.priceUsdMonthly > lower.priceUsdMonthly, higher.id)
    assert.ok(higher.maxTracks > lower.maxTracks, higher.id)
    assert.ok(higher.hoursOfMusic > lower.hoursOfMusic, higher.id)
  }
  const paid = PLANS.filter((p) => p.priceUsdMonthly > 0)
  const perGb = (p: (typeof paid)[number]) => p.priceUsdMonthly / (p.storageBytes / GB)
  for (let i = 1; i < paid.length; i++)
    assert.ok(perGb(paid[i]!) < perGb(paid[i - 1]!), paid[i]!.id)
})

test('free plan is 1 GB, unpaid and has no Stripe price; paid plans name their env var', () => {
  const free = PLANS[0]!
  assert.equal(free.id, 'free')
  assert.equal(free.storageBytes, 1 * GB)
  assert.equal(free.priceUsdMonthly, 0)
  assert.equal(free.stripePriceEnv, null)
  assert.equal(isPaidPlan('free'), false)
  for (const p of PLANS.slice(1)) {
    assert.equal(p.stripePriceEnv, `STRIPE_PRICE_${p.id.toUpperCase()}`)
    assert.equal(isPaidPlan(p.id), true)
  }
})

test('hours of music derive from the normalised Opus bitrate', () => {
  assert.equal(OPUS_BYTES_PER_HOUR, ((UPLOAD.output.bitrateKbps * 1000) / 8) * 3600)
  for (const p of PLANS) {
    assert.equal(p.hoursOfMusic, Math.floor(p.storageBytes / OPUS_BYTES_PER_HOUR), p.id)
    assert.ok(p.highlights[0]!.startsWith(`${Math.round(p.storageBytes / GB)} GB`), p.id)
    assert.ok(p.highlights.length >= 3, p.id)
  }
})

test('getPlan round-trips every id and falls back to free for unknown or missing ids', () => {
  for (const p of PLANS) assert.equal(getPlan(p.id), p)
  assert.equal(getPlan('enterprise'), PLANS[0])
  assert.equal(getPlan(null), PLANS[0])
  assert.equal(getPlan(undefined), PLANS[0])
  assert.equal(isPaidPlan(null), false)
  assert.equal(isPaidPlan('nope'), false)
})

test('formatBytes picks the unit and trims trailing zeros', () => {
  assert.equal(formatBytes(0), '0 B')
  assert.equal(formatBytes(1023), '1023 B')
  assert.equal(formatBytes(1024), '1 KB')
  assert.equal(formatBytes(1536), '1.5 KB')
  assert.equal(formatBytes(100 * 1024), '100 KB')
  assert.equal(formatBytes(1.25 * 1024 * 1024), '1.25 MB')
  assert.equal(formatBytes(GB), '1 GB')
  assert.equal(formatBytes(250 * GB), '250 GB')
  assert.equal(formatBytes(1024 ** 4), '1 TB')
  assert.equal(formatBytes(1024 ** 5), '1024 TB')
})
