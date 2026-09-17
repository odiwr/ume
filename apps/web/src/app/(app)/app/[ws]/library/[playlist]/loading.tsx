export default function Loading() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:gap-8">
        <div className="aspect-square w-full max-w-60 shrink-0 animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none sm:w-48 lg:w-56" />
        <div className="flex-1 space-y-3">
          <div className="h-9 w-56 max-w-full animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
          <div className="h-4 w-32 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
        </div>
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
    </div>
  )
}
