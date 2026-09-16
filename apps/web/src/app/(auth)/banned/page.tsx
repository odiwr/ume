import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Ban } from '@/components/ui/icons'
import { getSession } from '@/lib/session'
import { supportInviteUrl } from '@/lib/site/links'
import { SignOutButton } from './sign-out-button'

export const metadata: Metadata = {
  title: 'Account suspended',
  robots: { index: false },
}

export default async function BannedPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!session.user.banned) redirect('/app')

  const reason = session.user.banReason?.trim() || null
  const support = supportInviteUrl()

  return (
    <div className="w-full max-w-md">
      <div className="rounded-2xl border border-danger/30 bg-surface p-6 sm:p-8">
        <span className="flex size-12 items-center justify-center rounded-xl bg-danger/15 text-danger">
          <Ban className="size-6" aria-hidden />
        </span>
        <h1 className="font-display mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
          This account is suspended
        </h1>
        <p className="mt-2 text-sm text-fg-muted">
          Signed in as <span className="text-fg">{session.user.email}</span>. You can still listen
          in Discord, but the web app is closed to this account.
        </p>
        {reason ? (
          <div className="mt-5 rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Reason</p>
            <p className="mt-1 text-fg-muted">{reason}</p>
          </div>
        ) : null}
        <p className="mt-5 text-sm text-fg-muted">
          Suspensions usually follow repeated copyright strikes or a breach of the{' '}
          <Link href="/terms" className="text-pink-soft underline underline-offset-4">
            Terms
          </Link>
          . If you think this is a mistake,{' '}
          {support ? (
            <a
              href={support}
              target="_blank"
              rel="noopener noreferrer"
              className="text-pink-soft underline underline-offset-4"
            >
              reach us on the support server
            </a>
          ) : (
            <Link href="/dmca" className="text-pink-soft underline underline-offset-4">
              contact us using the address on the DMCA page
            </Link>
          )}{' '}
          and quote your email address.
        </p>
        <div className="mt-6">
          <SignOutButton />
        </div>
      </div>
    </div>
  )
}
