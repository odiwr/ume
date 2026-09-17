export default function Loading() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="h-8 w-48 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 sm:gap-x-6 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="aspect-square animate-pulse rounded-2xl bg-surface-2 motion-reduce:animate-none" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-surface-2 motion-reduce:animate-none" />
          </div>
        ))}
      </div>
    </div>
  )
}
