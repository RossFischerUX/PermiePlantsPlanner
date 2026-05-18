'use server'

import { createClient } from '@/lib/supabase/server'
import { encodeZone } from '@/lib/zones'
import type { Plant } from '@/lib/types'
import type { PlantSearchParams } from './searchParams'

export function buildPlantsQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: PlantSearchParams,
  opts?: { count: 'exact'; head: boolean }
) {
  let query = supabase.from('plants').select('*', opts).order('common_name')

  if (params.sun.length)        query = query.in('sun', params.sun)
  if (params.water.length)      query = query.in('water', params.water)
  if (params.types.length)      query = query.in('plant_type', params.types)
  if (params.dormancy.length)   query = query.in('dormancy', params.dormancy)
  if (params.growthRate.length) query = query.in('growth_rate', params.growthRate)
  if (params.layers.length)     query = query.in('forest_garden_layer', params.layers)

  // bloom_months: overlaps — any selected month is sufficient (OR semantics)
  if (params.months.length)     query = query.overlaps('bloom_months', params.months)

  // permaculture_uses: contains — plant must have ALL selected uses (AND semantics)
  if (params.permUses.length)   query = query.contains('permaculture_uses', params.permUses)

  if (params.state)             query = query.contains('native_states', [params.state])

  if (params.zones.length) {
    const encoded = params.zones
      .map(z => encodeZone(z))
      .filter((n): n is number => n !== null)
    if (encoded.length > 0) {
      query = query
        .lte('usda_zone_min', Math.max(...encoded))
        .gte('usda_zone_max', Math.min(...encoded))
    }
  }

  if (params.q) {
    query = query.or(`common_name.ilike.%${params.q}%,latin_name.ilike.%${params.q}%`)
  }

  return query
}

export async function fetchMorePlants(params: PlantSearchParams, offset: number): Promise<Plant[]> {
  const supabase = await createClient()
  const { data } = await buildPlantsQuery(supabase, params).range(offset, offset + 23)
  return data ?? []
}
