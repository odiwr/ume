import 'server-only'
import { headers } from 'next/headers'

/** Best-effort client IP for abuse records. Trusts the platform's forwarding headers. */
export async function requestIp(): Promise<string | null> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) {
    const first = fwd.split(',')[0]?.trim()
    if (first) return first.slice(0, 64)
  }
  const real = h.get('x-real-ip') ?? h.get('cf-connecting-ip')
  return real ? real.slice(0, 64) : null
}
