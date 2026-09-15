import { NextResponse } from 'next/server'
import { z } from 'zod'
import { can, getAccess, getWorkspaceByUmeId, logAudit } from '@ume/db'
import { CAP } from '@ume/shared'
import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import { createPortalSession, isStripeConfigured } from '@/lib/stripe'
import { appUrl } from '@/lib/utils'
import { isSameOrigin } from '@/lib/app/request'

export const dynamic = 'force-dynamic'

function back(umeId: string, params: Record<string, string>) {
  const url = new URL(appUrl(`/app/${umeId}/billing`))
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url, 303)
}

/** Form POST from the Billing page: open the Stripe Customer Portal (invoices, cards, cancel). */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return NextResponse.json({ error: 'Cross-origin request refused.' }, { status: 403 })
  const session = await getSession()
  if (!session || session.user.banned) return NextResponse.redirect(new URL(appUrl('/login')), 303)

  const form = await req.formData().catch(() => null)
  const parsed = z.string().min(1).safeParse(form?.get('ws'))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  const umeId = parsed.data

  const ws = await getWorkspaceByUmeId(db, umeId)
  if (!ws) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 })
  const access = await getAccess(db, ws.id, session.user.id)
  if (!access?.membership || !can(access, CAP.MANAGE_BILLING)) return back(umeId, { error: 'forbidden' })
  if (!isStripeConfigured()) return back(umeId, { error: 'unconfigured' })
  if (!ws.stripeCustomerId) return back(umeId, { error: 'no_customer' })

  try {
    const portal = await createPortalSession({ workspace: ws, returnUrl: appUrl(`/app/${umeId}/billing`) })
    await logAudit(db, { workspaceId: ws.id, actorUserId: session.user.id, action: 'billing.portal', targetType: 'workspace', targetId: ws.id })
    return NextResponse.redirect(portal.url, 303)
  } catch (err) {
    console.error('[stripe/portal]', err)
    return back(umeId, { error: 'stripe' })
  }
}
