import { Resend } from 'resend'

export interface EmailMessage {
  to: string
  subject: string
  html: string
  text: string
}

let client: Resend | null = null

function getClient(): Resend | null {
  if (client) return client
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  client = new Resend(key)
  return client
}

/**
 * Sends via Resend. Without RESEND_API_KEY (local dev) it logs the message instead of
 * failing, so flows can be exercised end to end.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }> {
  const from = process.env.EMAIL_FROM ?? 'Ume <no-reply@ume.app>'
  const resend = getClient()
  if (!resend) {
    console.log(`[email:dry-run] to=${msg.to} subject="${msg.subject}"\n${msg.text}`)
    return { ok: true, id: 'dry-run' }
  }
  const { data, error } = await resend.emails.send({ from, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text })
  if (error) return { ok: false, error: error.message }
  return { ok: true, id: data?.id }
}
