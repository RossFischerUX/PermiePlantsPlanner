export const SUN_OPTIONS: string[] = ['full sun', 'part shade', 'full shade']
export const WATER_OPTIONS: string[] = ['low', 'moderate', 'high']
export const TYPE_OPTIONS: string[] = ['shrub', 'tree', 'perennial', 'groundcover', 'vine', 'grass']
export const MONTH_OPTIONS: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const DORMANCY_OPTIONS: string[] = ['evergreen', 'deciduous', 'semi-evergreen']
export const GROWTH_OPTIONS: string[] = ['slow', 'moderate', 'fast']
export const SEASON_OPTIONS: string[] = ['Spring', 'Summer', 'Fall', 'Winter']
export const LAYER_OPTIONS: string[] = ['canopy', 'sub-canopy', 'shrub', 'herb', 'ground cover', 'rhizosphere', 'climber']
export const FUNCTIONAL_ROLE_OPTIONS: string[] = ['nitrogen fixer', 'dynamic accumulator', 'insectary plant', 'chop-and-drop', 'wildlife benefit', 'medicinal', 'fiber', 'groundcover', 'windbreak', 'pollinator nectary', 'bee forage', 'living mulch', 'biomass producer', 'erosion control', 'hedgerow', 'edible'] // D-02
export const PERM_USE_OPTIONS = FUNCTIONAL_ROLE_OPTIONS // alias — preserves v1 filter sidebar importer (FilterControls.tsx)
export const SUCCESSION_OPTIONS: string[] = ['pioneer', 'early successional', 'mid successional', 'climax'] // D-09
export const ESTABLISHMENT_OPTIONS: string[] = ['easy', 'moderate', 'challenging'] // D-10
export const MAINTENANCE_OPTIONS: string[] = ['low', 'moderate', 'high'] // D-11
export const PROPAGATION_OPTIONS: string[] = ['seed', 'cutting', 'division', 'layering', 'grafting', 'root cutting', 'tuber', 'sucker'] // D-13
export const EDIBLE_PART_OPTIONS: string[] = ['leaf', 'fruit', 'nut', 'seed', 'root', 'flower', 'bark', 'sap', 'shoot', 'pod'] // D-14
// MONTH_OPTIONS (line 4) is reused for harvest_months calendar ordering (D-15) — do not duplicate
export const FUNCTIONAL_INFO_LABELS: Record<string, string> = {
  forest_garden_layer: 'Forest Garden Layer',
  establishment_difficulty: 'Establishment',
  maintenance_level: 'Maintenance',
  years_to_bearing: 'Years to Bearing',
}
export const SUN_ICONS: Record<string, string> = { 'full sun': '☀️', 'part shade': '⛅', 'full shade': '🌥️' }
export const WATER_ICONS: Record<string, string> = { 'low': '💧', 'moderate': '💧💧', 'high': '💧💧💧' }
