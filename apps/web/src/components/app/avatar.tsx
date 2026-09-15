import { cn } from '@/lib/utils'
import { avatarSrc, displayName, initials } from '@/lib/app/format'

type AvatarUser = {
  name?: string | null
  image?: string | null
  discordUsername?: string | null
  discordUserId?: string | null
  discordAvatar?: string | null
} | null | undefined

/** Discord avatar when we have it, otherwise the provider image, otherwise initials. */
export function UserAvatar({ user, size = 28, className }: { user: AvatarUser; size?: number; className?: string }) {
  const name = displayName(user)
  const src = avatarSrc(user)
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.4)) }
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} style={style} className={cn('shrink-0 rounded-full bg-surface-3 object-cover', className)} />
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cn('inline-flex shrink-0 items-center justify-center rounded-full bg-surface-3 font-semibold text-fg-muted', className)}
    >
      {initials(name)}
    </span>
  )
}

/** Discord server icon, or the first letters of the name in the server's absence of one. */
export function GuildIcon({ name, src, size = 40, className }: { name: string; src: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" width={size} height={size} style={style} className={cn('shrink-0 rounded-xl bg-surface-3 object-cover', className)} />
  }
  return (
    <span aria-hidden style={style} className={cn('inline-flex shrink-0 items-center justify-center rounded-xl bg-surface-3 font-display font-bold text-fg-muted', className)}>
      {initials(name)}
    </span>
  )
}
