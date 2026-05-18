import { createSearchParamsCache, parseAsArrayOf, parseAsString } from 'nuqs/server'

export const plantSearchParsers = {
  sun: parseAsArrayOf(parseAsString).withDefault([]),
  water: parseAsArrayOf(parseAsString).withDefault([]),
  types: parseAsArrayOf(parseAsString).withDefault([]),
  months: parseAsArrayOf(parseAsString).withDefault([]),
  dormancy: parseAsArrayOf(parseAsString).withDefault([]),
  growthRate: parseAsArrayOf(parseAsString).withDefault([]),
  layers: parseAsArrayOf(parseAsString).withDefault([]),
  permUses: parseAsArrayOf(parseAsString).withDefault([]),
  zones: parseAsArrayOf(parseAsString).withDefault([]),
  state: parseAsString.withDefault(''),
  q: parseAsString.withDefault(''),
}

export const plantSearchParamsCache = createSearchParamsCache(plantSearchParsers)

export type PlantSearchParams = ReturnType<typeof plantSearchParamsCache.all>
