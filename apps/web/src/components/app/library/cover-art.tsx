import { cn } from '@/lib/utils'

/**
 * A playlist's square cover. Falls back to a soft token gradient with the playlist's
 * initial when no image has been uploaded. Sizing comes from `className`.
 */
export function CoverArt({
  name,
  src,
  className,
  initialClassName,
  priority,
}: {
  name: string
  src: string | null
  className?: string
  initialClassName?: string
  priority?: boolean
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        className={cn('aspect-square rounded-2xl bg-surface-3 object-cover', className)}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
      />
    )
  }
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? '#'
  return (
    <span
      aria-hidden
      className={cn(
        'flex aspect-square items-center justify-center rounded-2xl bg-linear-to-br from-sage-light via-blush to-surface-3 font-display font-semibold text-pink select-none',
        className,
      )}
    >
      <span className={cn('text-4xl', initialClassName)}>{initial}</span>
    </span>
  )
}
