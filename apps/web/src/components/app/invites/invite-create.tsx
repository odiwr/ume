'use client'
import * as React from 'react'
import { toast } from 'sonner'
import { Link2, Mail } from '@/components/ui/icons'
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

export function CreateInviteButtons({
  workspaceId,
  roles,
}: {
  workspaceId: string
  roles: InviteRoleOption[]
}) {
  const [kind, setKind] = React.useState<Kind | null>(null)
  return (
    <>
      <Button variant="outline" onClick={() => setKind('email')}>
        <Mail className="size-4" /> Email invite
      </Button>
      <Button onClick={() => setKind('link')}>
        <Link2 className="size-4" /> Share link
      </Button>
      <CreateInviteDialog
        key={kind ?? 'closed'}
        workspaceId={workspaceId}
        roles={roles}
        kind={kind}
        onClose={() => setKind(null)}
      />
    </>
  )
}

function CreateInviteDialog({
  workspaceId,
  roles,
  kind,
  onClose,
}: {
  workspaceId: string
  roles: InviteRoleOption[]
  kind: Kind | null
  onClose: () => void
}) {
  // Keyed by kind at the call site, so every open starts from a clean form.
  const eligible = roles.filter((r) => r.grantable && (kind === 'link' ? r.byLink : r.byEmail))
  const [roleId, setRoleId] = React.useState(eligible[0]?.id ?? '')
  const [email, setEmail] = React.useState('')
  const [label, setLabel] = React.useState('')
  const [expiresInDays, setExpiresInDays] = React.useState(String(INVITE.defaultExpiryDays))
  const [maxUses, setMaxUses] = React.useState('')
  const [membershipExpiresAt, setMembershipExpiresAt] = React.useState('')
  const [requireGuildMember, setRequireGuildMember] = React.useState(true)
  const [created, setCreated] = React.useState<
    | { url: string }
    | { sent: boolean; sendError?: 'not_configured' | 'failed'; url: string; email: string }
    | null
  >(null)
  const { run, pending } = useAction()

  const isLink = kind === 'link'
  return (
    <Dialog open={!!kind} onOpenChange={(o) => (!o && !pending ? onClose() : undefined)}>
      {kind ? (
        <DialogContent
          title={isLink ? 'New share link' : 'New email invite'}
          description={
            isLink
              ? 'Anyone with the link gets the role, so only contributor roles are offered.'
              : 'Only this address can accept it. Admin-level roles need an email invite.'
          }
        >
          {created ? (
            <div className="space-y-4">
              {!('sent' in created) ? (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      readOnly
                      value={created.url}
                      onFocus={(e) => e.currentTarget.select()}
                      className="font-mono text-xs"
                      aria-label="Invite link"
                    />
                    <CopyButton value={created.url} label="Copy link" />
                  </div>
                </>
              ) : created.sent ? (
                <p className="rounded-xl bg-success/10 px-4 py-3 text-sm text-success [text-wrap:pretty]">
                  Invite sent to {created.email}. It expires in {expiresInDays} day
                  {expiresInDays === '1' ? '' : 's'}.
                </p>
              ) : (
                <>
                  <p className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-fg [text-wrap:pretty]">
                    {created.sendError === 'not_configured'
                      ? `Email is not configured on this server, so nothing was sent to ${created.email}. Copy the link and send it yourself; only ${created.email} can accept it.`
                      : `The invite for ${created.email} was created, but the email could not be sent. Copy the link and send it yourself, or revoke it and try again.`}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      readOnly
                      value={created.url}
                      onFocus={(e) => e.currentTarget.select()}
                      className="font-mono text-xs"
                      aria-label="Invite link"
                    />
                    <CopyButton value={created.url} label="Copy link" />
                  </div>
                </>
              )}
              <DialogFooter>
                <Button type="button" onClick={onClose}>
                  Done
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={async (e) => {
                e.preventDefault()
                const input = {
                  roleId,
                  expiresInDays: Number(expiresInDays),
                  maxUses: isLink && maxUses ? Number(maxUses) : null,
                  membershipExpiresAt: membershipExpiresAt
                    ? new Date(`${membershipExpiresAt}T23:59:59`).toISOString()
                    : null,
                  requireGuildMember,
                  label: label || null,
                  email: isLink ? undefined : email,
                }
                if (isLink) {
                  const res = await run(() => createLinkInvite(workspaceId, input), {
                    success: 'Share link created.',
                  })
                  if (res.ok) setCreated({ url: res.data.url })
                } else {
                  const res = await run(() => createEmailInvite(workspaceId, input), {
                    success: (d) => (d.sent ? 'Invite emailed.' : null),
                  })
                  if (res.ok) {
                    if (!res.data.sent) {
                      toast.warning(
                        res.data.sendError === 'not_configured'
                          ? 'Email is not configured; copy the link instead.'
                          : 'The invite email could not be sent; copy the link instead.',
                      )
                    }
                    setCreated({
                      sent: res.data.sent,
                      sendError: res.data.sendError,
                      url: res.data.url,
                      email,
                    })
                  }
                }
              }}
            >
              {!isLink ? (
                <div>
                  <Label htmlFor="invite-email">Email address</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="dj@example.com"
                    required
                    autoFocus
                  />
                </div>
              ) : null}
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="invite-role">Role</Label>
                  <Select
                    id="invite-role"
                    value={roleId}
                    onChange={(e) => setRoleId(e.target.value)}
                    required
                  >
                    {eligible.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                  {isLink && roles.some((r) => r.grantable && !r.byLink) ? (
                    <p className="mt-1.5 text-xs text-fg-muted">
                      Roles that can delete or manage things need an email invite.
                    </p>
                  ) : null}
                </div>
                <div>
                  <Label htmlFor="invite-expiry">Invite expires in</Label>
                  <Select
                    id="invite-expiry"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(e.target.value)}
                  >
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
                    <Input
                      id="invite-uses"
                      type="number"
                      min={1}
                      max={10000}
                      value={maxUses}
                      onChange={(e) => setMaxUses(e.target.value)}
                      placeholder="Unlimited"
                    />
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="invite-membership-expiry">Access ends on (optional)</Label>
                  <Input
                    id="invite-membership-expiry"
                    type="date"
                    value={membershipExpiresAt}
                    onChange={(e) => setMembershipExpiresAt(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="invite-label">Label (optional)</Label>
                  <Input
                    id="invite-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    maxLength={80}
                    placeholder="Summer party DJs"
                  />
                </div>
              </div>
              <CheckboxField
                id="invite-guild-member"
                checked={requireGuildMember}
                onCheckedChange={(v) => setRequireGuildMember(v === true)}
                label="Require membership of the Discord server"
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
