import * as React from 'react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: React.ReactNode
  /** Renders the cell. Defaults to `String(row[key])`. */
  render?: (row: T) => React.ReactNode
  className?: string
  headerClassName?: string
  align?: 'left' | 'right'
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: React.ReactNode
  className?: string
  dense?: boolean
}

/**
 * Compact, scrollable table for the console. Server-safe (no hooks) so pages can
 * pass server-rendered cells (links, badges, action forms).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  className,
  dense,
}: DataTableProps<T>) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-border bg-surface', className)}>
      <table className="w-full min-w-max border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface-2/60 text-left text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            {columns.map((c) => (
              <th
                key={c.key}
                className={cn(
                  'px-3 py-2.5 whitespace-nowrap',
                  c.align === 'right' && 'text-right',
                  c.headerClassName,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-sm text-fg-muted">
                {empty ?? 'Nothing here yet.'}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="border-b border-border last:border-b-0 hover:bg-surface-2/50"
              >
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn(
                      'px-3 align-middle',
                      dense ? 'py-1.5' : 'py-2.5',
                      c.align === 'right' && 'text-right tabular-nums',
                      c.className,
                    )}
                  >
                    {c.render
                      ? c.render(row)
                      : String((row as Record<string, unknown>)[c.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

/** Inline monospace identifier (umeId, snowflakes, hashes). */
export function Mono({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        'rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[12px] text-fg-muted',
        className,
      )}
    >
      {children}
    </code>
  )
}

/** Compact one-line JSON for metadata cells; the full value is in the title. */
export function JsonInline({
  value,
  max = 120,
}: {
  value: Record<string, unknown> | null | undefined
  max?: number
}) {
  if (!value || Object.keys(value).length === 0) return <span className="text-fg-subtle">—</span>
  const text = JSON.stringify(value)
  const short = text.length > max ? `${text.slice(0, max)}…` : text
  return (
    <span className="font-mono text-[11px] text-fg-muted" title={text}>
      {short}
    </span>
  )
}
