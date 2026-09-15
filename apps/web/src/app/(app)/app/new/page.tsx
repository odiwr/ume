import type { Metadata } from 'next'
import Link from 'next/link'
import { KeyRound, Server } from 'lucide-react'
import { botInviteUrl, canClaimGuild, guildIconUrl, type OAuthGuild } from '@ume/shared'
import { buttonClasses } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { LinkDiscordCard } from '@/components/app/link-discord-card'
import { Notice, PageHeader, Section } from '@/components/app/page-header'
import { ServerPicker, type PickerGuild, type PickerState } from '@/components/app/server-picker'
import { TopBar } from '@/components/app/top-bar'
import { db, getAccess } from '@/lib/db'
import { fetchUserGuilds } from '@/lib/discord-api'
import { findWorkspacesByGuildIds } from '@/lib/app/queries'
import { getDiscordAccessToken, requireUser } from '@/lib/session'

export const metadata: Metadata = { title: 'Add a server', robots: { index: false } }

export default async function NewWorkspacePage() {
  const session = await requireUser('/app/new')
  const me = session.user
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? ''

  let guilds: OAuthGuild[] | null = null
  let loadError: string | null = null
  const token = me.discordUserId ? await getDiscordAccessToken() : null
  if (token) {
    try {
      guilds = await fetchUserGuilds(token)
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Could not load your Discord servers.'
    }
  }

  let claimable: PickerGuild[] = []
  let joinable: PickerGuild[] = []
  if (guilds) {
    const workspaces = await findWorkspacesByGuildIds(guilds.map((g) => g.id))
    const byGuild = new Map(workspaces.map((w) => [w.guildId, w]))
    const rows: PickerGuild[] = []
    for (const g of guilds.slice().sort((a, b) => a.name.localeCompare(b.name))) {
      const ws = byGuild.get(g.id)
      const admin = canClaimGuild(g)
      if (!ws && !admin) continue
      if (ws?.status === 'purged') continue
      let state: PickerState = 'no_workspace'
      if (ws) state = ws.status === 'unclaimed' ? 'unclaimed' : ws.status === 'connected' ? 'connected' : ws.status === 'purging' ? 'purging' : 'disconnected'
      const access = ws ? await getAccess(db, ws.id, me.id) : null
      const isGuildOwner = g.owner || (!!ws?.guildOwnerDiscordId && ws.guildOwnerDiscordId === me.discordUserId)
      rows.push({
        id: g.id,
        name: g.name,
        iconUrl: guildIconUrl(g.id, g.icon, 96),
        canClaim: admin,
        state,
        umeId: ws?.umeId ?? null,
        isMember: !!access?.membership,
        canReconnect: !!ws && (ws.ownerUserId === me.id || isGuildOwner),
        botInGuild: ws?.botInGuild ?? false,
        botInviteUrl: botInviteUrl(clientId, g.id),
      })
    }
    claimable = rows.filter((r) => r.canClaim)
    joinable = rows.filter((r) => !r.canClaim)
  }

  return (
    <div className="min-h-dvh">
      <TopBar user={me} crumbs={[{ href: '/app', label: 'Your servers' }, { label: 'Add a server' }]} />
      <main className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Add a server"
          description="Servers where you are the owner or an Administrator on Discord can be claimed straight from here. Claiming makes you the workspace Owner."
          actions={
            <Link href="/app/claim" className={buttonClasses('outline', 'md')}>
              <KeyRound className="size-4" /> Use a token instead
            </Link>
          }
        />

        {!me.discordUserId ? (
          <LinkDiscordCard callbackURL="/app/new" />
        ) : !token ? (
          <LinkDiscordCard callbackURL="/app/new" mode="reauth" />
        ) : loadError ? (
          <Notice tone="danger">{loadError}</Notice>
        ) : null}

        {guilds ? (
          <>
            <Section title="Servers you administer" description="Claim a server to create its workspace, or reconnect one after a /reload.">
              {claimable.length ? (
                <ServerPicker guilds={claimable} />
              ) : (
                <EmptyState
                  icon={<Server className="size-6" />}
                  title="No servers you can claim"
                  description="Discord only shows servers where you are the owner or hold the Administrator permission. If you expected one here, ask its owner to run /reload and send you the token instead."
                >
                  <Link href="/app/claim" className={buttonClasses('outline', 'sm')}>
                    Enter a token
                  </Link>
                </EmptyState>
              )}
            </Section>
            {joinable.length ? (
              <Section title="Servers you are in that use Ume" description="Your access comes from the server’s Discord role mapping or its default role.">
                <ServerPicker guilds={joinable} />
              </Section>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  )
}
