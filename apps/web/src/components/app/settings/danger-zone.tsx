'use client'
import * as React from 'react'
import { Trash, UserMinus } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { useAction } from '@/components/app/use-action'
import { purgeWorkspace, resetWorkspace } from '@/lib/app/actions/danger'

type Action = 'reset' | 'purge'

/** Owner only. Both actions require typing the server name exactly, mirroring ~confirm CODE in Discord. */
export function DangerZone({
  workspaceId,
  guildName,
  memberCount,
  status,
}: {
  workspaceId: string
  guildName: string
  memberCount: number
  status: string
}) {
  const [action, setAction] = React.useState<Action | null>(null)
  const [typed, setTyped] = React.useState('')
  const { run, pending } = useAction()
  const others = Math.max(0, memberCount - 1)
  const purging = status === 'purging'

  const openDialog = (next: Action) => {
    setTyped('')
    setAction(next)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-4 rounded-2xl bg-danger/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">Reset the workspace</p>
          <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">
            Removes every web member except you ({others} {others === 1 ? 'person' : 'people'}),
            revokes all invites and disconnects the workspace until a new token is entered.
            Playlists and music stay.
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => openDialog('reset')}
          disabled={purging}
          className="shrink-0"
        >
          <UserMinus className="size-3.5" /> Reset
        </Button>
      </div>
      <div className="flex flex-col gap-4 rounded-2xl bg-danger/5 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-medium">Purge everything</p>
          <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">
            Deletes playlists, music, members, invites and settings. The bot leaves the workspace
            behind. There is no undo.
          </p>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={() => openDialog('purge')}
          disabled={purging}
          className="shrink-0"
        >
          <Trash className="size-3.5" /> {purging ? 'Purging' : 'Purge'}
        </Button>
      </div>

      <Dialog open={!!action} onOpenChange={(o) => (!o && !pending ? setAction(null) : undefined)}>
        {action ? (
          <DialogContent
            title={action === 'reset' ? 'Reset this workspace?' : 'Purge this workspace?'}
            description={
              action === 'reset'
                ? 'Everyone except you loses web access and every invite stops working. You will need to run /reload in Discord and enter the new token to reconnect.'
                : 'Everything is deleted permanently: every playlist, every stored track, every member. Ume will forget this server existed.'
            }
          >
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault()
                const res =
                  action === 'reset'
                    ? await run(() => resetWorkspace(workspaceId, typed), {
                        success: (d) =>
                          `Workspace reset. ${d.removed} member${d.removed === 1 ? '' : 's'} removed.`,
                      })
                    : await run(() => purgeWorkspace(workspaceId, typed), { refresh: false })
                if (res.ok) setAction(null)
              }}
            >
              <div>
                <Label htmlFor="danger-typed">
                  Type <span className="normal-case tracking-normal text-fg">{guildName}</span> to
                  confirm
                </Label>
                <Input
                  id="danger-typed"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  placeholder={guildName}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAction(null)}
                  disabled={pending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  loading={pending}
                  disabled={typed.trim() !== guildName.trim()}
                >
                  {action === 'reset' ? 'Reset workspace' : 'Purge everything'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </div>
  )
}
