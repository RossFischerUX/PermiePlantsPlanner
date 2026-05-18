'use client'

import { useState } from 'react'
import { useQueryStates } from 'nuqs'
import { plantSearchParsers } from './searchParams'
import FilterControls from './FilterControls'

export default function PlantsFilterSidebar() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [filters, setFilters] = useQueryStates(plantSearchParsers)

  const activeFilterCount =
    filters.sun.length +
    filters.water.length +
    filters.types.length +
    filters.months.length +
    filters.dormancy.length +
    filters.growthRate.length +
    filters.layers.length +
    filters.permUses.length +
    filters.zones.length +
    (filters.state ? 1 : 0) +
    (filters.q ? 1 : 0)

  function handleClearAll() {
    setFilters({ sun: [], water: [], types: [], months: [], dormancy: [], growthRate: [], layers: [], permUses: [], zones: [], state: '', q: '' })
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="w-72 flex-shrink-0 hidden lg:block">
        <div className="bg-stone-white rounded-2xl p-6 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em]">Filter Plants</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[11px] font-medium text-terracotta hover:text-terracotta/80 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>
          <FilterControls />
        </div>
      </aside>

      {/* Mobile toggle + drawer */}
      <div className="lg:hidden mb-5">
        <button
          onClick={() => setDrawerOpen(v => !v)}
          className={`w-full flex items-center justify-between px-4 py-3 bg-stone-white border border-warm-stone/30 text-sm font-medium text-warm-umber hover:bg-stone-white/80 transition-colors ${drawerOpen ? 'rounded-t-xl border-b-0' : 'rounded-xl'}`}
        >
          <span className="flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-warm-stone" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-terracotta text-white text-xs font-bold">
                {activeFilterCount}
              </span>
            )}
          </span>
          <svg
            className={`w-4 h-4 text-warm-stone transition-transform duration-200 ${drawerOpen ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {drawerOpen && (
          <div className="border border-warm-stone/30 border-t-0 rounded-b-xl bg-stone-white overflow-hidden">
            <div className="px-5 py-3 max-h-[60vh] overflow-y-auto">
              <FilterControls />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-warm-stone/20">
              <button
                onClick={() => { handleClearAll(); setDrawerOpen(false) }}
                className="text-sm font-medium text-warm-stone hover:text-terracotta transition-colors"
              >
                Clear all
              </button>
              <button
                onClick={() => setDrawerOpen(false)}
                className="bg-forest text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-forest-dark transition-colors"
              >
                Show results
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
