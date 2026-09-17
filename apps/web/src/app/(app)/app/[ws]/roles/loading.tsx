export default function Loading() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="space-y-2">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-surface-2" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-2xl bg-surface-2" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-surface-2" />
    </div>
  )
}
