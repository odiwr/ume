import type { Metadata } from 'next'
import Link from 'next/link'
import { KeyRound, Plus, Server } from '@/components/ui/icons'
import { buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LinkDiscordCard } from '@/components/app/link-discord-card'
import { PageHeader } from '@/components/app/page-header'
import { TopBar } from '@/components/app/top-bar'
import { WorkspaceCard } from '@/components/app/workspace-card'
import { listMyWorkspaces } from '@/lib/app/queries'
import { requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Your servers', robots: { index: false } }

export default async function AppHomePage() {
  const session = await requireUser('/app')
  const me = session.user
  const items = await listMyWorkspaces(me.id)

  return (
    <div className="min-h-dvh">
      <TopBar user={me} />
      <main className="mx-auto w-full max-w-6xl space-y-10 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <PageHeader
          title="Your servers"
          actions={
            <>
              <Link href="/app/claim" className={buttonClasses('outline', 'md')}>
                <KeyRound className="size-4" /> Enter a token
              </Link>
              <Link href="/app/new" className={buttonClasses('primary', 'md')}>
                <Plus className="size-4" /> Add a server
              </Link>
            </>
          }
        />

        {!me.discordUserId ? <LinkDiscordCard callbackURL="/app" /> : null}

        {items.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <WorkspaceCard
                key={it.workspace.id}
                workspace={it.workspace}
                roleName={it.roleName}
                isOwner={it.isOwner}
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Server className="size-6" />}
            title="No servers yet"
            description={
              <>
                Add a server you own or administer, or enter the token Ume sends when you run{' '}
                <code className="font-mono">/reload</code> in Discord.
              </>
            }
          >
            <Link href="/app/new" className={buttonClasses('primary', 'md')}>
              <Plus className="size-4" /> Add a server
            </Link>
            <Link href="/app/claim" className={buttonClasses('outline', 'md')}>
              <KeyRound className="size-4" /> Enter a token
            </Link>
          </EmptyState>
        )}
      </main>
    </div>
  )
}
