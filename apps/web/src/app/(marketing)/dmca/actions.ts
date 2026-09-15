'use server'

import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { db, dmcaNotices, logAudit } from '@/lib/db'
import { getSession } from '@/lib/session'
import { requestIp } from '@/lib/site/request-ip'

export interface DmcaFormState {
  ok: boolean
  /** Notice reference shown to the claimant on success. */
  reference?: string
  message?: string
  errors?: Partial<Record<DmcaField, string>>
}

export type DmcaField =
  | 'claimantName'
  | 'claimantEmail'
  | 'claimantAddress'
  | 'workDescription'
  | 'infringingUrl'
  | 'goodFaith'
  | 'accuracy'
  | 'signature'

const checkbox = z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean())

const noticeSchema = z.object({
  claimantName: z
    .string()
    .trim()
    .min(2, 'Enter your full name.')
    .max(200, 'Keep it under 200 characters.'),
  claimantEmail: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  claimantAddress: z
    .string()
    .trim()
    .min(8, 'Enter a postal address.')
    .max(500, 'Keep it under 500 characters.'),
  workDescription: z
    .string()
    .trim()
    .min(20, 'Describe the copyrighted work in at least a sentence.')
    .max(4000, 'Keep it under 4,000 characters.'),
  infringingUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((v) => {
      try {
        const u = new URL(v)
        return u.protocol === 'https:' || u.protocol === 'http:'
      } catch {
        return false
      }
    }, 'Enter the full URL of the infringing material, starting with https://.'),
  goodFaith: checkbox.refine((v) => v === true, 'You must confirm this statement.'),
  accuracy: checkbox.refine((v) => v === true, 'You must confirm this statement.'),
  signature: z.string().trim().min(2, 'Type your full legal name as a signature.').max(200),
})

function fieldErrors(error: z.ZodError): Partial<Record<DmcaField, string>> {
  const out: Partial<Record<DmcaField, string>> = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (typeof key === 'string' && !(key in out)) out[key as DmcaField] = issue.message
  }
  return out
}

export async function submitDmcaNotice(
  _prev: DmcaFormState,
  formData: FormData,
): Promise<DmcaFormState> {
  // Honeypot: bots fill every field. Humans never see this one.
  if (
    typeof formData.get('website') === 'string' &&
    (formData.get('website') as string).length > 0
  ) {
    return { ok: true, reference: `DMCA-${randomUUID().slice(0, 8).toUpperCase()}` }
  }

  const parsed = noticeSchema.safeParse({
    claimantName: formData.get('claimantName'),
    claimantEmail: formData.get('claimantEmail'),
    claimantAddress: formData.get('claimantAddress'),
    workDescription: formData.get('workDescription'),
    infringingUrl: formData.get('infringingUrl'),
    goodFaith: formData.get('goodFaith'),
    accuracy: formData.get('accuracy'),
    signature: formData.get('signature'),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: 'Please fix the highlighted fields.',
      errors: fieldErrors(parsed.error),
    }
  }

  const data = parsed.data
  if (data.signature.toLowerCase() !== data.claimantName.toLowerCase()) {
    return {
      ok: false,
      message: 'Please fix the highlighted fields.',
      errors: { signature: 'The signature must match the claimant name exactly.' },
    }
  }

  const id = `dmca_${randomUUID()}`
  const ip = await requestIp()
  const session = await getSession().catch(() => null)

  try {
    await db.insert(dmcaNotices).values({
      id,
      claimantName: data.claimantName,
      claimantEmail: data.claimantEmail,
      claimantAddress: data.claimantAddress,
      workDescription: data.workDescription,
      infringingUrl: data.infringingUrl,
      goodFaithStatement: data.goodFaith,
      accuracyStatement: data.accuracy,
      signature: data.signature,
      status: 'received',
      ip,
    })
    await logAudit(db, {
      actorUserId: session?.user.id ?? null,
      action: 'dmca.notice.submit',
      targetType: 'dmca_notice',
      targetId: id,
      metadata: { infringingUrl: data.infringingUrl },
      ip,
    })
  } catch (err) {
    console.error('[dmca] failed to store notice', err)
    return {
      ok: false,
      message:
        'We could not save your notice. Please try again in a minute or email the designated agent directly.',
    }
  }

  return { ok: true, reference: id.replace('dmca_', 'DMCA-').slice(0, 13).toUpperCase() }
}
