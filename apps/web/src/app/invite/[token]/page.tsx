import type { Metadata } from 'next'
import Link from 'next/link'
import { CalendarClock, Clock, Link2Off, Shield, Users } from '@/components/ui/icons'
import { buttonClasses } from '@/components/ui/button'
import { Logo } from '@/components/ui/logo'
import { GuildIcon } from '@/components/app/avatar'
import { Absolute } from '@/components/app/time'
import { getInvitePreview, type InviteProblem } from '@/lib/app/invite-preview'
import { requireUser } from '@/lib/session'
import { AcceptInviteButton } from './accept-button'

export const metadata: Metadata = { title: 'Accept invite', robots: { index: false } }

const PROBLEMS: Record<InviteProblem, { title: string; description: string }> = {
  invalid: {
    title: 'This invite isn’t valid.',
    description:
      'The link may be incomplete, or the server it pointed to no longer exists on Ume. Ask whoever sent it for a new one.',
  },
  expired: {
    title: 'This invite has expired.',
    description:
      'Invites stop working after their expiry date. Ask whoever sent it for a new link.',
  },
  revoked: {
    title: 'This invite was revoked.',
    description:
      'A server admin turned this link off. Ask them for a new one if you still need access.',
  },
  used_up: {
    title: 'This invite has been used up.',
    description: 'Every use of this link has been taken. Ask whoever sent it for a new one.',
  },
}

/**
 * Lives outside the route groups so it works before the user has a workspace. The page
 * only previews the invite; `acceptInvite()` does the real checks and redirects on success.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // No session → /login?next=/invite/<token> (safeNextPath accepts plain paths). Banned → /banned.
  const session = await requireUser(`/invite/${token}`)
  const preview = await getInvitePreview(token)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="mx-auto flex h-24 w-full max-w-7xl items-center px-5 sm:px-8 lg:px-12">
        <Logo size={30} />
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 justify-center px-5 py-8 sm:px-8 lg:px-12">
        {preview.ok ? (
          <Preview token={token} preview={preview} viewerEmail={session.user.email} />
        ) : (
          <Problem problem={preview.problem} />
        )}
      </main>
    </div>
  )
}

function Preview({
  token,
  preview,
  viewerEmail,
}: {
  token: string
  preview: Extract<Awaited<ReturnType<typeof getInvitePreview>>, { ok: true }>
  viewerEmail: string | null | undefined
}) {
  const wrongAccount =
    preview.email !== null && (viewerEmail ?? '').toLowerCase() !== preview.email.toLowerCase()

  return (
    <div className="w-full max-w-lg">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-pink">Invitation</p>
      <h1 className="font-display mt-2 text-3xl font-medium leading-tight sm:text-4xl">
        Join {preview.serverName} on Ume.
      </h1>
      <p className="mt-4 text-base text-fg-muted">
        {preview.inviterName} invited you to help with this server’s playlists as{' '}
        <span className="font-semibold text-fg">{preview.roleName}</span>.
      </p>

      <div className="mt-8 rounded-2xl bg-sage-light p-5">
        <div className="flex items-center gap-4">
          <GuildIcon name={preview.serverName} src={preview.iconUrl} size={56} />
          <div className="min-w-0">
            <p className="truncate font-display text-lg font-semibold">{preview.serverName}</p>
            <p className="text-sm text-fg-muted">Discord server</p>
          </div>
        </div>
        <dl className="mt-5 grid gap-3 text-sm">
          <Detail icon={<Shield className="size-4" aria-hidden />} label="Role">
            {preview.roleName}
          </Detail>
          <Detail icon={<Clock className="size-4" aria-hidden />} label="Invite expires">
            <Absolute date={preview.expiresAt} />
          </Detail>
          {preview.membershipExpiresAt ? (
            <Detail icon={<CalendarClock className="size-4" aria-hidden />} label="Access ends">
              <Absolute date={preview.membershipExpiresAt} />
            </Detail>
          ) : null}
          {preview.requireGuildMember ? (
            <Detail icon={<Users className="size-4" aria-hidden />} label="Requirement">
              You must be a member of the Discord server.
            </Detail>
          ) : null}
        </dl>
      </div>

      <div className="mt-4 rounded-2xl bg-surface-2 px-4 py-3 text-sm text-fg-muted">
        Signed in as <span className="font-medium text-fg">{viewerEmail ?? 'your account'}</span>.
        {wrongAccount ? (
          <>
            {' '}
            This invite was sent to <span className="font-medium text-fg">{preview.email}</span>;
            sign in with that account to accept it.
          </>
        ) : null}
      </div>

      <div className="mt-8">
        <AcceptInviteButton token={token} serverName={preview.serverName} />
      </div>
    </div>
  )
}

function Detail({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0 text-sage">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">{label}</dt>
        <dd className="mt-0.5 text-fg [text-wrap:pretty]">{children}</dd>
      </div>
    </div>
  )
}

function Problem({ problem }: { problem: InviteProblem }) {
  const copy = PROBLEMS[problem]
  return (
    <div className="w-full max-w-lg">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-blush text-pink">
        <Link2Off className="size-7" aria-hidden />
      </span>
      <h1 className="font-display mt-6 text-3xl font-medium leading-tight sm:text-4xl">
        {copy.title}
      </h1>
      <p className="mt-4 text-base text-fg-muted [text-wrap:pretty]">{copy.description}</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Link href="/app" className={buttonClasses('primary', 'lg')}>
          Go to your servers
        </Link>
        <Link href="/" className={buttonClasses('ghost', 'lg')}>
          Back to Ume
        </Link>
      </div>
    </div>
  )
}
