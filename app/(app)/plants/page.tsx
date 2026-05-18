import { Suspense } from 'react'
import type { SearchParams } from 'nuqs/server'
import { createClient } from '@/lib/supabase/server'
import { plantSearchParamsCache } from './searchParams'
import { buildPlantsQuery } from './queryBuilder'
import PlantsFilterSidebar from './PlantsFilterSidebar'
import PlantsGrid from './PlantsGrid'
import { SkeletonGrid } from './PlantCardSkeleton'
import type { PlantList } from '@/lib/types'

type Props = { searchParams: Promise<SearchParams> }

export default async function PlantsPage({ searchParams }: Props) {
  const params = await plantSearchParamsCache.parse(searchParams)
  const supabase = await createClient()

  const [{ data: plants }, { count }, { data: { user } }] = await Promise.all([
    buildPlantsQuery(supabase, params).range(0, 23),
    buildPlantsQuery(supabase, params, { count: 'exact', head: true }),
    supabase.auth.getUser(),
  ])

  let lists: PlantList[] = []
  if (user) {
    const { data: listData } = await supabase
      .from('plant_lists')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    lists = listData ?? []
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex gap-8">
      <PlantsFilterSidebar />
      <div className="flex-1 min-w-0">
        <div className="mb-8">
          <h1 className="font-playfair text-3xl font-semibold text-dark-bark mb-1.5">Plant Database</h1>
          <p className="text-warm-umber text-base mb-5">Browse our curated permaculture plant collection</p>
        </div>
        <Suspense fallback={<SkeletonGrid />}>
          <PlantsGrid
            key={JSON.stringify(params)}
            initialPlants={plants ?? []}
            totalCount={count ?? 0}
            filterParams={params}
            lists={lists}
          />
        </Suspense>
      </div>
    </div>
  )
}
