/**
 * CEO console navigation. Shared by the sidebar (client) and page headers (server).
 * Icons are resolved in the sidebar component so this file stays free of React.
 */
export type CeoNavIcon =
  | 'overview'
  | 'workspaces'
  | 'users'
  | 'storage'
  | 'revenue'
  | 'bot'
  | 'flags'
  | 'dmca'
  | 'notifications'
  | 'audit'

export interface CeoNavItem {
  href: string
  label: string
  icon: CeoNavIcon
  description: string
}

export const CEO_NAV: readonly CeoNavItem[] = [
  { href: '/ceo', label: 'Overview', icon: 'overview', description: 'Key numbers across the whole product.' },
  { href: '/ceo/workspaces', label: 'Workspaces', icon: 'workspaces', description: 'Every Discord server that has met the bot.' },
  { href: '/ceo/users', label: 'Users', icon: 'users', description: 'Accounts, Discord links and bans.' },
  { href: '/ceo/storage', label: 'Storage', icon: 'storage', description: 'Who is using the bytes.' },
  { href: '/ceo/revenue', label: 'Revenue', icon: 'revenue', description: 'Paid workspaces and MRR.' },
  { href: '/ceo/bot', label: 'Bot health', icon: 'bot', description: 'Heartbeats and voice presence per server.' },
  { href: '/ceo/flags', label: 'Flags', icon: 'flags', description: 'Global kill-switches.' },
  { href: '/ceo/dmca', label: 'DMCA', icon: 'dmca', description: 'Takedown notices and counter-notices.' },
  { href: '/ceo/notifications', label: 'Notifications', icon: 'notifications', description: 'Outbound email and Discord messages.' },
  { href: '/ceo/audit', label: 'Audit', icon: 'audit', description: 'Who did what, everywhere.' },
] as const

export function isNavActive(pathname: string, href: string): boolean {
  if (href === '/ceo') return pathname === '/ceo'
  return pathname === href || pathname.startsWith(`${href}/`)
}
