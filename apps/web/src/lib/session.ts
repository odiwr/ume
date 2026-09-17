import 'server-only'
import { cache } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { accounts } from '@ume/db'
import { auth } from './auth'
import { db } from './db'

export const getSession = cache(async () => {
  const h = await headers()
  const session = await auth.api.getSession({ headers: h })
  // The Discord fields are written by an account hook after the session cookie (and its
  // 5-minute cookie cache) was issued, so a just-linked user would still look unlinked.
  // Only users without a Discord id pay for this database read.
  if (session && !session.user.discordUserId) {
    return auth.api.getSession({ headers: h, query: { disableCookieCache: true } })
  }
  return session
})

/** Signed-in user or redirect to /login (preserving the destination). */
export async function requireUser(next?: string) {
  const session = await getSession()
  if (!session) redirect(`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`)
  if (session.user.banned) redirect('/banned')
  return session
}

export function ceoEmails(): string[] {
  return (process.env.CEO_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isCeoEmail(email: string | null | undefined): boolean {
  return !!email && ceoEmails().includes(email.toLowerCase())
}

/**
 * CEO console gate. Defense in depth:
 *  1. a session must exist,
 *  2. the email must be on the CEO_EMAILS allow-list,
 *  3. the account must have signed in with Google (not Discord / password),
 *  4. the email must be verified.
 */
export async function requireCeo() {
  const session = await getSession()
  if (!session) redirect('/ceo/login')
  const { user } = session
  if (!isCeoEmail(user.email) || !user.emailVerified) redirect('/ceo/login?denied=1')
  const google = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, user.id), eq(accounts.providerId, 'google')),
    columns: { id: true },
  })
  if (!google) redirect('/ceo/login?denied=1')
  return session
}

/** Discord OAuth access token for the signed-in user (refreshed by Better Auth when needed). */
export async function getDiscordAccessToken(): Promise<string | null> {
  const session = await getSession()
  if (!session) return null
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, session.user.id), eq(accounts.providerId, 'discord')),
    columns: { id: true },
  })
  if (!account) return null
  try {
    const res = await auth.api.getAccessToken({
      body: { accountId: account.id, userId: session.user.id },
      headers: await headers(),
    })
    return res?.accessToken ?? null
  } catch {
    return null
  }
}
