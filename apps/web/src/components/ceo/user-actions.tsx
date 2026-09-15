import { Ban, RotateCcw } from 'lucide-react'
import { banUserAction, unbanUserAction } from '@/lib/ceo/actions'
import { ActionButton, ActionForm, ActionSubmit } from '@/components/ceo/action-form'
import { Input, Label } from '@/components/ui/input'

/** Compact ban / unban control. `inline` renders a one-click variant for table rows. */
export function UserBanControl({
  userId,
  email,
  banned,
  banReason,
  inline,
  isSelf,
}: {
  userId: string
  email: string
  banned: boolean
  banReason?: string | null
  inline?: boolean
  isSelf?: boolean
}) {
  if (isSelf) return <span className="text-xs text-fg-subtle">you</span>
  if (banned) {
    return (
      <ActionButton action={unbanUserAction} fields={{ userId }} variant={inline ? 'ghost' : 'secondary'} size="sm" confirm={`Lift the ban on ${email}?`}>
        <RotateCcw className="size-3.5" /> Unban
      </ActionButton>
    )
  }
  if (inline) {
    return (
      <ActionButton action={banUserAction} fields={{ userId, reason: '' }} variant="ghost" size="sm" confirm={`Ban ${email}? They are signed out everywhere and cannot sign in.`}>
        <Ban className="size-3.5" /> Ban
      </ActionButton>
    )
  }
  return (
    <ActionForm action={banUserAction} className="flex flex-col gap-3 sm:flex-row sm:items-end" confirm={`Ban ${email}? They are signed out everywhere and cannot sign in.`}>
      <input type="hidden" name="userId" value={userId} />
      <div className="flex-1">
        <Label htmlFor="ban-reason">Reason (internal)</Label>
        <Input id="ban-reason" name="reason" defaultValue={banReason ?? ''} placeholder="e.g. repeat DMCA infringer, abuse" maxLength={500} />
      </div>
      <ActionSubmit variant="danger">
        <Ban className="size-4" /> Ban user
      </ActionSubmit>
    </ActionForm>
  )
}
