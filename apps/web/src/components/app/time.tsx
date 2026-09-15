import { format, formatDistanceToNowStrict } from 'date-fns'

function parse(date: Date | string | null | undefined): Date | null {
  if (!date) return null
  const d = typeof date === 'string' ? new Date(date) : date
  return Number.isNaN(d.getTime()) ? null : d
}

/** Relative time with the absolute timestamp on hover. Safe in server and client components. */
export function Ago({ date, fallback = 'never' }: { date: Date | string | null | undefined; fallback?: string }) {
  const d = parse(date)
  if (!d) return <span className="text-fg-subtle">{fallback}</span>
  return (
    <time dateTime={d.toISOString()} title={format(d, 'd MMM yyyy, HH:mm')} className="whitespace-nowrap tabular-nums">
      {formatDistanceToNowStrict(d, { addSuffix: true })}
    </time>
  )
}

export function Absolute({ date, fallback = '—', withTime = true }: { date: Date | string | null | undefined; fallback?: string; withTime?: boolean }) {
  const d = parse(date)
  if (!d) return <span className="text-fg-subtle">{fallback}</span>
  return (
    <time dateTime={d.toISOString()} className="whitespace-nowrap tabular-nums">
      {format(d, withTime ? 'd MMM yyyy, HH:mm' : 'd MMM yyyy')}
    </time>
  )
}
