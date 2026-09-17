'use client'

import * as React from 'react'
import { useActionState } from 'react'
import { CheckCircle2, Send } from '@/components/ui/icons'
import { Button } from '@/components/ui/button'
import { Input, Label, Textarea } from '@/components/ui/input'
import { submitDmcaNotice, type DmcaField, type DmcaFormState } from './actions'

const initial: DmcaFormState = { ok: false }

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-xs text-danger" role="alert">
      {message}
    </p>
  )
}

function Field({
  name,
  label,
  hint,
  errors,
  children,
}: {
  name: DmcaField
  label: string
  hint?: string
  errors?: DmcaFormState['errors']
  children: React.ReactNode
}) {
  const err = errors?.[name]
  return (
    <div>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint && !err ? <p className="mt-1.5 text-xs text-fg-subtle">{hint}</p> : null}
      <FieldError id={`${name}-error`} message={err} />
    </div>
  )
}

export function TakedownForm() {
  const [state, action, pending] = useActionState(submitDmcaNotice, initial)
  const errors = state.errors

  if (state.ok) {
    return (
      <div className="rounded-2xl border border-success/30 bg-success/10 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
          <div>
            <h3 className="font-display text-lg font-semibold">Notice received</h3>
            <p className="mt-1 text-sm text-fg-muted">
              Your reference is{' '}
              <code className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-fg">
                {state.reference}
              </code>
              . We review notices within two business days, disable the material if the notice is
              complete, and email you at the address you provided. Keep the reference for any
              follow-up.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {/* Honeypot; hidden from people, tempting for bots. */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor="website">Website</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="claimantName" label="Your full name" errors={errors}>
          <Input
            id="claimantName"
            name="claimantName"
            autoComplete="name"
            required
            aria-invalid={!!errors?.claimantName}
            aria-describedby={errors?.claimantName ? 'claimantName-error' : undefined}
          />
        </Field>
        <Field
          name="claimantEmail"
          label="Email"
          errors={errors}
          hint="Where we send our response."
        >
          <Input
            id="claimantEmail"
            name="claimantEmail"
            type="email"
            autoComplete="email"
            required
            aria-invalid={!!errors?.claimantEmail}
            aria-describedby={errors?.claimantEmail ? 'claimantEmail-error' : undefined}
          />
        </Field>
      </div>

      <Field
        name="claimantAddress"
        label="Postal address"
        errors={errors}
        hint="Required by 17 U.S.C. § 512(c)(3)(A)(iv). Shared with the uploader if they counter-notice."
      >
        <Textarea
          id="claimantAddress"
          name="claimantAddress"
          autoComplete="street-address"
          className="min-h-20"
          required
          aria-invalid={!!errors?.claimantAddress}
          aria-describedby={errors?.claimantAddress ? 'claimantAddress-error' : undefined}
        />
      </Field>

      <Field
        name="workDescription"
        label="The copyrighted work"
        errors={errors}
        hint="Title, artist, release, and your relationship to it (owner, label, agent). A link to an official copy helps."
      >
        <Textarea
          id="workDescription"
          name="workDescription"
          required
          aria-invalid={!!errors?.workDescription}
          aria-describedby={errors?.workDescription ? 'workDescription-error' : undefined}
        />
      </Field>

      <Field
        name="infringingUrl"
        label="URL of the infringing material"
        errors={errors}
        hint="The Ume link to the playlist or track. One notice per track; submit another for additional tracks."
      >
        <Input
          id="infringingUrl"
          name="infringingUrl"
          type="url"
          inputMode="url"
          placeholder="https://"
          required
          aria-invalid={!!errors?.infringingUrl}
          aria-describedby={errors?.infringingUrl ? 'infringingUrl-error' : undefined}
        />
      </Field>

      <fieldset className="flex flex-col gap-3 rounded-2xl bg-surface-2 p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-fg-muted">
          Statements
        </legend>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-fg-muted">
          <input
            type="checkbox"
            name="goodFaith"
            className="mt-1 size-4 shrink-0 accent-pink"
            aria-invalid={!!errors?.goodFaith}
            aria-describedby={errors?.goodFaith ? 'goodFaith-error' : undefined}
          />
          <span>
            I have a good-faith belief that use of the material in the manner complained of is not
            authorised by the copyright owner, its agent, or the law.
          </span>
        </label>
        <FieldError id="goodFaith-error" message={errors?.goodFaith} />
        <label className="flex items-start gap-3 text-sm leading-relaxed text-fg-muted">
          <input
            type="checkbox"
            name="accuracy"
            className="mt-1 size-4 shrink-0 accent-pink"
            aria-invalid={!!errors?.accuracy}
            aria-describedby={errors?.accuracy ? 'accuracy-error' : undefined}
          />
          <span>
            The information in this notice is accurate, and{' '}
            <strong className="text-fg">under penalty of perjury</strong> I am the copyright owner
            or am authorised to act on behalf of the owner of an exclusive right that is allegedly
            infringed.
          </span>
        </label>
        <FieldError id="accuracy-error" message={errors?.accuracy} />
      </fieldset>

      <Field
        name="signature"
        label="Signature"
        errors={errors}
        hint="Type your full legal name. It must match the name above."
      >
        <Input
          id="signature"
          name="signature"
          autoComplete="off"
          required
          className="font-display italic"
          aria-invalid={!!errors?.signature}
          aria-describedby={errors?.signature ? 'signature-error' : undefined}
        />
      </Field>

      {state.message ? (
        <p
          className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
          role="alert"
        >
          {state.message}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-fg-subtle">
          Your IP address is recorded with the notice. Knowingly false notices carry liability under
          § 512(f).
        </p>
        <Button type="submit" size="lg" loading={pending} className="sm:shrink-0">
          {pending ? 'Sending' : 'Send takedown notice'}
          {!pending ? <Send className="size-4" /> : null}
        </Button>
      </div>
    </form>
  )
}
