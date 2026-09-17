import 'server-only'
import Stripe from 'stripe'
import { type Workspace } from '@ume/db'
import { PLANS, getPlan, planPriceEnv, type BillingInterval, type PlanId } from '@ume/shared'

/**
 * Stripe helpers for storage plans. One subscription per workspace; the workspace
 * row is the source of truth for plan/customer/subscription ids and is updated by
 * the webhook (never by the redirect back from Checkout).
 */
let cached: Stripe | null = null

export function getStripe(): Stripe {
  if (cached) return cached
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
  cached = new Stripe(key)
  return cached
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export function priceIdForPlan(planId: PlanId, interval: BillingInterval = 'month'): string | null {
  const env = planPriceEnv(getPlan(planId), interval)
  if (!env) return null
  return process.env[env] || null
}

/** price id -> plan id and interval, built from the monthly and yearly STRIPE_PRICE_* env vars. */
export function planFromPriceId(
  priceId: string | null | undefined,
): { planId: PlanId; interval: BillingInterval } | null {
  if (!priceId) return null
  for (const plan of PLANS) {
    if (plan.stripePriceEnv && process.env[plan.stripePriceEnv] === priceId) {
      return { planId: plan.id, interval: 'month' }
    }
    if (plan.stripePriceEnvYearly && process.env[plan.stripePriceEnvYearly] === priceId) {
      return { planId: plan.id, interval: 'year' }
    }
  }
  return null
}

export type BillableWorkspace = Pick<
  Workspace,
  | 'id'
  | 'umeId'
  | 'guildName'
  | 'stripeCustomerId'
  | 'stripeSubscriptionId'
  | 'stripeSubscriptionStatus'
>

/** Reuse the workspace's Stripe customer or create one and remember it. */
async function ensureCustomer(
  ws: BillableWorkspace,
  email: string | null | undefined,
): Promise<string> {
  if (ws.stripeCustomerId) return ws.stripeCustomerId
  const stripe = getStripe()
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: ws.guildName,
    metadata: { workspaceId: ws.id, umeId: ws.umeId },
  })
  return customer.id
}

export async function createCheckoutSession(input: {
  workspace: BillableWorkspace
  planId: PlanId
  interval: BillingInterval
  customerEmail: string | null | undefined
  successUrl: string
  cancelUrl: string
}): Promise<{ url: string; customerId: string }> {
  const stripe = getStripe()
  const price = priceIdForPlan(input.planId, input.interval)
  if (!price) {
    throw new Error(`No Stripe price configured for plan "${input.planId}" (${input.interval}).`)
  }
  const customerId = await ensureCustomer(input.workspace, input.customerEmail)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: input.workspace.id,
    metadata: { workspaceId: input.workspace.id, planId: input.planId, interval: input.interval },
    subscription_data: {
      metadata: { workspaceId: input.workspace.id, planId: input.planId, interval: input.interval },
    },
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
  })
  if (!session.url) throw new Error('Stripe did not return a Checkout URL.')
  return { url: session.url, customerId }
}

/** Customer Portal; when `switchToPlanId` is given, deep-link into the plan change flow. */
export async function createPortalSession(input: {
  workspace: BillableWorkspace
  returnUrl: string
  switchToPlanId?: PlanId
  switchToInterval?: BillingInterval
}): Promise<{ url: string }> {
  const stripe = getStripe()
  if (!input.workspace.stripeCustomerId)
    throw new Error('This workspace has no billing account yet.')
  const params: Stripe.BillingPortal.SessionCreateParams = {
    customer: input.workspace.stripeCustomerId,
    return_url: input.returnUrl,
  }
  if (input.switchToPlanId && input.workspace.stripeSubscriptionId) {
    const price = priceIdForPlan(input.switchToPlanId, input.switchToInterval ?? 'month')
    if (price) {
      const sub = await stripe.subscriptions.retrieve(input.workspace.stripeSubscriptionId)
      const item = sub.items.data[0]
      if (item) {
        params.flow_data = {
          type: 'subscription_update_confirm',
          subscription_update_confirm: {
            subscription: sub.id,
            items: [{ id: item.id, price, quantity: 1 }],
          },
          after_completion: { type: 'redirect', redirect: { return_url: input.returnUrl } },
        }
      }
    }
  }
  const session = await stripe.billingPortal.sessions.create(params)
  return { url: session.url }
}

/** In current Stripe API versions the period lives on the subscription items. */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): Date | null {
  const item = sub.items.data[0]
  if (!item || typeof item.current_period_end !== 'number') return null
  return new Date(item.current_period_end * 1000)
}

export function subscriptionPriceId(sub: Stripe.Subscription): string | null {
  const item = sub.items.data[0]
  return item?.price?.id ?? null
}

/** Statuses that keep a paid plan active. */
export function subscriptionGrantsPlan(status: Stripe.Subscription.Status): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due'
}
