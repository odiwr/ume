import { formatBytes } from '@ume/shared'
import { cn } from '@/lib/utils'
import { percent } from '@/lib/app/format'

/** Storage meter. Turns amber past 80 % and red past 95 %, matching the quota warnings. */
export function StorageBar({ used, quota, className, compact }: { used: number; quota: number; className?: string; compact?: boolean }) {
  const pct = percent(used, quota)
  const tone = pct >= 95 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-pink'
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3" role="meter" aria-valuemin={0} aria-valuemax={quota} aria-valuenow={used} aria-label="Storage used">
        <div className={cn('h-full rounded-full transition-[width]', tone)} style={{ width: `${pct}%` }} />
      </div>
      <div className={cn('flex justify-between text-fg-muted tabular-nums', compact ? 'text-[11px]' : 'text-xs')}>
        <span>{formatBytes(used)} used</span>
        <span>{formatBytes(quota)}</span>
      </div>
    </div>
  )
}
