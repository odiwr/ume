import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { can, getAccess, getWorkspaceByUmeId, logAudit, workspaces } from '@ume/db'
import { CAP, PLANS, isPaidPlan, type PlanId } from '@ume/shared'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { createCheckoutSession, createPortalSession, isStripeConfigured, priceIdForPlan } from '@/lib/stripe'
import { appUrl } from '@/lib/utils'
import { isSameOrigin } from '@/lib/app/request'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  ws: z.string().min(1),
  plan: z.enum(PLANS.map((p) => p.id) as [PlanId, ...PlanId[]]),
})

function back(umeId: string, params: Record<string, string>) {
  const url = new URL(appUrl(`/app/${umeId}/billing`))
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url, 303)
}

/**
 * Form POST from the Billing page. New subscribers go to Stripe Checkout; existing
 * subscribers change plans through the Customer Portal so proration stays Stripe's job.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-origin request refused.' }, { status: 403 })
  const session = await getSession()
  if (!session || session.user.banned) return NextResponse.redirect(new URL(appUrl('/login')), 303)

  const form = await req.formData().catch(() => null)
  const parsed = bodySchema.safeParse({ ws: form?.get('ws'), plan: form?.get('plan') })
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const { ws: umeId, plan } = parsed.data

  const ws = await getWorkspaceByUmeId(db, umeId)
  if (!ws) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })
  const access = await getAccess(db, ws.id, session.user.id)
  if (!access?.membership || !can(access, CAP.MANAGE_BILLING)) return back(umeId, { error: 'forbidden' })
  if (!isStripeConfigured()) return back(umeId, { error: 'unconfigured' })
  if (!isPaidPlan(plan) || !priceIdForPlan(plan)) return back(umeId, { error: 'plan' })
  if (ws.plan === plan) return back(umeId, { notice: 'same_plan' })

  try {
    if (ws.stripeSubscriptionId && ws.stripeCustomerId) {
      const portal = await createPortalSession({ workspace: ws, returnUrl: appUrl(`/app/${umeId}/billing`), switchToPlanId: plan })
      return NextResponse.redirect(portal.url, 303)
    }
    const checkout = await createCheckoutSession({
      workspace: ws,
      planId: plan,
      customerEmail: session.user.email,
      successUrl: appUrl(`/app/${umeId}/billing?checkout=success`),
      cancelUrl: appUrl(`/app/${umeId}/billing?checkout=cancelled`),
    })
    if (!ws.stripeCustomerId) {
      await db.update(workspaces).set({ stripeCustomerId: checkout.customerId, updatedAt: new Date() }).where(eq(workspaces.id, ws.id))
    }
    await logAudit(db, {
      workspaceId: ws.id,
      actorUserId: session.user.id,
      action: 'billing.checkout',
      targetType: 'workspace',
      targetId: ws.id,
      metadata: { plan },
    })
    return NextResponse.redirect(checkout.url, 303)
  } catch (err) {
    console.error('[stripe/checkout]', err)
    return back(umeId, { error: 'stripe' })
  }
}
