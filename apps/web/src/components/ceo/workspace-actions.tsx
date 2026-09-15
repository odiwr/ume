import { PLANS, formatBytes } from '@ume/shared'
import { Clock, Link2, Link2Off, RotateCcw, ShieldAlert, Unplug } from 'lucide-react'
import {
  disconnectWorkspaceAction,
  purgeWorkspaceAction,
  resetInactivityClockAction,
  resetWorkspaceAction,
  setPlanAction,
  setQuotaOverrideAction,
  toggleLinkExtractAction,
} from '@/lib/ceo/actions'
import { ActionButton, ActionForm, ActionSubmit } from '@/components/ceo/action-form'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Select } from '@/components/ui/input'
import type { Workspace } from '@/lib/db'

/** Admin overrides + danger zone for one workspace. Server component; forms are client islands. */
export function WorkspaceActions({ ws, quotaBytes }: { ws: Workspace; quotaBytes: number }) {
  const terminal = ws.status === 'purging' || ws.status === 'purged'
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Storage quota override</CardTitle>
          <CardDescription>
            Effective quota is {formatBytes(quotaBytes)}
            {ws.storageQuotaOverrideBytes !== null ? ' (override)' : ` (from the ${ws.plan} plan)`}.
            Leave empty to clear the override.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setQuotaOverrideAction}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="workspaceId" value={ws.id} />
            <div className="flex-1">
              <Label htmlFor="quota-bytes">Bytes</Label>
              <Input
                id="quota-bytes"
                name="bytes"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                defaultValue={ws.storageQuotaOverrideBytes ?? ''}
                placeholder={`e.g. ${5 * 1024 ** 3} for 5 GB`}
                disabled={terminal}
              />
            </div>
            <ActionSubmit variant="secondary" disabled={terminal}>
              Save quota
            </ActionSubmit>
          </ActionForm>
          <p className="mt-2 text-xs text-fg-subtle">
            1 GB = {(1024 ** 3).toLocaleString('en-US')} bytes.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plan override</CardTitle>
          <CardDescription>
            Changes the tier in Ume only. Stripe is not called; use this for comps, refunds already
            handled, or testing.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionForm
            action={setPlanAction}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <input type="hidden" name="workspaceId" value={ws.id} />
            <div className="flex-1">
              <Label htmlFor="plan">Plan</Label>
              <Select id="plan" name="plan" defaultValue={ws.plan} disabled={terminal}>
                {PLANS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatBytes(p.storageBytes)}
                    {p.priceUsdMonthly ? ` · $${p.priceUsdMonthly}/mo` : ' · free'}
                  </option>
                ))}
              </Select>
            </div>
            <ActionSubmit variant="secondary" disabled={terminal}>
              Set plan
            </ActionSubmit>
          </ActionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Inactivity clock</CardTitle>
          <CardDescription>
            Sets last activity to now and clears the 30-day / 48-hour notice markers. Use it when a
            purge notice went out by mistake.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={resetInactivityClockAction}
            fields={{ workspaceId: ws.id }}
            variant="secondary"
            disabled={terminal}
          >
            <Clock className="size-4" /> Reset inactivity clock
          </ActionButton>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Link extractor</CardTitle>
          <CardDescription>
            {ws.linkExtractEnabled
              ? 'On for this workspace. Links are extracted to Opus when the global link_extract flag is also on.'
              : 'Off for this workspace. New links are stored as metadata-only entries; existing extracted tracks keep playing.'}
            {ws.linkExtractAcceptedAt
              ? ' The Owner accepted the rights attestation.'
              : ' The Owner has not accepted the rights attestation yet, so nothing has been extracted here.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={toggleLinkExtractAction}
            fields={{ workspaceId: ws.id, enabled: ws.linkExtractEnabled ? 'false' : 'true' }}
            variant="secondary"
            disabled={terminal}
          >
            {ws.linkExtractEnabled ? (
              <>
                <Link2Off className="size-4" /> Turn off for this workspace
              </>
            ) : (
              <>
                <Link2 className="size-4" /> Turn on for this workspace
              </>
            )}
          </ActionButton>
        </CardContent>
      </Card>

      <Card className="border-danger/30 lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-danger">
            <ShieldAlert className="size-4" /> Danger zone
          </CardTitle>
          <CardDescription>Each of these is logged with your account as the actor.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div className="text-sm">
              <p className="font-medium">Disconnect</p>
              <p className="text-xs text-fg-muted">
                Read-only until an admin runs /reload and enters the new token.
              </p>
            </div>
            <ActionButton
              action={disconnectWorkspaceAction}
              fields={{ workspaceId: ws.id }}
              variant="outline"
              size="sm"
              disabled={ws.status !== 'connected'}
              confirm={`Disconnect "${ws.guildName}"? Members lose write access until the token is re-entered.`}
            >
              <Unplug className="size-4" /> Disconnect
            </ActionButton>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
            <div className="text-sm">
              <p className="font-medium">Reset members</p>
              <p className="text-xs text-fg-muted">
                Removes every member except the Owner and revokes all invites. Music stays.
              </p>
            </div>
            <ActionButton
              action={resetWorkspaceAction}
              fields={{ workspaceId: ws.id }}
              variant="outline"
              size="sm"
              disabled={terminal}
              confirm={`Reset "${ws.guildName}"? Everyone except the Owner is removed and all invites are revoked.`}
            >
              <RotateCcw className="size-4" /> Reset
            </ActionButton>
          </div>

          <div className="rounded-xl border border-danger/30 bg-danger/5 p-3">
            <p className="text-sm font-medium text-danger">Purge workspace</p>
            <p className="mt-0.5 text-xs text-fg-muted">
              Queues the purge job: every track, playlist, member and invite is deleted and storage
              is wiped. Cannot be undone. Type the Ume ID to confirm.
            </p>
            <ActionForm
              action={purgeWorkspaceAction}
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              resetOnSuccess
            >
              <input type="hidden" name="workspaceId" value={ws.id} />
              <Input
                name="confirm"
                placeholder={ws.umeId}
                autoComplete="off"
                spellCheck={false}
                disabled={terminal}
                className="font-mono text-xs"
              />
              <ActionSubmit variant="danger" disabled={terminal}>
                Purge forever
              </ActionSubmit>
            </ActionForm>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
