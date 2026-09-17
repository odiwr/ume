'use client'
import * as React from 'react'
import { Check, Crown, Lock, Plus, Trash } from '@/components/ui/icons'
import { CAP, CAP_LABELS, OWNER_ONLY_CAPS, hasCap, type CapabilityName } from '@ume/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { useAction } from '@/components/app/use-action'
import { createRole, deleteRole, updateRole } from '@/lib/app/actions/roles'
import { cn } from '@/lib/utils'

export interface EditableRole {
  id: string
  name: string
  description: string | null
  color: string
  capabilities: number
  systemKey: 'owner' | 'master' | 'servant' | 'peon' | null
  memberCount: number
}

const CAP_ORDER = Object.keys(CAP) as CapabilityName[]
const COLORS = [
  '#E464B0',
  '#B5C1B4',
  '#D6CABF',
  '#B3B3B3',
  '#5AD07B',
  '#F2B84B',
  '#F0556B',
  '#F2F2F2',
]

/** Capability editor per role. Owner-only capabilities are always locked for non-Owner roles. */
export function RoleEditor({
  workspaceId,
  roles,
  viewerCaps,
  viewerIsOwner,
  viewerRoleId,
}: {
  workspaceId: string
  roles: EditableRole[]
  viewerCaps: number
  viewerIsOwner: boolean
  viewerRoleId: string | null
}) {
  const [creating, setCreating] = React.useState(false)
  const canGrant = (cap: number) => viewerIsOwner || hasCap(viewerCaps, cap)
  return (
    <div className="space-y-5">
      {roles.map((role) => (
        <RoleCard
          key={role.id}
          workspaceId={workspaceId}
          role={role}
          canGrant={canGrant}
          viewerIsOwner={viewerIsOwner}
          isMine={role.id === viewerRoleId}
        />
      ))}
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> New custom role
        </Button>
      </div>
      <CreateRoleDialog
        workspaceId={workspaceId}
        open={creating}
        onClose={() => setCreating(false)}
        canGrant={canGrant}
      />
    </div>
  )
}

function CapabilityGrid({
  value,
  onChange,
  canGrant,
  locked,
}: {
  value: number
  onChange: (next: number) => void
  canGrant: (cap: number) => boolean
  locked: boolean
}) {
  const prefix = React.useId()
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {CAP_ORDER.map((key) => {
        const cap = CAP[key]
        const ownerOnly = (cap & OWNER_ONLY_CAPS) !== 0
        const disabled = locked || ownerOnly || !canGrant(cap)
        const checked = hasCap(value, cap)
        const id = `${prefix}-${key}`
        const item = (
          <label
            htmlFor={id}
            className={cn(
              'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors',
              checked ? 'bg-blush' : 'bg-surface-2 in-data-tinted:bg-surface',
              disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-surface-3',
            )}
          >
            <Checkbox
              id={id}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(v) => onChange(v === true ? value | cap : value & ~cap)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-sm font-medium">
                {CAP_LABELS[key].label}
                {ownerOnly ? <Crown className="size-3 text-pink" aria-hidden /> : null}
              </span>
              <span className="block text-xs text-fg-muted">{CAP_LABELS[key].description}</span>
            </span>
          </label>
        )
        if (ownerOnly)
          return (
            <Tooltip
              key={key}
              content="Owner only. No other role can hold this, even a custom one."
            >
              {item}
            </Tooltip>
          )
        if (!locked && !canGrant(cap))
          return (
            <Tooltip key={key} content="You cannot grant a permission you do not hold yourself.">
              {item}
            </Tooltip>
          )
        return <React.Fragment key={key}>{item}</React.Fragment>
      })}
    </div>
  )
}

