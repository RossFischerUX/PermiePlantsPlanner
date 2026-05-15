'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Plant, PlantList } from '@/lib/types'
import Image from 'next/image'

const SUN_OPTIONS = ['full sun', 'part shade', 'full shade']
const WATER_OPTIONS = ['low', 'moderate', 'high']
const TYPE_OPTIONS = ['shrub', 'tree', 'perennial', 'groundcover', 'vine', 'grass']
const MONTH_OPTIONS = ['January','February','March','April','May','June','July','August','September','October','November','December']

const SUN_ICONS: Record<string, string> = {
  'full sun': '☀️',
  'part shade': '⛅',
  'full shade': '🌥️',
}
const WATER_ICONS: Record<string, string> = {
  'low': '💧',
  'moderate': '💧💧',
  'high': '💧💧💧',
}

function PlantCard({ plant, lists, onAddToList }: {
  plant: Plant
  lists: PlantList[]
  onAddToList: (plantId: string, listId: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [added, setAdded] = useState(false)

  const sizeLabel = plant.height_min && plant.height_max
    ? `${plant.height_min}–${plant.height_max}′ tall`
    : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative h-48 bg-green-50">
        {plant.image_url ? (
          <Image
            src={plant.image_url}
            alt={plant.common_name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-5xl">🌿</div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-bold text-gray-900 text-base mb-0.5">{plant.common_name}</h3>
        {plant.latin_name && (
          <p className="text-xs italic text-gray-400 mb-3">{plant.latin_name}</p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          {plant.sun && (
            <span className="text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded-full border border-yellow-100">
              {SUN_ICONS[plant.sun]} {plant.sun}
            </span>
          )}
          {plant.water && (
            <span className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded-full border border-blue-100">
              {WATER_ICONS[plant.water]} {plant.water} water
            </span>
          )}
          {sizeLabel && (
            <span className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-full border border-gray-100">
              📏 {sizeLabel}
            </span>
          )}
        </div>

        {plant.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-3 mb-4">{plant.description}</p>
        )}

        {lists.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              className="w-full text-sm font-medium bg-green-700 text-white py-2 rounded-lg hover:bg-green-800 transition-colors"
            >
              {added ? '✓ Added' : '+ Add to list'}
            </button>
            {showMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {lists.map(list => (
                  <button
                    key={list.id}
                    onClick={() => {
                      onAddToList(plant.id, list.id)
                      setAdded(true)
                      setShowMenu(false)
                    }}
                    className="w-full text-left text-sm px-4 py-3 hover:bg-green-50 text-gray-700 border-b last:border-0 border-gray-100"
                  >
                    {list.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlantsPage() {
  const supabase = createClient()
  const [plants, setPlants] = useState<Plant[]>([])
  const [filtered, setFiltered] = useState<Plant[]>([])
  const [lists, setLists] = useState<PlantList[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sun, setSun] = useState<string[]>([])
  const [water, setWater] = useState<string[]>([])
  const [types, setTypes] = useState<string[]>([])
  const [months, setMonths] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      const [{ data: plantData }, { data: { user } }] = await Promise.all([
        supabase.from('plants').select('*').order('common_name'),
        supabase.auth.getUser(),
      ])
      setPlants(plantData ?? [])
      if (user) {
        const { data: listData } = await supabase
          .from('plant_lists')
          .select('*')
          .eq('owner_id', user.id)
          .order('created_at', { ascending: false })
        setLists(listData ?? [])
      }
      setLoading(false)
    }
    load()
  }, [])

  const applyFilters = useCallback(() => {
    let result = plants
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(p =>
        p.common_name.toLowerCase().includes(q) ||
        (p.latin_name?.toLowerCase().includes(q) ?? false)
      )
    }
    if (sun.length) result = result.filter(p => p.sun && sun.includes(p.sun))
    if (water.length) result = result.filter(p => p.water && water.includes(p.water))
    if (types.length) result = result.filter(p => p.plant_type && types.includes(p.plant_type))
    if (months.length) result = result.filter(p =>
      p.bloom_months?.some(m => months.includes(m))
    )
    setFiltered(result)
  }, [plants, search, sun, water, types, months])

  useEffect(() => { applyFilters() }, [applyFilters])

  function toggle(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  async function handleAddToList(plantId: string, listId: string) {
    const { data: existing } = await supabase
      .from('plant_list_items')
      .select('id')
      .eq('list_id', listId)
      .eq('plant_id', plantId)
      .single()
    if (existing) return
    const { data: max } = await supabase
      .from('plant_list_items')
      .select('sort_order')
      .eq('list_id', listId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    const nextOrder = (max?.sort_order ?? -1) + 1
    await supabase.from('plant_list_items').insert({ list_id: listId, plant_id: plantId, sort_order: nextOrder })
  }

  const FilterSection = ({ label, options, selected, onToggle }: {
    label: string; options: string[]; selected: string[]; onToggle: (v: string) => void
  }) => (
    <div className="mb-6">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</h4>
      <div className="flex flex-col gap-1.5">
        {options.map(opt => (
          <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm text-gray-700 hover:text-gray-900">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => onToggle(opt)}
              className="accent-green-700 w-4 h-4"
            />
            <span className="capitalize">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex gap-8">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 hidden lg:block">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-24">
          <h3 className="font-bold text-gray-900 mb-5">Filter Plants</h3>
          <FilterSection label="Sun" options={SUN_OPTIONS} selected={sun} onToggle={v => toggle(sun, v, setSun)} />
          <FilterSection label="Water" options={WATER_OPTIONS} selected={water} onToggle={v => toggle(water, v, setWater)} />
          <FilterSection label="Type" options={TYPE_OPTIONS} selected={types} onToggle={v => toggle(types, v, setTypes)} />
          <FilterSection label="Bloom Month" options={MONTH_OPTIONS} selected={months} onToggle={v => toggle(months, v, setMonths)} />
          {(sun.length || water.length || types.length || months.length) ? (
            <button
              onClick={() => { setSun([]); setWater([]); setTypes([]); setMonths([]) }}
              className="text-xs text-red-500 hover:text-red-700 mt-2"
            >
              Clear all filters
            </button>
          ) : null}
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Plant Database</h1>
          <span className="text-sm text-gray-400">{filtered.length} plants</span>
        </div>
        <input
          type="search"
          placeholder="Search by name or latin name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full mb-6 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-600 bg-white"
        />
        {loading ? (
          <p className="text-gray-400 text-center py-20">Loading plants…</p>
        ) : filtered.length === 0 ? (
          <p className="text-gray-400 text-center py-20">No plants match your filters.</p>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map(plant => (
              <PlantCard key={plant.id} plant={plant} lists={lists} onAddToList={handleAddToList} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
