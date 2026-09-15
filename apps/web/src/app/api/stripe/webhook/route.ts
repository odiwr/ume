import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { eq, or } from 'drizzle-orm'
import { logAudit, stripeEvents, workspaces, type Workspace } from '@ume/db'
import { db } from '@/lib/db'
import { getStripe, planFromPriceId, subscriptionGrantsPlan, subscriptionPeriodEnd, subscriptionPriceId } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

/**
 * Stripe webhook. Rules:
 *  - verify the signature against the raw body,
 *  - process each event id once (stripe_events insert-first idempotency),
 *  - never trust the event payload for subscription state: retrieve the subscription fresh,
 *  - downgrade to Free when a subscription ends or goes unpaid; never delete a workspace's data.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET is not configured.' }, { status: 500 })
  const signature = req.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature.' }, { status: 400 })

  const payload = await req.text()
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, secret)
  } catch (err) {
    console.error('[stripe/webhook] bad signature', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  const claimed = await db.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning({ id: stripeEvents.id })
  if (!claimed.length) return NextResponse.json({ received: true, duplicate: true })

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
        if (session.mode === 'subscription' && subId) await syncSubscription(subId, session.metadata?.workspaceId ?? null)
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed': {
        const sub = event.data.object
        await syncSubscription(sub.id, sub.metadata?.workspaceId ?? null)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object
        await endSubscription(sub, sub.metadata?.workspaceId ?? null)
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subRef = invoice.parent?.subscription_details?.subscription
        const subId = typeof subRef === 'string' ? subRef : subRef?.id
        if (subId) await syncSubscription(subId, null)
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[stripe/webhook] handler failed', event.type, err)
    // Let Stripe retry: release the idempotency claim first.
    await db.delete(stripeEvents).where(eq(stripeEvents.id, event.id)).catch(() => undefined)
    return NextResponse.json({ error: 'Handler failed.' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}

async function findWorkspace(sub: Stripe.Subscription, hintedWorkspaceId: string | null): Promise<Workspace | undefined> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const conds = [eq(workspaces.stripeSubscriptionId, sub.id), eq(workspaces.stripeCustomerId, customerId)]
  if (hintedWorkspaceId) conds.push(eq(workspaces.id, hintedWorkspaceId))
  const rows = await db.query.workspaces.findMany({ where: or(...conds) })
  // Prefer the row that already references this subscription, then the customer match.
  return rows.find((w) => w.stripeSubscriptionId === sub.id) ?? rows.find((w) => w.stripeCustomerId === customerId) ?? rows[0]
}

/** Pull the subscription fresh from Stripe and mirror it onto the workspace. */
async function syncSubscription(subscriptionId: string, hintedWorkspaceId: string | null): Promise<void> {
  const sub = await getStripe().subscriptions.retrieve(subscriptionId)
  const ws = await findWorkspace(sub, hintedWorkspaceId)
  if (!ws) {
    console.warn('[stripe/webhook] no workspace for subscription', subscriptionId)
    return
  }
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  const plan = planFromPriceId(subscriptionPriceId(sub))
  const grants = subscriptionGrantsPlan(sub.status) && plan !== null
  const nextPlan = grants ? plan! : 'free'
  await db
    .update(workspaces)
    .set({
      plan: nextPlan,
      stripeCustomerId: ws.stripeCustomerId ?? customerId,
      stripeSubscriptionId: sub.id,
      stripeSubscriptionStatus: sub.status,
      planRenewsAt: grants ? subscriptionPeriodEnd(sub) : null,
      updatedAt: new Date(),
    })
    .where(eq(workspaces.id, ws.id))
  if (ws.plan !== nextPlan) {
    await logAudit(db, {
      workspaceId: ws.id,
      action: 'billing.plan',
      targetType: 'workspace',
      targetId: ws.id,
      metadata: { from: ws.plan, to: nextPlan, status: sub.status, subscriptionId: sub.id },
    })
  }
}

/** Subscription ended: back to Free. Music, playlists and members stay exactly as they are. */
async function endSubscription(sub: Stripe.Subscription, hintedWorkspaceId: string | null): Promise<void> {
  const ws = await findWorkspace(sub, hintedWorkspaceId)
  if (!ws) return
  if (ws.stripeSubscriptionId && ws.stripeSubscriptionId !== sub.id) return // a newer subscription replaced this one
  await db
    .update(workspaces)
    .set({ plan: 'free', stripeSubscriptionId: null, stripeSubscriptionStatus: sub.status, planRenewsAt: null, updatedAt: new Date() })
    .where(eq(workspaces.id, ws.id))
  if (ws.plan !== 'free') {
    await logAudit(db, {
      workspaceId: ws.id,
      action: 'billing.plan',
      targetType: 'workspace',
      targetId: ws.id,
      metadata: { from: ws.plan, to: 'free', status: sub.status, subscriptionId: sub.id },
    })
  }
}
