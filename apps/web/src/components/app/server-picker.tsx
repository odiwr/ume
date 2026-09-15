'use client'
import * as React from 'react'
import Link from 'next/link'
import { ArrowUpRight, ExternalLink } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button, buttonClasses } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { GuildIcon } from '@/components/app/avatar'
import { ATTESTATION_LABEL } from '@/components/app/claim-token-form'
import { useAction } from '@/components/app/use-action'
import { claimGuildViaOAuth, joinWorkspaceViaOAuth } from '@/lib/app/actions/workspaces'

export type PickerState = 'no_workspace' | 'unclaimed' | 'connected' | 'disconnected' | 'purging'

export interface PickerGuild {
  id: string
  name: string
  iconUrl: string | null
  /** Owner or Administrator on Discord. */
  canClaim: boolean
  state: PickerState
  umeId: string | null
  /** Already a member of the workspace. */
  isMember: boolean
  /** May reconnect a disconnected workspace (workspace Owner or Discord guild owner). */
  canReconnect: boolean
  botInGuild: boolean
  botInviteUrl: string
}

const STATE_BADGE: Record<PickerState, { tone: BadgeTone; label: string }> = {
  no_workspace: { tone: 'default', label: 'Not set up' },
  unclaimed: { tone: 'beige', label: 'Waiting to be claimed' },
  connected: { tone: 'success', label: 'Connected' },
  disconnected: { tone: 'warning', label: 'Disconnected' },
  purging: { tone: 'danger', label: 'Being purged' },
}

export function ServerPicker({ guilds }: { guilds: PickerGuild[] }) {
  const [claiming, setClaiming] = React.useState<PickerGuild | null>(null)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const { run, pending } = useAction()

  async function join(g: PickerGuild) {
    setBusyId(g.id)
    await run(() => joinWorkspaceViaOAuth(g.id), { refresh: false })
    setBusyId(null)
  }

  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {guilds.map((g) => {
          const badge = STATE_BADGE[g.state]
          const busy = pending && busyId === g.id
          return (
            <li key={g.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <GuildIcon name={g.name} src={g.iconUrl} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{g.name}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge tone={badge.tone}>{badge.label}</Badge>
                    {g.canClaim ? <Badge tone="pink">Admin</Badge> : null}
                    {!g.botInGuild && g.state !== 'no_workspace' ? <Badge tone="warning">Bot not in server</Badge> : null}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                {g.state === 'connected' && g.umeId ? (
                  g.isMember ? (
                    <Link href={`/app/${g.umeId}`} className={buttonClasses('secondary', 'sm')}>
                      Open <ArrowUpRight className="size-3.5" />
                    </Link>
                  ) : (
                    <Button size="sm" variant="secondary" loading={busy} disabled={pending} onClick={() => join(g)}>
                      Join
                    </Button>
                  )
                ) : null}
                {g.state === 'disconnected' ? (
                  g.canReconnect ? (
                    <Button size="sm" onClick={() => setClaiming(g)} disabled={pending}>
                      Reconnect
                    </Button>
                  ) : (
                    <span className="text-xs text-fg-muted">Ask the workspace Owner to reconnect it.</span>
                  )
                ) : null}
                {g.state === 'purging' ? <span className="text-xs text-fg-muted">Run /reload once the purge finishes.</span> : null}
                {(g.state === 'no_workspace' || g.state === 'unclaimed') && g.canClaim ? (
                  <>
                    {!g.botInGuild ? (
                      <a href={g.botInviteUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses('outline', 'sm')}>
                        Add Ume to this server <ExternalLink className="size-3.5" />
                      </a>
                    ) : null}
                    <Button size="sm" onClick={() => setClaiming(g)} disabled={pending}>
                      Claim
                    </Button>
                  </>
                ) : null}
                {g.state === 'no_workspace' && !g.canClaim ? <span className="text-xs text-fg-muted">Only an admin can set this server up.</span> : null}
              </div>
            </li>
          )
        })}
      </ul>
      <ClaimDialog guild={claiming} onClose={() => setClaiming(null)} />
    </>
  )
}

function ClaimDialog({ guild, onClose }: { guild: PickerGuild | null; onClose: () => void }) {
  const [attested, setAttested] = React.useState(false)
  const { run, pending } = useAction()
  React.useEffect(() => {
    if (!guild) setAttested(false)
  }, [guild])
  const reconnect = guild?.state === 'disconnected'
  return (
    <Dialog open={!!guild} onOpenChange={(o) => (!o && !pending ? onClose() : undefined)}>
      {guild ? (
        <DialogContent
          title={reconnect ? `Reconnect ${guild.name}` : `Claim ${guild.name}`}
          description={
            reconnect
              ? 'This links the web workspace back to the bot. Members, playlists and music are untouched.'
              : 'You become the Owner of this workspace. Ume creates the default roles and a first playlist called “Main”.'
          }
        >
          <div className="space-y-4">
            {!guild.botInGuild ? (
              <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning [text-wrap:pretty]">
                Ume is not in this server yet. You can claim now and add the bot afterwards; nothing plays until it joins.
              </p>
            ) : null}
            <CheckboxField
              id="oauth-attestation"
              checked={attested}
              onCheckedChange={(v) => setAttested(v === true)}
              label={ATTESTATION_LABEL}
              description="Required before Ume stores audio from links. Takedowns disable the track and block its content everywhere."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              loading={pending}
              disabled={!attested}
              onClick={() => run(() => claimGuildViaOAuth(guild.id, attested), { refresh: false })}
            >
              {reconnect ? 'Reconnect' : 'Claim server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
