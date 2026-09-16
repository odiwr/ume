'use client'
import * as React from 'react'
import { Label, Select } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useAction } from '@/components/app/use-action'
import { setDefaultRole, setRoleSync, upsertRoleMap } from '@/lib/app/actions/members'
import type { RoleOption } from '@/components/app/members/member-table'

export interface DiscordRoleRow {
  id: string
  name: string
  color: string | null
  managed: boolean
  isEveryone: boolean
  mappedRoleId: string | null
}

/**
 * Discord role -> Ume role mapping. Most servers never need invites: map @DJ to
 * Contributor and @everyone to Listener and members get in the moment they sign in.
 */
export function RoleMapEditor({
  workspaceId,
  discordRoles,
  roles,
  defaultRoleId,
  syncEnabled,
  loadError,
}: {
  workspaceId: string
  discordRoles: DiscordRoleRow[]
  roles: RoleOption[]
  defaultRoleId: string | null
  syncEnabled: boolean
  loadError: string | null
}) {
  const { run, pending } = useAction()
  const mapped = discordRoles.filter((r) => r.mappedRoleId).length

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
        <div className="min-w-0">
          <p className="font-medium">Apply Discord roles at sign-in</p>
          <p className="mt-1 text-xs text-fg-muted [text-wrap:pretty]">
            When on, a member who signs in with Discord gets the highest Ume role mapped to any of their Discord roles. Existing memberships are never downgraded.
          </p>
        </div>
        <Switch checked={syncEnabled} disabled={pending} onCheckedChange={(v) => run(() => setRoleSync(workspaceId, v), { success: v ? 'Role sync on.' : 'Role sync off.' })} aria-label="Apply Discord roles at sign-in" />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <Label htmlFor="default-role">Default role for any server member</Label>
        <Select
          id="default-role"
          value={defaultRoleId ?? ''}
          disabled={pending}
          onChange={(e) => run(() => setDefaultRole(workspaceId, e.target.value || null), { success: 'Default role updated.' })}
          className="max-w-sm"
        >
          <option value="">No access without a mapped role or invite</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id} disabled={!r.grantable}>
              {r.name}
              {!r.grantable ? ' (beyond your permissions)' : ''}
            </option>
          ))}
        </Select>
        <p className="mt-1.5 text-xs text-fg-muted [text-wrap:pretty]">Given to signed-in members of the Discord server who match no mapping. Listener is the safe choice: browse and playback only.</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <p className="text-sm font-medium">Discord roles</p>
          <p className="text-xs text-fg-muted tabular-nums">
            {mapped} of {discordRoles.length} mapped
          </p>
        </div>
        {loadError ? (
          <p className="px-5 py-6 text-sm text-fg-muted [text-wrap:pretty]">{loadError}</p>
        ) : discordRoles.length ? (
          <ul className="divide-y divide-border">
            {discordRoles.map((dr) => (
              <li key={dr.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: dr.color ?? '#737373' }} aria-hidden />
                  <span className="truncate text-sm">{dr.isEveryone ? '@everyone' : `@${dr.name}`}</span>
                  {dr.managed ? <span className="text-[11px] text-fg-subtle">bot role</span> : null}
                </div>
                <Select
                  aria-label={`Ume role for @${dr.name}`}
                  value={dr.mappedRoleId ?? ''}
                  disabled={pending}
                  onChange={(e) => run(() => upsertRoleMap(workspaceId, { discordRoleId: dr.id, discordRoleName: dr.name, roleId: e.target.value || null }), { success: 'Mapping saved.' })}
                  className="h-8 w-full rounded-lg text-xs sm:w-52"
                >
                  <option value="">Not mapped</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id} disabled={!r.grantable && r.id !== dr.mappedRoleId}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 py-6 text-sm text-fg-muted">This server has no roles besides @everyone.</p>
        )}
      </div>
    </div>
  )
}