function RoleCard({
  workspaceId,
  role,
  canGrant,
  viewerIsOwner,
  isMine,
}: {
  workspaceId: string
  role: EditableRole
  canGrant: (cap: number) => boolean
  viewerIsOwner: boolean
  isMine: boolean
}) {
  const [name, setName] = React.useState(role.name)
  const [color, setColor] = React.useState(role.color)
  const [caps, setCaps] = React.useState(role.capabilities)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const { run, pending } = useAction()
  const isOwnerRole = role.systemKey === 'owner'
  const outranks =
    !viewerIsOwner && CAP_ORDER.some((k) => hasCap(role.capabilities, CAP[k]) && !canGrant(CAP[k]))
  const locked = isOwnerRole || outranks
  const dirty = name !== role.name || color !== role.color || caps !== role.capabilities

  // Follow the saved role after a refresh, adjusting state during render instead of in an effect.
  const [synced, setSynced] = React.useState({
    name: role.name,
    color: role.color,
    capabilities: role.capabilities,
  })
  if (
    synced.name !== role.name ||
    synced.color !== role.color ||
    synced.capabilities !== role.capabilities
  ) {
    setSynced({ name: role.name, color: role.color, capabilities: role.capabilities })
    setName(role.name)
    setColor(role.color)
    setCaps(role.capabilities)
  }

  return (
    <form
      data-tinted=""
      className="rounded-2xl bg-surface-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (locked) return
        run(() => updateRole(workspaceId, role.id, { name, color, capabilities: caps }), {
          success: `“${name}” saved.`,
        })
      }}
    >
      <div className="flex flex-wrap items-center gap-3 px-5 pt-5">
        <span className="size-3 rounded-full" style={{ background: color }} aria-hidden />
        {locked ? (
          <h3 className="font-display text-base font-semibold">{role.name}</h3>
        ) : (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={32}
            required
            aria-label="Role name"
            className="h-8 w-44 rounded-lg"
          />
        )}
        {role.systemKey ? (
          <Badge tone={isOwnerRole ? 'pink' : 'default'}>
            {isOwnerRole ? 'Owner' : 'System role'}
          </Badge>
        ) : (
          <Badge tone="sage">Custom</Badge>
        )}
        {isMine ? <Badge tone="beige">Your role</Badge> : null}
        <span className="ml-auto text-xs text-fg-muted tabular-nums">
          {role.memberCount} {role.memberCount === 1 ? 'member' : 'members'}
        </span>
      </div>
      <div className="space-y-5 p-5">
        {role.description ? (
          <p className="text-sm text-fg-muted [text-wrap:pretty]">{role.description}</p>
        ) : null}
        {isOwnerRole ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Lock className="size-4" aria-hidden /> The Owner holds every capability. Ownership
            follows the Discord server owner and cannot be edited here.
          </p>
        ) : outranks ? (
          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Lock className="size-4" aria-hidden /> This role has permissions you do not hold, so
            you cannot edit it.
          </p>
        ) : null}
        <CapabilityGrid value={caps} onChange={setCaps} canGrant={canGrant} locked={locked} />
        {!locked ? (
          <div className="flex flex-wrap items-center gap-3">
            <div
              className="flex flex-wrap items-center gap-2"
              role="radiogroup"
              aria-label="Role color"
            >
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className="flex size-7 items-center justify-center rounded-full text-fg transition-transform hover:scale-110"
                  style={{ background: c }}
                >
                  {color === c ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!role.systemKey ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  disabled={pending}
                >
                  <Trash className="size-3.5" /> Delete
                </Button>
              ) : null}
              <Button type="submit" size="sm" loading={pending} disabled={!dirty || !name.trim()}>
                Save changes
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <Dialog
        open={confirmDelete}
        onOpenChange={(o) => (!o && !pending ? setConfirmDelete(false) : undefined)}
      >
        <DialogContent
          title={`Delete “${role.name}”?`}
          description={
            role.memberCount
              ? `${role.memberCount} member${role.memberCount === 1 ? '' : 's'} holding it will become Listener (browse and playback only).`
              : 'Nobody holds this role.'
          }
        >
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              loading={pending}
              onClick={async () => {
                const res = await run(() => deleteRole(workspaceId, role.id), {
                  success: 'Role deleted.',
                })
                if (res.ok) setConfirmDelete(false)
              }}
            >
              Delete role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}

function CreateRoleDialog({
  workspaceId,
  open,
  onClose,
  canGrant,
}: {
  workspaceId: string
  open: boolean
  onClose: () => void
  canGrant: (cap: number) => boolean
}) {
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState(COLORS[3]!)
  const [caps, setCaps] = React.useState<number>(CAP.VIEW_LIBRARY | CAP.CONTROL_PLAYBACK)
  const { run, pending } = useAction()
  return (
    <Dialog open={open} onOpenChange={(o) => (!o && !pending ? onClose() : undefined)}>
      <DialogContent title="New custom role" className="max-w-2xl">
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault()
            const res = await run(
              () => createRole(workspaceId, { name, color, capabilities: caps }),
              { success: `“${name}” created.` },
            )
            if (res.ok) {
              onClose()
              setName('')
              setCaps(CAP.VIEW_LIBRARY | CAP.CONTROL_PLAYBACK)
            }
          }}
        >
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <Label htmlFor="new-role-name">Name</Label>
              <Input
                id="new-role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={32}
                placeholder="Event DJ"
                required
                autoFocus
              />
            </div>
            <div
              className="flex flex-wrap items-center gap-2 pb-2"
              role="radiogroup"
              aria-label="Role color"
            >
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  onClick={() => setColor(c)}
                  className="flex size-7 items-center justify-center rounded-full text-fg transition-transform hover:scale-110"
                  style={{ background: c }}
                >
                  {color === c ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
                </button>
              ))}
            </div>
          </div>
          <CapabilityGrid value={caps} onChange={setCaps} canGrant={canGrant} locked={false} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={!name.trim()}>
              Create role
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
