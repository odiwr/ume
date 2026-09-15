import 'server-only'
import { ZodError } from 'zod'
import { can, getAccess, type Access } from '@ume/db'
import { CAP } from '@ume/shared'
import { db } from '@/lib/db'
import { requireUser } from '@/lib/session'

/** A user-facing error that server actions return instead of throwing. */
export class AppError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AppError'
  }
}

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail<T = undefined>(error: string): ActionResult<T> {
  return { ok: false, error }
}

/**
 * Runs an action body, turning AppError / zod errors into `{ ok: false }` results and
 * letting Next.js control-flow errors (redirect, notFound) propagate untouched.
 */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return ok(await fn())
  } catch (err) {
    if (err instanceof AppError) return fail(err.message)
    if (err instanceof ZodError) return fail(err.issues[0]?.message ?? 'Check the form and try again.')
    if (typeof err === 'object' && err !== null && 'digest' in err && String((err as { digest: unknown }).digest).startsWith('NEXT_')) {
      throw err
    }
    console.error('[action]', err)
    return fail('Something went wrong. Please try again.')
  }
}

export type Guarded = {
  session: Awaited<ReturnType<typeof requireUser>>
  user: Awaited<ReturnType<typeof requireUser>>['user']
  access: Access & { membership: NonNullable<Access['membership']> }
  workspace: Access['workspace']
}

/**
 * The one authorization gate every mutation goes through: a signed-in user, an active
 * membership in the workspace, and (optionally) a capability. Owner-only operations
 * additionally check `access.isOwner` at the call site.
 */
export async function guard(workspaceId: string, cap?: number): Promise<Guarded> {
  const session = await requireUser()
  const access = await getAccess(db, workspaceId, session.user.id)
  if (!access || !access.membership) throw new AppError('You are not a member of this workspace.')
  if (cap !== undefined && !can(access, cap)) {
    if (access.workspace.status !== 'connected' && !can(access, CAP.VIEW_LIBRARY)) {
      throw new AppError('This workspace is disconnected. Enter the new token in Settings first.')
    }
    throw new AppError(
      access.workspace.status !== 'connected'
        ? 'This workspace is disconnected and read-only until the new token is entered.'
        : 'You do not have permission to do that.',
    )
  }
  return {
    session,
    user: session.user,
    access: access as Guarded['access'],
    workspace: access.workspace,
  }
}

export async function guardOwner(workspaceId: string): Promise<Guarded> {
  const g = await guard(workspaceId)
  if (!g.access.isOwner) throw new AppError('Only the workspace Owner can do that.')
  return g
}
