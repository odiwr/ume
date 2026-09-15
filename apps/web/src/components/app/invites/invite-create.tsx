'use client'
import * as React from 'react'
import { Link2, Mail } from 'lucide-react'
import { INVITE } from '@ume/shared'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input, Label, Select } from '@/components/ui/input'
import { CopyButton } from '@/components/app/copy-button'
import { useAction } from '@/components/app/use-action'
import { createEmailInvite, createLinkInvite } from '@/lib/app/actions/invites'

export interface InviteRoleOption {
  id: string
  name: string
  /** Allowed on share links (contributor-level roles only). */
  byLink: boolean
  /** Allowed on email invites (anything but Owner-only capabilities). */
  byEmail: boolean
  /** The viewer holds every capability of the role. */
  grantable: boolean
}

type Kind = 'link' | 'email'

export function CreateInviteButtons({ workspaceId, roles }: { workspaceId: string; roles: InviteRoleOption[] }) {
  const [kind, setKind] = React.useState<Kind | null>(null)
  return (
    <>
      <Button variant="outline" onClick={() => setKind('email')}>
        <Mail className="size-4" /> Email invite
      </Button>
      <Button onClick={() => setKind('link')}>
        <Link2 className="size-4" /> Share link
      </Button>
      <CreateInviteDialog workspaceId={workspaceId} roles={roles} kind={kind} onClose={() => setKind(null)} />
    </>
  )
}

function CreateInviteDialog({ workspaceId, roles, kind, onClose }: { workspaceId: string; roles: InviteRoleOption[]; kind: Kind | null; onClose: () => void }) {
  const eligible = roles.filter((r) => r.grantable && (kind === 'link' ? r.byLink : r.byEmail))
  const [roleId, setRoleId] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [expiresInDays, setExpiresInDays] = React.useState(String(INVITE.defaultExpiryDays))
  const [maxUses, setMaxUses] = React.useState('')
  const [membershipExpiresAt, setMembershipExpiresAt] = React.useState('')
  const [requireGuildMember, setRequireGuildMember] = React.useState(true)
  const [created, setCreated] = React.useState<{ url: string } | { sent: boolean; email: string } | null>(null)
  const { run, pending } = useAction()

  React.useEffect(() => {
    if (kind) {
      setCreated(null)
      setRoleId(eligible[0]?.id ?? '')
      setEmail('')
      setLabel('')
      setExpiresInDays(String(INVITE.defaultExpiryDays))
      setMaxUses('')
      setMembershipExpiresAt('')
      setRequireGuildMember(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  const isLink = kind === 'link'
  return (
    <Dialog open={!!kind} onOpenChange={(o) => (!o && !pending ? onClose() : undefined)}>
      {kind ? (
        <DialogContent
          title={isLink ? 'New share link' : 'New email invite'}
          description={
            isLink
              ? 'Anyone holding the link gets the role, so links are limited to contributor roles. Requiring Discord server membership is on by default.'
              : 'Bound to one address and verified at sign-in. This is the only way to hand out Master-level roles.'
          }
        >
          {created ? (
            <div className="space-y-4">
              {'url' in created ? (
                <>
                  <p className="text-sm text-fg-muted [text-wrap:pretty]">Copy it now. It is listed on this page too, so you can copy it again later.</p>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={created.url} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" aria-label="Invite link" />
                    <CopyButton value={created.url} label="Copy link" />
                  </div>
                </>
              ) : (
                <p className="rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success [text-wrap:pretty]">
                  {created.sent
                    ? `Invite sent to ${created.email}. It expires in ${expiresInDays} day${expiresInDays === '1' ? '' : 's'}.`
                    : `The invite for ${created.email} was created, but the email could not be sent. Revoke it and try again, or share the link from the list below.`}
                </p>
              )}
              <DialogFooter>
                <Button type="button" onClick={onClose}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                const input = {
                  roleId,
                  expiresInDays: Number(expiresInDays),
                  maxUses: isLink && maxUses ? Number(maxUses) : null,
                  membershipExpiresAt: membershipExpiresAt ? new Date(`${membershipExpiresAt}T23:59:59`).toISOString() : null,
                  requireGuildMember,
                  label: label || null,
                  email: isLink ? undefined : email,
                }
                if (isLink) {
                  const res = await run(() => createLinkInvite(workspaceId, input), { success: 'Share link created.' })
                  if (res.ok) setCreated({ url: res.data.url })
                } else {
                  const res = await run(() => createEmailInvite(workspaceId, input), { success: (d) => (d.sent ? 'Invite emailed.' : null) })
                  if (res.ok) setCreated({ sent: res.data.sent, email })
                }
              }}
            >
              {!isLink ? (
                <div>
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="dj@example.com" required autoFocus />
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="invite-role">Role</Label>
                  <Select id="invite-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} required>
                    {eligible.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                  {isLink && roles.some((r) => r.grantable && !r.byLink) ? (
                    <p className="mt-1 text-xs text-fg-muted">Roles that can delete or manage things need an email invite.</p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="invite-expiry">Invite expires in</Label>
                  <Select id="invite-expiry" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)}>
                    {[1, 3, 7, 14, 30, 90, 365].map((d) => (
                      <option key={d} value={d}>
                        {d} day{d === 1 ? '' : 's'}
                      </option>
                    ))}
                  </Select>
                </div>
                {isLink ? (
                  <div>
                    <Label htmlFor="invite-uses">Max uses</Label>
                    <Input id="invite-uses" type="number" min={1} max={10000} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="Unlimited" />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="invite-membership-expiry">Access ends on</Label>
                  <Input
                    id="invite-membership-expiry"
                    type="date"
                    value={membershipExpiresAt}
                    onChange={(e) => setMembershipExpiresAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                  />
                  <p className="mt-1 text-xs text-fg-muted">Optional. Members who join through this invite lose access on that date.</p>
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="invite-label">Label (optional)</Label>
                  <Input id="invite-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="Summer party DJs" />
                </div>
              </div>
              <CheckboxField
                id="invite-guild-member"
                checked={requireGuildMember}
                onCheckedChange={(v) => setRequireGuildMember(v === true)}
                label="Require membership of the Discord server"
                description="Ume checks that the person is in the server before accepting."
              />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" loading={pending} disabled={!roleId || (!isLink && !email)}>
                  {isLink ? 'Create link' : 'Send invite'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
