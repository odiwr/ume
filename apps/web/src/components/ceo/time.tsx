import { format, formatDistanceToNowStrict } from 'date-fns'

/** Relative time with the absolute timestamp on hover. */
export function Ago({
  date,
  fallback = '—',
}: {
  date: Date | string | null | undefined
  fallback?: string
}) {
  if (!date) return <span className="text-fg-subtle">{fallback}</span>
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return <span className="text-fg-subtle">{fallback}</span>
  return (
    <time
      dateTime={d.toISOString()}
      title={format(d, 'd MMM yyyy, HH:mm:ss')}
      className="whitespace-nowrap tabular-nums"
    >
      {formatDistanceToNowStrict(d, { addSuffix: true })}
    </time>
  )
}

export function Absolute({
  date,
  fallback = '—',
}: {
  date: Date | string | null | undefined
  fallback?: string
}) {
  if (!date) return <span className="text-fg-subtle">{fallback}</span>
  const d = typeof date === 'string' ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return <span className="text-fg-subtle">{fallback}</span>
  return (
    <time dateTime={d.toISOString()} className="whitespace-nowrap tabular-nums">
      {format(d, 'd MMM yyyy, HH:mm')}
    </time>
  )
}
