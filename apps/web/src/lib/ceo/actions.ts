'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { JOBS, PLANS, type PlanId } from '@ume/shared'
import { requireCeo } from '@/lib/session'
import {
  db,
  blockedHashes,
  dmcaNotices,
  FLAG_DEFAULTS,
  invites,
  logAudit,
  removeAllMembersExceptOwner,
  sessions,
  setFlag,
  tracks,
  users,
  workspaces,
} from '@/lib/db'
import { enqueue } from './queue'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

const id = z.string().trim().min(1).max(200)
const planIds = PLANS.map((p) => p.id) as [PlanId, ...PlanId[]]

function fields(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of formData.entries()) if (typeof v === 'string') out[k] = v
  return out
}

function parse<T extends z.ZodTypeAny>(schema: T, formData: FormData): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const r = schema.safeParse(fields(formData))
  if (r.success) return { ok: true, data: r.data as z.infer<T> }
  const first = r.error.issues[0]
  return { ok: false, error: first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input' }
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong'
}

function wsPaths(workspaceId: string) {
  revalidatePath('/ceo')
  revalidatePath('/ceo/workspaces')
  revalidatePath(`/ceo/workspaces/${workspaceId}`)
  revalidatePath('/ceo/storage')
  revalidatePath('/ceo/revenue')
  revalidatePath('/ceo/bot')
  revalidatePath('/ceo/audit')
}

// ────────────────────────────────────────────────────────────────────────────
// Workspaces
// ────────────────────────────────────────────────────────────────────────────

