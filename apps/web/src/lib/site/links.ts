import { botInviteUrl } from '@ume/shared'

/**
 * Public links used by the site chrome. Everything here is safe to read on the
 * client (NEXT_PUBLIC_*) but the helpers are called from server components.
 */
export const NAV_LINKS = [
  { href: '/#features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/commands', label: 'Commands' },
] as const

export const FOOTER_PRODUCT_LINKS = [
  { href: '/pricing', label: 'Pricing' },
  { href: '/commands', label: 'Commands' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/login', label: 'Log in' },
] as const

export const FOOTER_LEGAL_LINKS = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/dmca', label: 'DMCA' },
] as const

export function inviteUrl(): string {
  return botInviteUrl(process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID ?? '')
}

export function githubUrl(): string | null {
  const v = process.env.NEXT_PUBLIC_GITHUB_URL?.trim()
  return v ? v : null
}

export function supportInviteUrl(): string | null {
  const v = process.env.NEXT_PUBLIC_DISCORD_SUPPORT_INVITE?.trim()
  if (!v) return null
  if (/^https?:\/\//i.test(v)) return v
  return `https://discord.gg/${v.replace(/^discord\.gg\//i, '')}`
}

/** Effective date shown on the legal pages. Bump when the text changes. */
export const LEGAL_EFFECTIVE_DATE = 'September 15, 2026'
