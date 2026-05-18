'use client'

import { useQueryStates } from 'nuqs'
import { plantSearchParsers } from './searchParams'
import { US_STATES } from '@/lib/us-states'

export default function ActiveFilterChips() {
  const [filters, setFilters] = useQueryStates(plantSearchParsers, { shallow: false, history: 'replace' })

  type Chip = { label: string; clear: () => void }
  const chips: Chip[] = []

  filters.sun.forEach(v => chips.push({ label: v, clear: () => setFilters({ sun: filters.sun.filter(x => x !== v) }) }))
  filters.water.forEach(v => chips.push({ label: `${v} water`, clear: () => setFilters({ water: filters.water.filter(x => x !== v) }) }))
  filters.types.forEach(v => chips.push({ label: v, clear: () => setFilters({ types: filters.types.filter(x => x !== v) }) }))
  filters.months.forEach(v => chips.push({ label: v, clear: () => setFilters({ months: filters.months.filter(x => x !== v) }) }))
  filters.dormancy.forEach(v => chips.push({ label: v, clear: () => setFilters({ dormancy: filters.dormancy.filter(x => x !== v) }) }))
  filters.growthRate.forEach(v => chips.push({ label: v, clear: () => setFilters({ growthRate: filters.growthRate.filter(x => x !== v) }) }))
  filters.layers.forEach(v => chips.push({ label: v, clear: () => setFilters({ layers: filters.layers.filter(x => x !== v) }) }))
  filters.permUses.forEach(v => chips.push({ label: v, clear: () => setFilters({ permUses: filters.permUses.filter(x => x !== v) }) }))
  filters.zones.forEach(v => chips.push({ label: `Zone ${v}`, clear: () => setFilters({ zones: filters.zones.filter(x => x !== v) }) }))
  if (filters.state) {
    const stateName = US_STATES.find(s => s.code === filters.state)?.name ?? filters.state
    chips.push({ label: `Native to ${stateName}`, clear: () => setFilters({ state: '' }) })
  }

  if (chips.length === 0) return null

  function clearAll() {
    setFilters({ sun: [], water: [], types: [], months: [], dormancy: [], growthRate: [], layers: [], permUses: [], zones: [], state: '', q: '' })
  }

  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {chips.map((chip, i) => (
        <button
          key={i}
          onClick={chip.clear}
          className="flex items-center gap-1 bg-terracotta text-white text-[11px] rounded-full px-3 py-1 hover:bg-terracotta/80 transition-colors"
        >
          <span className="capitalize">{chip.label}</span>
          <span className="text-white/70 ml-0.5">×</span>
        </button>
      ))}
      <button
        onClick={clearAll}
        className="text-[11px] text-warm-stone hover:text-terracotta underline underline-offset-2 transition-colors"
      >
        Clear all
      </button>
    </div>
  )
}
