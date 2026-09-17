'use client'
import * as React from 'react'
import { CalendarClock, Crown, MoreVertical, UserMinus } from '@/components/ui/icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input, Label, Select } from '@/components/ui/input'
import { UserAvatar } from '@/components/app/avatar'
import { Absolute } from '@/components/app/time'
import { useAction } from '@/components/app/use-action'
import { changeMemberRole, removeMember, setMemberExpiry } from '@/lib/app/actions/members'
import { displayName, membershipSourceLabel } from '@/lib/app/format'

export interface MemberRow {
  membershipId: string
  userId: string
  user: {
    id: string
    name: string
    email: string
    image: string | null
    discordUsername: string | null
    discordAvatar: string | null
    discordUserId: string | null
  }
  roleId: string
  roleName: string
  roleColor: string
  isOwner: boolean
  source: string
  expiresAt: string | null
  createdAt: string
  /** The signed-in viewer may change this membership (not the Owner, and the role is within their reach). */
  editable: boolean
}

export interface RoleOption {
  id: string
  name: string
  color: string
  /** Assignable by the viewer (has every capability of the role). */
  grantable: boolean
}

export function MemberTable({
  workspaceId,
  rows,
  roles,
  meUserId,
}: {
  workspaceId: string
  rows: MemberRow[]
  roles: RoleOption[]
  meUserId: string
}) {
  const [expiry, setExpiry] = React.useState<MemberRow | null>(null)
  const [removing, setRemoving] = React.useState<MemberRow | null>(null)
  const { run, pending } = useAction()

  return (
    <>
      <div data-tinted="" className="overflow-x-auto rounded-2xl bg-surface-2 p-2">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="text-left text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            <tr>
              <th className="px-3 py-3">Member</th>
              <th className="px-2 py-2.5">Role</th>
              <th className="px-2 py-2.5">Access via</th>
              <th className="px-2 py-2.5">Expires</th>
              <th className="w-12 px-2 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.membershipId} className="transition-colors hover:bg-surface-3/60">
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar user={m.user} size={30} />
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate font-medium">
                        {displayName(m.user)}
                        {m.userId === meUserId ? (
                          <span className="text-xs font-normal text-fg-subtle">(you)</span>
                        ) : null}
                      </p>
                      <p className="truncate text-xs text-fg-muted">
                        {m.user.discordUsername ? `@${m.user.discordUsername}` : m.user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-3">
                  {m.isOwner ? (
                    <Badge tone="pink">
                      <Crown className="size-3" aria-hidden /> Owner
                    </Badge>
                  ) : m.editable ? (
                    <Select
                      aria-label={`Role for ${displayName(m.user)}`}
                      value={m.roleId}
                      disabled={pending}
                      onChange={(e) =>
                        run(() => changeMemberRole(workspaceId, m.membershipId, e.target.value), {
                          success: 'Role updated.',
                        })
                      }
                      className="h-8 w-40 rounded-lg text-xs"
                    >
                      {roles.map((r) => (
                        <option
                          key={r.id}
                          value={r.id}
                          disabled={!r.grantable && r.id !== m.roleId}
                        >
                          {r.name}
                          {!r.grantable && r.id !== m.roleId ? ' (beyond your permissions)' : ''}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="size-2 rounded-full"
                        style={{ background: m.roleColor }}
                        aria-hidden
                      />
                      {m.roleName}
                    </span>
                  )}
                </td>
                <td className="px-2 py-3 text-xs text-fg-muted">
                  {membershipSourceLabel(m.source)}
                </td>
                <td className="px-2 py-3 text-xs text-fg-muted">
                  {m.expiresAt ? (
                    <Absolute date={m.expiresAt} withTime={false} />
                  ) : (
                    <span className="text-fg-subtle">Never</span>
                  )}
                </td>
                <td className="px-2 py-3">
                  {m.editable ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex size-8 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg data-[state=open]:bg-surface-3"
                        aria-label={`Actions for ${displayName(m.user)}`}
                      >
                        <MoreVertical className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onSelect={() => setExpiry(m)}>
                          <CalendarClock className="size-4" /> Set expiry
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem destructive onSelect={() => setRemoving(m)}>
                          <UserMinus className="size-4" /> Remove from workspace
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ExpiryDialog
        key={expiry?.membershipId ?? 'closed'}
        workspaceId={workspaceId}
        row={expiry}
        onClose={() => setExpiry(null)}
      />
      <RemoveDialog workspaceId={workspaceId} row={removing} onClose={() => setRemoving(null)} />
    </>
  )
}

function ExpiryDialog({
  workspaceId,
  row,
  onClose,
}: {
  workspaceId: string
  row: MemberRow | null
  onClose: () => void
}) {
  // Keyed by membership at the call site, so a fresh row mounts a fresh form.
  const [value, setValue] = React.useState(row?.expiresAt ? row.expiresAt.slice(0, 10) : '')
  const { run, pending } = useAction()
  return (
    <Dialog open={!!row} onOpenChange={(o) => (!o && !pending ? onClose() : undefined)}>
      {row ? (
        <DialogContent
          title={`Access expiry for ${displayName(row.user)}`}
          description="Handy for event DJs. Leave the date empty to make the membership permanent."
        >
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault()
              const res = await run(
                () =>
                  setMemberExpiry(
                    workspaceId,
                    row.membershipId,
                    value ? new Date(`${value}T23:59:59`).toISOString() : null,
                  ),
                { success: 'Expiry updated.' },
              )
              if (res.ok) onClose()
            }}
          >
            <div>
              <Label htmlFor="member-expiry">Expires on</Label>
              <Input
                id="member-expiry"
                type="date"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function RemoveDialog({
  workspaceId,
  row,
  onClose,
}: {
  workspaceId: string
  row: MemberRow | null
  onClose: () => void
}) {
  const { run, pending } = useAction()
  return (
    <Dialog open={!!row} onOpenChange={(o) => (!o && !pending ? onClose() : undefined)}>
      {row ? (
        <DialogContent
          title={`Remove ${displayName(row.user)}?`}
          description="They lose web access right away. Songs they added stay. They can come back through a Discord role, a share link or an invite."
        >
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={pending}
              onClick={async () => {
                const res = await run(() => removeMember(workspaceId, row.membershipId), {
                  success: 'Member removed.',
                })
                if (res.ok) onClose()
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}