export async function setQuotaOverrideAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(
    z.object({
      workspaceId: id,
      /** Bytes. Empty string clears the override so the plan quota applies again. */
      bytes: z.string().trim().default(''),
    }),
    formData,
  )
  if (!p.ok) return p
  try {
    const bytes = p.data.bytes === '' ? null : Number(p.data.bytes)
    if (bytes !== null && (!Number.isSafeInteger(bytes) || bytes < 0)) return { ok: false, error: 'Enter a whole number of bytes, or leave empty to clear.' }
    const [ws] = await db
      .update(workspaces)
      .set({ storageQuotaOverrideBytes: bytes, updatedAt: new Date() })
      .where(eq(workspaces.id, p.data.workspaceId))
      .returning({ id: workspaces.id, previous: workspaces.storageQuotaOverrideBytes })
    if (!ws) return { ok: false, error: 'Workspace not found.' }
    await logAudit(db, {
      workspaceId: ws.id,
      actorUserId: user.id,
      action: 'ceo.workspace.quota_override',
      targetType: 'workspace',
      targetId: ws.id,
      metadata: { bytes },
    })
    wsPaths(ws.id)
    return { ok: true, message: bytes === null ? 'Quota override cleared. The plan quota applies.' : 'Quota override saved.' }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export async function setPlanAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ workspaceId: id, plan: z.enum(planIds) }), formData)
  if (!p.ok) return p
  try {
    const before = await db.query.workspaces.findFirst({ where: eq(workspaces.id, p.data.workspaceId), columns: { id: true, plan: true } })
    if (!before) return { ok: false, error: 'Workspace not found.' }
    if (before.plan === p.data.plan) return { ok: true, message: `Already on ${p.data.plan}.` }
    await db.update(workspaces).set({ plan: p.data.plan, updatedAt: new Date() }).where(eq(workspaces.id, before.id))
    await logAudit(db, {
      workspaceId: before.id,
      actorUserId: user.id,
      action: 'ceo.workspace.plan_override',
      targetType: 'workspace',
      targetId: before.id,
      metadata: { from: before.plan, to: p.data.plan, note: 'Admin override; Stripe subscription untouched.' },
    })
    wsPaths(before.id)
    return { ok: true, message: `Plan set to ${p.data.plan}. Stripe was not touched.` }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export async function disconnectWorkspaceAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ workspaceId: id }), formData)
  if (!p.ok) return p
  try {
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, p.data.workspaceId), columns: { id: true, status: true } })
    if (!ws) return { ok: false, error: 'Workspace not found.' }
    if (ws.status !== 'connected') return { ok: false, error: `Workspace is ${ws.status}; only connected workspaces can be disconnected.` }
    const now = new Date()
    await db.update(workspaces).set({ status: 'disconnected', disconnectedAt: now, updatedAt: now }).where(eq(workspaces.id, ws.id))
    await logAudit(db, { workspaceId: ws.id, actorUserId: user.id, action: 'ceo.workspace.disconnect', targetType: 'workspace', targetId: ws.id })
    wsPaths(ws.id)
    return { ok: true, message: 'Workspace disconnected. It is read-only until an admin runs /reload and enters the new token.' }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export async function resetWorkspaceAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ workspaceId: id }), formData)
  if (!p.ok) return p
  try {
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, p.data.workspaceId), columns: { id: true, status: true } })
    if (!ws) return { ok: false, error: 'Workspace not found.' }
    if (ws.status === 'purged' || ws.status === 'purging') return { ok: false, error: 'Workspace is being purged.' }
    const removed = await removeAllMembersExceptOwner(db, ws.id)
    const now = new Date()
    const revoked = await db
      .update(invites)
      .set({ revokedAt: now })
      .where(and(eq(invites.workspaceId, ws.id), isNull(invites.revokedAt)))
      .returning({ id: invites.id })
    await logAudit(db, {
      workspaceId: ws.id,
      actorUserId: user.id,
      action: 'ceo.workspace.reset',
      targetType: 'workspace',
      targetId: ws.id,
      metadata: { removedMembers: removed, revokedInvites: revoked.length },
    })
    wsPaths(ws.id)
    return { ok: true, message: `Reset done: ${removed} member${removed === 1 ? '' : 's'} removed, ${revoked.length} invite${revoked.length === 1 ? '' : 's'} revoked.` }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export async function purgeWorkspaceAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ workspaceId: id, confirm: z.string().trim().min(1, 'Type the Ume ID to confirm.') }), formData)
  if (!p.ok) return p
  try {
    const ws = await db.query.workspaces.findFirst({ where: eq(workspaces.id, p.data.workspaceId), columns: { id: true, umeId: true, status: true } })
    if (!ws) return { ok: false, error: 'Workspace not found.' }
    if (p.data.confirm !== ws.umeId) return { ok: false, error: 'The Ume ID you typed does not match.' }
    if (ws.status === 'purged' || ws.status === 'purging') return { ok: false, error: `Workspace is already ${ws.status}.` }
    // Enqueue first: if the queue is unreachable we do not want a workspace stuck in "purging".
    const jobId = await enqueue(JOBS.purgeWorkspace, { workspaceId: ws.id, reason: 'ceo', requestedByUserId: user.id })
    const now = new Date()
    await db.update(workspaces).set({ status: 'purging', updatedAt: now }).where(eq(workspaces.id, ws.id))
    await logAudit(db, {
      workspaceId: ws.id,
      actorUserId: user.id,
      action: 'ceo.workspace.purge',
      targetType: 'workspace',
      targetId: ws.id,
      metadata: { jobId, reason: 'ceo' },
    })
    wsPaths(ws.id)
    return { ok: true, message: `Purge queued (job ${jobId ?? 'n/a'}). The worker deletes storage and rows shortly.` }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export async function resetInactivityClockAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ workspaceId: id }), formData)
  if (!p.ok) return p
  try {
    const now = new Date()
    const [ws] = await db
      .update(workspaces)
      .set({ lastActivityAt: now, inactivityNotice30dSentAt: null, inactivityNotice48hSentAt: null, updatedAt: now })
      .where(eq(workspaces.id, p.data.workspaceId))
      .returning({ id: workspaces.id })
    if (!ws) return { ok: false, error: 'Workspace not found.' }
    await logAudit(db, { workspaceId: ws.id, actorUserId: user.id, action: 'ceo.workspace.reset_inactivity', targetType: 'workspace', targetId: ws.id })
    wsPaths(ws.id)
    return { ok: true, message: 'Inactivity clock reset to now; pending notices cleared.' }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Users
// ────────────────────────────────────────────────────────────────────────────

export async function banUserAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ userId: id, reason: z.string().trim().max(500).default('') }), formData)
  if (!p.ok) return p
  try {
    if (p.data.userId === user.id) return { ok: false, error: 'You cannot ban yourself.' }
    const [target] = await db
      .update(users)
      .set({ banned: true, banReason: p.data.reason || null, updatedAt: new Date() })
      .where(eq(users.id, p.data.userId))
      .returning({ id: users.id, email: users.email })
    if (!target) return { ok: false, error: 'User not found.' }
    // Kill live sessions so the ban is immediate (cookie cache lasts up to five minutes).
    await db.delete(sessions).where(eq(sessions.userId, target.id))
    await logAudit(db, { actorUserId: user.id, action: 'ceo.user.ban', targetType: 'user', targetId: target.id, metadata: { reason: p.data.reason } })
    revalidatePath('/ceo/users')
    revalidatePath(`/ceo/users/${target.id}`)
    revalidatePath('/ceo/audit')
    return { ok: true, message: `${target.email} is banned and signed out everywhere.` }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export async function unbanUserAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ userId: id }), formData)
  if (!p.ok) return p
  try {
    const [target] = await db
      .update(users)
      .set({ banned: false, banReason: null, updatedAt: new Date() })
      .where(eq(users.id, p.data.userId))
      .returning({ id: users.id, email: users.email })
    if (!target) return { ok: false, error: 'User not found.' }
    await logAudit(db, { actorUserId: user.id, action: 'ceo.user.unban', targetType: 'user', targetId: target.id })
    revalidatePath('/ceo/users')
    revalidatePath(`/ceo/users/${target.id}`)
    revalidatePath('/ceo/audit')
    return { ok: true, message: `${target.email} can sign in again.` }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Flags
// ────────────────────────────────────────────────────────────────────────────

const flagKeys = Object.keys(FLAG_DEFAULTS) as [string, ...string[]]

export async function toggleFlagAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ key: z.enum(flagKeys), enabled: z.enum(['true', 'false']) }), formData)
  if (!p.ok) return p
  try {
    const enabled = p.data.enabled === 'true'
    await setFlag(db, p.data.key, { enabled }, user.id)
    await logAudit(db, { actorUserId: user.id, action: 'ceo.flag.update', targetType: 'flag', targetId: p.data.key, metadata: { enabled } })
    revalidatePath('/ceo/flags')
    revalidatePath('/ceo/audit')
    return { ok: true, message: `${p.data.key} is now ${enabled ? 'on' : 'off'}.` }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export async function setFlagValueAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ key: z.enum(flagKeys), message: z.string().trim().max(500).default('') }), formData)
  if (!p.ok) return p
  try {
    const value = p.data.message ? { message: p.data.message } : {}
    await setFlag(db, p.data.key, { value }, user.id)
    await logAudit(db, { actorUserId: user.id, action: 'ceo.flag.update', targetType: 'flag', targetId: p.data.key, metadata: { value } })
    revalidatePath('/ceo/flags')
    revalidatePath('/ceo/audit')
    return { ok: true, message: 'Flag value saved.' }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// DMCA
// ────────────────────────────────────────────────────────────────────────────

function dmcaPaths(noticeId: string, workspaceId?: string | null) {
  revalidatePath('/ceo/dmca')
  revalidatePath(`/ceo/dmca/${noticeId}`)
  revalidatePath('/ceo/storage')
  revalidatePath('/ceo/audit')
  if (workspaceId) revalidatePath(`/ceo/workspaces/${workspaceId}`)
}

export async function dmcaDisableTrackAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ noticeId: id }), formData)
  if (!p.ok) return p
  try {
    const notice = await db.query.dmcaNotices.findFirst({ where: eq(dmcaNotices.id, p.data.noticeId) })
    if (!notice) return { ok: false, error: 'Notice not found.' }
    const now = new Date()
    let blockedHash = false
    let disabled = false
    if (notice.trackId) {
      const [track] = await db
        .update(tracks)
        .set({ status: 'disabled', updatedAt: now })
        .where(eq(tracks.id, notice.trackId))
        .returning({ id: tracks.id, sha256: tracks.sha256, workspaceId: tracks.workspaceId })
      if (track) {
        disabled = true
        if (track.sha256) {
          await db
            .insert(blockedHashes)
            .values({ sha256: track.sha256, reason: `DMCA notice ${notice.id}`, createdByUserId: user.id })
            .onConflictDoNothing()
          blockedHash = true
        }
        await logAudit(db, {
          workspaceId: track.workspaceId,
          actorUserId: user.id,
          action: 'ceo.track.disable',
          targetType: 'track',
          targetId: track.id,
          metadata: { noticeId: notice.id, blockedHash },
        })
      }
    }
    await db.update(dmcaNotices).set({ status: 'actioned', updatedAt: now }).where(eq(dmcaNotices.id, notice.id))
    await logAudit(db, {
      workspaceId: notice.workspaceId,
      actorUserId: user.id,
      action: 'ceo.dmca.action',
      targetType: 'dmca_notice',
      targetId: notice.id,
      metadata: { status: 'actioned', disabled, blockedHash },
    })
    dmcaPaths(notice.id, notice.workspaceId)
    const parts = [disabled ? 'Track disabled' : 'No linked track to disable', blockedHash ? 'hash blocked' : 'no hash to block']
    return { ok: true, message: `${parts.join(', ')}. Notice marked actioned.` }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export async function dmcaSetStatusAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ noticeId: id, status: z.enum(['counter_noticed', 'restored', 'rejected', 'received']) }), formData)
  if (!p.ok) return p
  try {
    const notice = await db.query.dmcaNotices.findFirst({ where: eq(dmcaNotices.id, p.data.noticeId) })
    if (!notice) return { ok: false, error: 'Notice not found.' }
    const now = new Date()
    let restored = false
    if (p.data.status === 'restored' && notice.trackId) {
      const [track] = await db
        .update(tracks)
        .set({ status: 'ready', updatedAt: now })
        .where(and(eq(tracks.id, notice.trackId), eq(tracks.status, 'disabled')))
        .returning({ id: tracks.id, workspaceId: tracks.workspaceId })
      if (track) {
        restored = true
        await logAudit(db, {
          workspaceId: track.workspaceId,
          actorUserId: user.id,
          action: 'ceo.track.restore',
          targetType: 'track',
          targetId: track.id,
          metadata: { noticeId: notice.id },
        })
      }
    }
    await db.update(dmcaNotices).set({ status: p.data.status, updatedAt: now }).where(eq(dmcaNotices.id, notice.id))
    await logAudit(db, {
      workspaceId: notice.workspaceId,
      actorUserId: user.id,
      action: 'ceo.dmca.status',
      targetType: 'dmca_notice',
      targetId: notice.id,
      metadata: { from: notice.status, to: p.data.status, restored },
    })
    dmcaPaths(notice.id, notice.workspaceId)
    return {
      ok: true,
      message:
        p.data.status === 'restored'
          ? restored
            ? 'Track restored to ready and notice marked restored.'
            : 'Notice marked restored (no disabled track to restore). The blocked hash, if any, stays blocked.'
          : `Notice marked ${p.data.status.replace('_', ' ')}.`,
    }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}

export async function dmcaSaveNotesAction(formData: FormData): Promise<ActionResult> {
  const { user } = await requireCeo()
  const p = parse(z.object({ noticeId: id, notes: z.string().max(5000).default('') }), formData)
  if (!p.ok) return p
  try {
    const [notice] = await db
      .update(dmcaNotices)
      .set({ notes: p.data.notes.trim() || null, updatedAt: new Date() })
      .where(eq(dmcaNotices.id, p.data.noticeId))
      .returning({ id: dmcaNotices.id, workspaceId: dmcaNotices.workspaceId })
    if (!notice) return { ok: false, error: 'Notice not found.' }
    await logAudit(db, { workspaceId: notice.workspaceId, actorUserId: user.id, action: 'ceo.dmca.notes', targetType: 'dmca_notice', targetId: notice.id })
    dmcaPaths(notice.id, notice.workspaceId)
    return { ok: true, message: 'Notes saved.' }
  } catch (e) {
    return { ok: false, error: errorMessage(e) }
  }
}
