import type { Metadata } from 'next'
import { BrandMark } from '@/components/ui/logo'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { ShieldAlert } from '@/components/ui/icons'
import { db, accounts } from '@/lib/db'
import { getSession, isCeoEmail } from '@/lib/session'
import { CeoLoginForm } from '@/components/ceo/login-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function CeoLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const denied = sp.denied === '1'
  const session = await getSession()

  // Already a verified founder? Straight in. Otherwise show the page (and the reason).
  if (session && isCeoEmail(session.user.email) && session.user.emailVerified) {
    const google = await db.query.accounts.findFirst({
      where: and(eq(accounts.userId, session.user.id), eq(accounts.providerId, 'google')),
      columns: { id: true },
    })
    if (google) redirect('/ceo')
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandMark size={44} />
          <h1 className="mt-4 font-display text-3xl font-medium tracking-tight">Founder console</h1>
          <p className="mt-1 text-sm text-fg-muted">Google accounts on the allow-list only.</p>
        </div>

        <div className="rounded-2xl bg-surface-2 p-5 sm:p-6">
          {denied ? (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-danger/10 p-4 text-sm text-danger">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">This Google account is not on the allow-list.</p>
                <p className="mt-0.5 text-danger/80">
                  {session
                    ? `You are signed in as ${session.user.email}. Sign in with the founder Google account instead.`
                    : 'Try the founder Google account.'}
                </p>
              </div>
            </div>
          ) : null}
          <CeoLoginForm />
          <p className="mt-4 text-center text-xs text-fg-subtle">
            Server admins manage their music at{' '}
            <Link href="/app" className="text-fg-muted underline-offset-2 hover:underline">
              /app
            </Link>
            .
          </p>
        </div>
      </div>
    </main>
  )
}
