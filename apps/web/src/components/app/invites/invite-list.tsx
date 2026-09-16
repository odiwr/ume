'use client'
import * as React from 'react'
import { Ban, Link2, Mail, Ticket } from '@/components/ui/icons'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { CopyButton } from '@/components/app/copy-button'
import { Absolute, Ago } from '@/components/app/time'
import { useAction } from '@/components/app/use-action'
import { revokeInvite } from '@/lib/app/actions/invites'

export interface InviteRow {
  id: string
  kind: 'link' | 'email'
  url: string
  email: string | null
  label: string | null
  roleName: string
  uses: number
  maxUses: number | null
  expiresAt: string
  membershipExpiresAt: string | null
  requireGuildMember: boolean
  revokedAt: string | null
  emailSentAt: string | null
  createdAt: string
  createdBy: string
}

function stateOf(inv: InviteRow): { tone: BadgeTone; label: string; live: boolean } {
  if (inv.revokedAt) return { tone: 'default', label: 'Revoked', live: false }
  if (new Date(inv.expiresAt).getTime() < Date.now()) return { tone: 'default', label: 'Expired', live: false }
  if (inv.maxUses !== null && inv.uses >= inv.maxUses) return { tone: 'beige', label: inv.kind === 'email' ? 'Accepted' : 'Used up', live: false }
  return { tone: 'success', label: 'Active', live: true }
}

export function InviteList({ workspaceId, rows }: { workspaceId: string; rows: InviteRow[] }) {
  const [revoking, setRevoking] = React.useState<InviteRow | null>(null)
  if (!rows.length) {
    return (
      <EmptyState icon={<Ticket className="size-6" />} title="No invites yet" description="Most servers never need one: map Discord roles under Members and people get in by signing in. Invites cover everyone else." />
    )
  }
  return (
    <>
      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.map((inv) => {
          const state = stateOf(inv)
          return (
            <li key={inv.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-fg-muted">
                  {inv.kind === 'link' ? <Link2 className="size-4" aria-hidden /> : <Mail className="size-4" aria-hidden />}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                    {inv.kind === 'email' ? inv.email : inv.label || 'Share link'}
                    <Badge tone={state.tone}>{state.label}</Badge>
                    <Badge>{inv.roleName}</Badge>
                    {inv.requireGuildMember ? <Badge tone="sage">Server members only</Badge> : null}
                  </p>
                  <p className="mt-0.5 text-xs text-fg-muted">
                    {inv.kind === 'link' && inv.label ? `${inv.label} · ` : ''}
                    {inv.kind === 'link' ? `${inv.uses}${inv.maxUses !== null ? ` of ${inv.maxUses}` : ''} use${inv.uses === 1 && inv.maxUses === null ? '' : 's'} · ` : inv.emailSentAt ? 'Emailed · ' : 'Email not sent · '}
                    {state.live ? (
                      <>
                        expires <Ago date={inv.expiresAt} />
                      </>
                    ) : (
                      <>
                        created <Ago date={inv.createdAt} />
                      </>
                    )}
                    {inv.membershipExpiresAt ? (
                      <>
                        {' '}
                        · access ends <Absolute date={inv.membershipExpiresAt} withTime={false} />
                      </>
                    ) : null}
                    {' · by '}
                    {inv.createdBy}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                {state.live ? <CopyButton value={inv.url} label="Copy link" /> : null}
                {!inv.revokedAt ? (
                  <Button variant="ghost" size="sm" onClick={() => setRevoking(inv)}>
                    <Ban className="size-3.5" /> Revoke
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      <RevokeDialog workspaceId={workspaceId} row={revoking} onClose={() => setRevoking(null)} />
    </>
  )
}

function RevokeDialog({ workspaceId, row, onClose }: { workspaceId: string; row: InviteRow | null; onClose: () => void }) {
  const [removeMembers, setRemoveMembers] = React.useState(false)
  const { run, pending } = useAction()
  React.useEffect(() => {
    if (row) setRemoveMembers(false)
  }, [row])
  return (
    <Dialog open={!!row} onOpenChange={(o) => (!o && !pending ? onClose() : undefined)}>
      {row ? (
        <DialogContent title="Revoke this invite?" description="The link stops working immediately. People who already joined keep their access unless you remove them too.">
          {row.uses > 0 ? (
            <CheckboxField
              id="revoke-remove-members"
              checked={removeMembers}
              onCheckedChange={(v) => setRemoveMembers(v === true)}
              label={`Also remove the ${row.uses} member${row.uses === 1 ? '' : 's'} who joined through it`}
              description="The Owner is never removed."
            />
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={pending}
              onClick={async () => {
                const res = await run(() => revokeInvite(workspaceId, row.id, removeMembers), {
                  success: (d) => (d.removed ? `Invite revoked and ${d.removed} member${d.removed === 1 ? '' : 's'} removed.` : 'Invite revoked.'),
                })
                if (res.ok) onClose()
              }}
            >
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
