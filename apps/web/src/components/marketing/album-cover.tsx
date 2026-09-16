import { cn } from '@/lib/utils'

/** Six original sample covers in a 3 × 2 artwork sheet. */
export function AlbumCover({ index, className }: { index: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('album-cover block aspect-square shrink-0 rounded-lg', className)}
      style={{ backgroundPosition: `${(index % 3) * 50}% ${index < 3 ? 0 : 100}%` }}
    />
  )
}
