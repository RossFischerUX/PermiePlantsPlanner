'use server'

import { createClient } from '@/lib/supabase/server'
import { buildPlantsQuery } from './queryBuilder'
import type { Plant } from '@/lib/types'
import type { PlantSearchParams } from './searchParams'

export async function fetchMorePlants(params: PlantSearchParams, offset: number): Promise<Plant[]> {
  const supabase = await createClient()
  const { data } = await buildPlantsQuery(supabase, params).range(offset, offset + 23)
  return data ?? []
}
