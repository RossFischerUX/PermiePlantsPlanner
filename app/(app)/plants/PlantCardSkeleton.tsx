export function PlantCardSkeleton() {
  return (
    <div className="bg-stone-white rounded-2xl border border-warm-stone/20 overflow-hidden animate-pulse">
      <div className="h-52 bg-stone-white/80 rounded-t-2xl" />
      <div className="p-5">
        <div className="h-5 w-3/4 bg-warm-stone/20 rounded" />
        <div className="h-3 w-1/2 bg-warm-stone/15 rounded mt-2" />
        <div className="flex gap-2 mt-3">
          <div className="h-6 w-16 bg-warm-stone/15 rounded-full" />
          <div className="h-6 w-16 bg-warm-stone/15 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 24 }, (_, i) => <PlantCardSkeleton key={i} />)}
    </div>
  )
}
