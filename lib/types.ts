export type Sun = 'full sun' | 'part shade' | 'full shade'
export type Water = 'low' | 'moderate' | 'high'
export type PlantType = 'shrub' | 'tree' | 'perennial' | 'groundcover' | 'vine' | 'grass'

export interface Plant {
  id: string
  common_name: string
  latin_name: string | null
  description: string | null
  sun: Sun | null
  water: Water | null
  soil: string | null
  height_min: number | null
  height_max: number | null
  width_min: number | null
  width_max: number | null
  bloom_months: string[] | null
  season_of_interest: string[] | null
  plant_type: PlantType | null
  image_url: string | null
  created_at: string
}

export interface PlantList {
  id: string
  owner_id: string
  title: string
  description: string | null
  share_id: string
  created_at: string
}

export interface PlantListItem {
  id: string
  list_id: string
  plant_id: string
  sort_order: number
  notes: string | null
  created_at: string
  plant?: Plant
}
