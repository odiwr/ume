import { Search } from '@/components/ui/icons'
import { Input } from '@/components/ui/input'
import { buttonClasses } from '@/components/ui/button'
import Link from 'next/link'

/** GET search box; keeps other filters via hidden inputs. Server-rendered on purpose. */
export function SearchForm({
  basePath,
  q,
  placeholder,
  hidden,
}: {
  basePath: string
  q: string
  placeholder: string
  hidden?: Record<string, string | undefined>
}) {
  return (
    <form action={basePath} method="get" className="flex w-full max-w-xl items-center gap-2">
      {Object.entries(hidden ?? {}).map(([k, v]) =>
        v ? <input key={k} type="hidden" name={k} value={v} /> : null,
      )}
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          name="q"
          defaultValue={q}
          placeholder={placeholder}
          className="pl-9"
          aria-label="Search"
        />
      </div>
      <button type="submit" className={buttonClasses('secondary', 'md')}>
        Search
      </button>
      {q ? (
        <Link href={basePath} className={buttonClasses('ghost', 'md')}>
          Clear
        </Link>
      ) : null}
    </form>
  )
}
