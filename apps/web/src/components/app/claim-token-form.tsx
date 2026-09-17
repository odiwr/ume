'use client'
import * as React from 'react'
import { KeyRound } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { CheckboxField } from '@/components/ui/checkbox'
import { Input, Label } from '@/components/ui/input'
import { submitClaimToken, type ClaimTokenState } from '@/lib/app/actions/workspaces'

export const ATTESTATION_LABEL = 'I’ll only add music I have the right to play in my server.'

/**
 * Token entry. The token is never logged and only ever posted to the server action;
 * `?token=` prefill exists so the bot's DM can deep-link here.
 */
export function ClaimTokenForm({
  initialToken = '',
  returnTo,
  submitLabel = 'Claim server',
  compact,
}: {
  initialToken?: string
  returnTo?: string
  submitLabel?: string
  compact?: boolean
}) {
  const [state, action, pending] = React.useActionState<ClaimTokenState, FormData>(
    submitClaimToken,
    {},
  )
  const [attested, setAttested] = React.useState(false)
  return (
    <form action={action} className="space-y-5">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      <div>
        <Label htmlFor="token">Ume token</Label>
        <Input
          id="token"
          name="token"
          defaultValue={initialToken}
          placeholder="ume_…"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          minLength={44}
          maxLength={44}
          pattern="^ume_[a-z2-7]{40}$"
          className="font-mono"
          aria-describedby="token-help"
        />
        {!compact ? (
          <p id="token-help" className="mt-1.5 text-xs text-fg-muted">
            Run <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-fg">/reload</code>{' '}
            in your Discord server (or{' '}
            <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-fg">~reload</code> in a
            DM to Ume). The token works once and expires after 24 hours.
          </p>
        ) : null}
      </div>
      <CheckboxField
        id={compact ? 'attestation-compact' : 'attestation'}
        name="attestation"
        checked={attested}
        onCheckedChange={(v) => setAttested(v === true)}
        label={ATTESTATION_LABEL}
        description="Required before Ume stores audio from links. Takedowns disable the track and block its content everywhere."
      />
      {state.error ? (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        loading={pending}
        disabled={!attested}
        className={compact ? '' : 'w-full sm:w-auto'}
      >
        {!pending ? <KeyRound className="size-4" /> : null}
        {submitLabel}
      </Button>
    </form>
  )
}
