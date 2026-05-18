'use client'

import { useQueryStates } from 'nuqs'
import { useTransition } from 'react'
import { plantSearchParsers } from './searchParams'
import FilterSection from './FilterSection'
import { SUN_OPTIONS, WATER_OPTIONS, TYPE_OPTIONS, MONTH_OPTIONS, DORMANCY_OPTIONS, GROWTH_OPTIONS, LAYER_OPTIONS, PERM_USE_OPTIONS } from '@/lib/plant-labels'
import { ZONE_LABELS } from '@/lib/zones'
import { US_STATES } from '@/lib/us-states'

export default function FilterControls() {
  const [isPending, startTransition] = useTransition()
  const [filters, setFilters] = useQueryStates(plantSearchParsers, {
    shallow: false,
    startTransition,
    history: 'replace',
  })

  function handleToggle(key: keyof typeof filters, value: string) {
    const current = filters[key] as string[]
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value]
    setFilters({ [key]: next })
  }

  function handleClearAll() {
    setFilters({ sun: [], water: [], types: [], months: [], dormancy: [], growthRate: [], layers: [], permUses: [], zones: [], state: '', q: '' })
  }

  return (
    <div data-pending={isPending ? '' : undefined}>
      <FilterSection label="Permaculture Uses" options={PERM_USE_OPTIONS} selected={filters.permUses} onToggle={v => handleToggle('permUses', v)} />
      <FilterSection label="Forest Garden Layer" options={LAYER_OPTIONS} selected={filters.layers} onToggle={v => handleToggle('layers', v)} />
      <FilterSection label="Type" options={TYPE_OPTIONS} selected={filters.types} onToggle={v => handleToggle('types', v)} />
      <hr className="border-warm-stone/20 my-3" />
      <FilterSection label="Sun" options={SUN_OPTIONS} selected={filters.sun} onToggle={v => handleToggle('sun', v)} />
      <FilterSection label="Water" options={WATER_OPTIONS} selected={filters.water} onToggle={v => handleToggle('water', v)} />
      <FilterSection label="Growth Rate" options={GROWTH_OPTIONS} selected={filters.growthRate} onToggle={v => handleToggle('growthRate', v)} />
      <FilterSection label="Dormancy" options={DORMANCY_OPTIONS} selected={filters.dormancy} onToggle={v => handleToggle('dormancy', v)} />
      <hr className="border-warm-stone/20 my-3" />
      <FilterSection label="Bloom Month" options={MONTH_OPTIONS} selected={filters.months} onToggle={v => handleToggle('months', v)} />
      <hr className="border-warm-stone/20 my-3" />
      <FilterSection label="USDA Zone" options={ZONE_LABELS} selected={filters.zones} onToggle={v => handleToggle('zones', v)} />

      <div className="mb-1">
        <p className="w-full py-2.5 text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em]">
          Native to State
          {filters.state && <span className="ml-1.5 bg-terracotta text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 normal-case tracking-normal">1</span>}
        </p>
        <select
          value={filters.state}
          onChange={e => setFilters({ state: e.target.value })}
          className="w-full px-3 py-2 border border-warm-stone/40 rounded-lg text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
        >
          <option value="">Any state</option>
          {US_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
      </div>
    </div>
  )
}
