import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { CLAIM_TOKEN, INVITE } from './constants'

const BASE32 = 'abcdefghijklmnopqrstuvwxyz234567' // lower-case, no 0/1/8/9 confusion

function randomBase32(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) out += BASE32[bytes[i]! % 32]
  return out
}

/**
 * Claim token: `ume_` + 40 base32 chars (200 bits of entropy).
 * Shown to the admin once in a Discord DM; only its SHA-256 hash is stored.
 */
export function generateClaimToken(): string {
  return `${CLAIM_TOKEN.prefix}${randomBase32(40)}`
}

export function isClaimTokenShape(value: string): boolean {
  return /^ume_[a-z2-7]{40}$/.test(value.trim())
}

export function normalizeClaimToken(value: string): string {
  return value.trim().toLowerCase()
}

/** Invite link token: 32 base32 chars (160 bits). */
export function generateInviteToken(): string {
  return randomBase32(INVITE.linkTokenLength)
}

/** Six-character confirmation code for destructive commands (~reset / ~purge). */
export function generateConfirmCode(): string {
  return randomBase32(6).toUpperCase()
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tokensEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** Shared secret check for bot/worker -> web internal calls (if ever needed). */
export function secretsEqual(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false
  return tokensEqual(a, b)
}
