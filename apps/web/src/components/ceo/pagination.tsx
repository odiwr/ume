import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PaginationProps {
  page: number
  pageSize: number
  total: number
  basePath: string
  /** Query params to preserve (search, filters). `page` is overwritten. */
  params?: Record<string, string | undefined>
  className?: string
}

function href(
  basePath: string,
  params: Record<string, string | undefined> | undefined,
  page: number,
) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params ?? {})) if (v) sp.set(k, v)
  if (page > 1) sp.set('page', String(page))
  else sp.delete('page')
  const qs = sp.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

export function Pagination({
  page,
  pageSize,
  total,
  basePath,
  params,
  className,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const prevDisabled = page <= 1
  const nextDisabled = page >= pages
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 text-sm text-fg-muted',
        className,
      )}
    >
      <p className="tabular-nums">
        {total === 0 ? 'No results' : `${from}–${to} of ${total.toLocaleString('en-US')}`}
      </p>
      <div className="flex items-center gap-2">
        <span className="tabular-nums">
          Page {page} / {pages}
        </span>
        {prevDisabled ? (
          <span
            className={buttonClasses('outline', 'sm', 'opacity-40 cursor-not-allowed')}
            aria-disabled
          >
            <ChevronLeft className="size-4" /> Prev
          </span>
        ) : (
          <Link href={href(basePath, params, page - 1)} className={buttonClasses('outline', 'sm')}>
            <ChevronLeft className="size-4" /> Prev
          </Link>
        )}
        {nextDisabled ? (
          <span
            className={buttonClasses('outline', 'sm', 'opacity-40 cursor-not-allowed')}
            aria-disabled
          >
            Next <ChevronRight className="size-4" />
          </span>
        ) : (
          <Link href={href(basePath, params, page + 1)} className={buttonClasses('outline', 'sm')}>
            Next <ChevronRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  )
}
