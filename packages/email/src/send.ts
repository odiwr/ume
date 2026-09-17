import { Resend } from 'resend'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

/** Stable error code returned when no RESEND_API_KEY is set in production. */
export const EMAIL_NOT_CONFIGURED = 'email_not_configured'

export type SendEmailResult =
  /** Delivered to Resend. `id` is Resend's message id. */
  | { ok: true; id?: string; dryRun?: false }
  /** No key outside production: the message was printed to stdout, nothing was delivered. */
  | { ok: true; id: 'dry-run'; dryRun: true }
  /** Not delivered. `error` is Resend's message or `EMAIL_NOT_CONFIGURED`. */
  | { ok: false; error: string; dryRun?: false }

let client: Resend | null = null
let warnedNotConfigured = false

function getClient(): Resend | null {
  if (client) return client
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  client = new Resend(key)
  return client
}

/**
 * Sends via Resend.
 *
 * Without RESEND_API_KEY:
 * - outside production (local dev, tests, previews) it prints the message to stdout and
 *   returns `{ ok: true, dryRun: true }` so flows can be exercised end to end;
 * - in production (`NODE_ENV=production`) it warns once and returns
 *   `{ ok: false, error: 'email_not_configured' }`. Callers must not record the message
 *   as sent: invites keep `emailSentAt` null, the worker job fails so pg-boss retries.
 */
export async function sendEmail(msg: EmailMessage): Promise<SendEmailResult> {
  const from = process.env.EMAIL_FROM ?? 'Ume <no-reply@ume.app>'
  const resend = getClient()
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      if (!warnedNotConfigured) {
        warnedNotConfigured = true
        console.warn(
          '[email] RESEND_API_KEY is not set in production; no email will be delivered until it is configured.',
        )
      }
      return { ok: false, error: EMAIL_NOT_CONFIGURED }
    }
    console.log(`[email:dry-run] to=${msg.to} subject="${msg.subject}"\n${msg.text}`)
    return { ok: true, id: 'dry-run', dryRun: true }
  }
  const { data, error } = await resend.emails.send({
    from,
    to: msg.to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data?.id }
}
