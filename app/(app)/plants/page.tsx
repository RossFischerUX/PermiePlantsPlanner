'use client'

import { useEffect, useState, useCallback, Suspense, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Plant, PlantList } from '@/lib/types'
import { ZONE_LABELS, encodeZone } from '@/lib/zones'
import { US_STATES } from '@/lib/us-states'
import Image from 'next/image'
import Link from 'next/link'

const SUN_OPTIONS = ['full sun', 'part shade', 'full shade']
const WATER_OPTIONS = ['low', 'moderate', 'high']
const TYPE_OPTIONS = ['shrub', 'tree', 'perennial', 'groundcover', 'vine', 'grass']
const MONTH_OPTIONS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DORMANCY_OPTIONS = ['evergreen', 'deciduous', 'semi-evergreen']
const GROWTH_OPTIONS = ['slow', 'moderate', 'fast']
const SEASON_OPTIONS = ['Spring', 'Summer', 'Fall', 'Winter']
const LAYER_OPTIONS = ['canopy', 'sub-canopy', 'shrub', 'herb', 'ground cover', 'rhizosphere', 'climber']
const PERM_USE_OPTIONS = ['nitrogen fixer', 'dynamic accumulator', 'edible', 'medicinal', 'pollinator', 'biomass', 'windbreak', 'wildlife habitat', 'pioneer', 'insectary']

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

function FilterSection({ label, options, selected, onToggle }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-2.5 text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] hover:text-warm-umber text-left"
      >
        <span>
          {label}
          {selected.length > 0 && (
            <span className="ml-1.5 bg-terracotta text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 normal-case tracking-normal">
              {selected.length}
            </span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-warm-stone transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="flex flex-col gap-2 pb-3 pt-1">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2.5 cursor-pointer text-sm text-warm-umber hover:text-dark-bark">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                className="accent-forest w-4 h-4"
              />
              <span className="capitalize">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

function PlantCard({ plant, lists, onAddToList, onRemoveFromList, onOpenCreateList }: {
  plant: Plant
  lists: PlantList[]
  onAddToList: (plantId: string, listId: string) => void
  onRemoveFromList: (plantId: string, listId: string) => void
  onOpenCreateList: (plantId: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [added, setAdded] = useState(false)
  const [memberListIds, setMemberListIds] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  useEffect(() => {
    if (!showMenu || lists.length === 0) return
    const supabase = createClient()
    supabase
      .from('plant_list_items')
      .select('list_id')
      .eq('plant_id', plant.id)
      .then(({ data }) => {
        setMemberListIds(new Set(data?.map(r => r.list_id) ?? []))
      })
  }, [showMenu, plant.id, lists.length])

  const sizeLabel = plant.height_min && plant.height_max
    ? `${plant.height_min}–${plant.height_max}′ tall`
    : null

  return (
    <div className="bg-cream rounded-2xl border border-warm-stone/30 shadow-warm overflow-hidden hover:shadow-warm-md transition-shadow duration-200">
      <div className="relative h-52 bg-stone-white">
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
          <div className="flex items-center justify-center h-full text-5xl opacity-30">🌿</div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-playfair text-xl font-semibold text-dark-bark mb-0.5 leading-snug">{plant.common_name}</h3>
        {plant.latin_name && (
          <p className="text-sm italic text-warm-umber mb-3">{plant.latin_name}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {plant.sun && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 whitespace-nowrap">
              {SUN_ICONS[plant.sun]} {plant.sun}
            </span>
          )}
          {plant.water && (
            <span className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full border border-teal-200 whitespace-nowrap">
              {WATER_ICONS[plant.water]} water
            </span>
          )}
          {sizeLabel && (
            <span className="inline-flex items-center text-xs bg-stone-white text-warm-umber px-2.5 py-1 rounded-full border border-warm-stone/20 whitespace-nowrap">
              {sizeLabel}
            </span>
          )}
        </div>

        {plant.description && (
          <p className="text-sm text-warm-stone leading-relaxed line-clamp-3 mb-4">{plant.description}</p>
        )}

        {lists.length > 0 && (
          <div ref={menuRef} className="relative" onClick={e => e.preventDefault()}>
            <button
              onClick={e => { e.preventDefault(); setShowMenu(v => !v) }}
              className="w-full text-sm font-medium border border-forest text-forest py-2 rounded-lg hover:bg-forest hover:text-white transition-colors duration-150"
            >
              {added ? '✓ Added' : '+ Add to list'}
            </button>
            {showMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-cream border border-warm-stone/30 rounded-xl shadow-warm-md z-10 overflow-hidden">
                {lists.map(list => {
                  const isMember = memberListIds.has(list.id)
                  return (
                    <button
                      key={list.id}
                      onClick={e => {
                        e.preventDefault()
                        if (isMember) {
                          onRemoveFromList(plant.id, list.id)
                          setMemberListIds(prev => { const next = new Set(prev); next.delete(list.id); return next })
                        } else {
                          onAddToList(plant.id, list.id)
                          setMemberListIds(prev => { const next = new Set(prev); next.add(list.id); return next })
                          setAdded(true)
                        }
                        setTimeout(() => setShowMenu(false), 550)
                      }}
                      className="w-full flex items-center gap-3 text-left text-sm px-4 py-3 hover:bg-stone-white border-b border-warm-stone/20 transition-colors"
                    >
                      <span className="w-4 flex-shrink-0 text-forest">{isMember ? '✓' : ''}</span>
                      <span className={isMember ? 'text-forest font-medium' : 'text-dark-bark'}>{list.title}</span>
                    </button>
                  )
                })}
                <button
                  onClick={e => {
                    e.preventDefault()
                    setShowMenu(false)
                    onOpenCreateList(plant.id)
                  }}
                  className="w-full text-left text-sm px-4 py-3 hover:bg-stone-white text-forest font-medium transition-colors"
                >
                  + New list…
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function split(val: string | null): string[] {
  return val ? val.split(',').filter(Boolean) : []
}

function PlantsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [plants, setPlants] = useState<Plant[]>([])
  const [filtered, setFiltered] = useState<Plant[]>([])
  const [lists, setLists] = useState<PlantList[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 100

  const [search, setSearch] = useState(searchParams.get('q') ?? '')
  const [sun, setSun] = useState<string[]>(split(searchParams.get('sun')))
  const [water, setWater] = useState<string[]>(split(searchParams.get('water')))
  const [types, setTypes] = useState<string[]>(split(searchParams.get('types')))
  const [months, setMonths] = useState<string[]>(split(searchParams.get('months')))
  const [dormancy, setDormancy] = useState<string[]>(split(searchParams.get('dormancy')))
  const [growthRate, setGrowthRate] = useState<string[]>(split(searchParams.get('growthRate')))
  const [layers, setLayers] = useState<string[]>(split(searchParams.get('layers')))
  const [permUses, setPermUses] = useState<string[]>(split(searchParams.get('permUses')))
  const [zones, setZones] = useState<string[]>(split(searchParams.get('zones')))
  const [nativeState, setNativeState] = useState(searchParams.get('state') ?? '')

  const [createModalPlantId, setCreateModalPlantId] = useState<string | null>(null)
  const [newListName, setNewListName] = useState('')
  const [newListDesc, setNewListDesc] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Sync filter state → URL so back button restores filters
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('q', search)
    if (sun.length) params.set('sun', sun.join(','))
    if (water.length) params.set('water', water.join(','))
    if (types.length) params.set('types', types.join(','))
    if (months.length) params.set('months', months.join(','))
    if (dormancy.length) params.set('dormancy', dormancy.join(','))
    if (growthRate.length) params.set('growthRate', growthRate.join(','))
    if (layers.length) params.set('layers', layers.join(','))
    if (permUses.length) params.set('permUses', permUses.join(','))
    if (zones.length) params.set('zones', zones.join(','))
    if (nativeState) params.set('state', nativeState)
    const qs = params.toString()
    router.replace(qs ? `/plants?${qs}` : '/plants', { scroll: false })
  }, [search, sun, water, types, months, dormancy, growthRate, layers, permUses, zones, nativeState, router])

  useEffect(() => {
    async function load() {
      const [{ data: page1 }, { data: page2 }, { data: { user } }] = await Promise.all([
        supabase.from('plants').select('*').order('common_name').range(0, 999),
        supabase.from('plants').select('*').order('common_name').range(1000, 1999),
        supabase.auth.getUser(),
      ])
      setPlants([...(page1 ?? []), ...(page2 ?? [])])
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
    if (months.length) result = result.filter(p => p.bloom_months?.some(m => months.includes(m)))
    if (dormancy.length) result = result.filter(p => p.dormancy && dormancy.includes(p.dormancy))
    if (growthRate.length) result = result.filter(p => p.growth_rate && growthRate.includes(p.growth_rate))
    if (layers.length) result = result.filter(p => p.forest_garden_layer && layers.includes(p.forest_garden_layer))
    if (permUses.length) result = result.filter(p => permUses.every(u => p.permaculture_uses?.includes(u)))
    if (zones.length) {
      const encoded = zones.map(z => encodeZone(z)).filter((n): n is number => n !== null)
      if (encoded.length > 0) {
        result = result.filter(p => {
          if (p.usda_zone_min === null || p.usda_zone_max === null) return false
          return encoded.some(z => p.usda_zone_min! <= z && z <= p.usda_zone_max!)
        })
      }
    }
    if (nativeState) {
      result = result.filter(p => p.native_states?.includes(nativeState))
    }
    setFiltered(result)
  }, [plants, search, sun, water, types, months, dormancy, growthRate, layers, permUses, zones, nativeState])

  useEffect(() => { applyFilters(); setPage(0) }, [applyFilters])

  function toggle(arr: string[], val: string, set: (v: string[]) => void) {
    set(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  async function handleRemoveFromList(plantId: string, listId: string) {
    await supabase.from('plant_list_items').delete().eq('list_id', listId).eq('plant_id', plantId)
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

  async function handleCreateList() {
    const plantId = createModalPlantId
    if (!newListName.trim() || !plantId) return
    setCreatingList(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreatingList(false); return }
    const { data: newList } = await supabase
      .from('plant_lists')
      .insert({ owner_id: user.id, title: newListName.trim(), description: newListDesc.trim() || null })
      .select()
      .single()
    if (newList) {
      await handleAddToList(plantId, newList.id)
      setLists(prev => [newList, ...prev])
    }
    setCreateModalPlantId(null)
    setNewListName('')
    setNewListDesc('')
    setCreatingList(false)
  }

  const hasFilters = !!(search || sun.length || water.length || types.length || months.length ||
    dormancy.length || growthRate.length || layers.length || permUses.length || zones.length || nativeState)

  const activeFilterCount =
    sun.length + water.length + types.length + months.length +
    dormancy.length + growthRate.length + layers.length + permUses.length +
    zones.length + (nativeState ? 1 : 0)

  const nativeStateName = US_STATES.find(s => s.code === nativeState)?.name ?? nativeState

  const activePills = [
    ...sun.map(v => ({ label: v, clear: () => toggle(sun, v, setSun) })),
    ...water.map(v => ({ label: `${v} water`, clear: () => toggle(water, v, setWater) })),
    ...types.map(v => ({ label: v, clear: () => toggle(types, v, setTypes) })),
    ...months.map(v => ({ label: v, clear: () => toggle(months, v, setMonths) })),
    ...dormancy.map(v => ({ label: v, clear: () => toggle(dormancy, v, setDormancy) })),
    ...growthRate.map(v => ({ label: v, clear: () => toggle(growthRate, v, setGrowthRate) })),
    ...layers.map(v => ({ label: v, clear: () => toggle(layers, v, setLayers) })),
    ...permUses.map(v => ({ label: v, clear: () => toggle(permUses, v, setPermUses) })),
    ...zones.map(v => ({ label: `Zone ${v}`, clear: () => toggle(zones, v, setZones) })),
    ...(nativeState ? [{ label: `Native to ${nativeStateName}`, clear: () => setNativeState('') }] : []),
  ]

  function clearAll() {
    setSearch(''); setSun([]); setWater([]); setTypes([]); setMonths([])
    setDormancy([]); setGrowthRate([]); setLayers([]); setPermUses([])
    setZones([]); setNativeState('')
  }

  const pageStart = page * PAGE_SIZE + 1
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, filtered.length)

  return (
    <>
    {createModalPlantId && (
      <div
        className="fixed inset-0 bg-dark-bark/40 z-50 flex items-center justify-center p-4"
        onClick={() => { setCreateModalPlantId(null); setNewListName(''); setNewListDesc('') }}
      >
        <div className="bg-cream rounded-2xl p-6 w-full max-w-sm shadow-warm-md border border-warm-stone/30" onClick={e => e.stopPropagation()}>
          <h2 className="font-playfair text-xl font-semibold text-dark-bark mb-4">New Plant List</h2>
          <div className="mb-3">
            <label className="block text-[11px] font-semibold text-warm-stone uppercase tracking-[0.05em] mb-1.5">Name</label>
            <input
              type="text"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              placeholder="My garden plan"
              autoFocus
              className="w-full px-3 py-2 border border-warm-stone/40 rounded-lg text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
            />
          </div>
          <div className="mb-5">
            <label className="block text-[11px] font-semibold text-warm-stone uppercase tracking-[0.05em] mb-1.5">
              Description <span className="text-warm-stone/60 font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={newListDesc}
              onChange={e => setNewListDesc(e.target.value)}
              placeholder="What is this list for?"
              rows={2}
              className="w-full px-3 py-2 border border-warm-stone/40 rounded-lg text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setCreateModalPlantId(null); setNewListName(''); setNewListDesc('') }}
              className="flex-1 text-sm font-medium text-warm-umber py-2 rounded-lg border border-warm-stone/40 hover:bg-stone-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateList}
              disabled={!newListName.trim() || creatingList}
              className="flex-1 text-sm font-medium bg-forest text-white py-2 rounded-lg hover:bg-forest-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creatingList ? 'Creating…' : 'Create List'}
            </button>
          </div>
        </div>
      </div>
    )}

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex gap-8">
      {/* Filter Sidebar */}
      <aside className="w-72 flex-shrink-0 hidden lg:block">
        <div className="bg-stone-white rounded-2xl p-6 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
          <h3 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">Filter Plants</h3>

          {activePills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4 pb-4 border-b border-warm-stone/20">
              {activePills.map((pill, i) => (
                <button
                  key={i}
                  onClick={pill.clear}
                  className="flex items-center gap-1 bg-terracotta text-white text-[11px] rounded-full px-2.5 py-1 hover:bg-terracotta/80 transition-colors"
                >
                  <span className="capitalize">{pill.label}</span>
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
          )}

          <FilterSection label="Permaculture Uses" options={PERM_USE_OPTIONS} selected={permUses} onToggle={v => toggle(permUses, v, setPermUses)} />
          <FilterSection label="Forest Garden Layer" options={LAYER_OPTIONS} selected={layers} onToggle={v => toggle(layers, v, setLayers)} />
          <FilterSection label="Type" options={TYPE_OPTIONS} selected={types} onToggle={v => toggle(types, v, setTypes)} />

          <hr className="border-warm-stone/20 my-3" />

          <FilterSection label="Sun" options={SUN_OPTIONS} selected={sun} onToggle={v => toggle(sun, v, setSun)} />
          <FilterSection label="Water" options={WATER_OPTIONS} selected={water} onToggle={v => toggle(water, v, setWater)} />
          <FilterSection label="Growth Rate" options={GROWTH_OPTIONS} selected={growthRate} onToggle={v => toggle(growthRate, v, setGrowthRate)} />
          <FilterSection label="Dormancy" options={DORMANCY_OPTIONS} selected={dormancy} onToggle={v => toggle(dormancy, v, setDormancy)} />

          <hr className="border-warm-stone/20 my-3" />

          <FilterSection label="Bloom Month" options={MONTH_OPTIONS} selected={months} onToggle={v => toggle(months, v, setMonths)} />

          <hr className="border-warm-stone/20 my-3" />

          <FilterSection label="USDA Zone" options={ZONE_LABELS} selected={zones} onToggle={v => toggle(zones, v, setZones)} />

          <div className="mb-1">
            <p className="w-full py-2.5 text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em]">
              Native to State
              {nativeState && (
                <span className="ml-1.5 bg-terracotta text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 normal-case tracking-normal">1</span>
              )}
            </p>
            <select
              value={nativeState}
              onChange={e => setNativeState(e.target.value)}
              className="w-full px-3 py-2 border border-warm-stone/40 rounded-lg text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
            >
              <option value="">Any state</option>
              {US_STATES.map(s => (
                <option key={s.code} value={s.code}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="font-playfair text-3xl font-semibold text-dark-bark mb-1.5">Plant Database</h1>
          <p className="text-warm-umber text-base mb-5">Browse our curated permaculture plant collection</p>
          <input
            type="search"
            placeholder="Search by name or latin name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-5 py-3 border border-warm-stone/40 rounded-full text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest placeholder:text-warm-stone"
          />
        </div>

        {/* Mobile filter toggle */}
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
                <FilterSection label="Permaculture Uses" options={PERM_USE_OPTIONS} selected={permUses} onToggle={v => toggle(permUses, v, setPermUses)} />
                <FilterSection label="Forest Garden Layer" options={LAYER_OPTIONS}   selected={layers}   onToggle={v => toggle(layers, v, setLayers)} />
                <FilterSection label="Type"                options={TYPE_OPTIONS}    selected={types}    onToggle={v => toggle(types, v, setTypes)} />
                <hr className="border-warm-stone/20 my-2" />
                <FilterSection label="Sun"         options={SUN_OPTIONS}      selected={sun}        onToggle={v => toggle(sun, v, setSun)} />
                <FilterSection label="Water"       options={WATER_OPTIONS}    selected={water}      onToggle={v => toggle(water, v, setWater)} />
                <FilterSection label="Growth Rate" options={GROWTH_OPTIONS}   selected={growthRate} onToggle={v => toggle(growthRate, v, setGrowthRate)} />
                <FilterSection label="Dormancy"    options={DORMANCY_OPTIONS} selected={dormancy}   onToggle={v => toggle(dormancy, v, setDormancy)} />
                <hr className="border-warm-stone/20 my-2" />
                <FilterSection label="Bloom Month" options={MONTH_OPTIONS}    selected={months}     onToggle={v => toggle(months, v, setMonths)} />
                <hr className="border-warm-stone/20 my-2" />
                <FilterSection label="USDA Zone" options={ZONE_LABELS} selected={zones} onToggle={v => toggle(zones, v, setZones)} />
                <div className="mb-1 pb-2">
                  <p className="w-full py-2.5 text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em]">Native to State</p>
                  <select
                    value={nativeState}
                    onChange={e => setNativeState(e.target.value)}
                    className="w-full px-3 py-2 border border-warm-stone/40 rounded-lg text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
                  >
                    <option value="">Any state</option>
                    {US_STATES.map(s => (
                      <option key={s.code} value={s.code}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-warm-stone/20">
                <button onClick={clearAll} className="text-sm font-medium text-warm-stone hover:text-terracotta transition-colors">
                  Clear all
                </button>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="bg-forest text-white text-sm font-semibold py-2 px-4 rounded-lg hover:bg-forest-dark transition-colors"
                >
                  Show {filtered.length} plant{filtered.length !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-warm-stone text-center py-20">Loading plants…</p>
        ) : filtered.length === 0 ? (
          <p className="text-warm-stone text-center py-20">No plants match your filters.</p>
        ) : (
          <>
            <p className="text-sm font-medium text-warm-umber mb-5">
              Showing {pageStart}–{pageEnd} of {filtered.length} plant{filtered.length !== 1 ? 's' : ''}
            </p>

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(plant => (
                <Link key={plant.id} href={`/plants/${plant.id}`} className="block">
                  <PlantCard plant={plant} lists={lists} onAddToList={handleAddToList} onRemoveFromList={handleRemoveFromList} onOpenCreateList={setCreateModalPlantId} />
                </Link>
              ))}
            </div>

            {filtered.length > PAGE_SIZE && (
              <div className="flex items-center gap-3 mt-10">
                <button
                  onClick={() => { setPage(p => p - 1); window.scrollTo(0, 0) }}
                  disabled={page === 0}
                  className="px-4 py-2 text-sm font-medium text-warm-umber border border-warm-stone/40 rounded-lg hover:bg-stone-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <span className="text-sm text-warm-stone">
                  Page {page + 1} of {Math.ceil(filtered.length / PAGE_SIZE)}
                </span>
                <button
                  onClick={() => { setPage(p => p + 1); window.scrollTo(0, 0) }}
                  disabled={(page + 1) * PAGE_SIZE >= filtered.length}
                  className="px-4 py-2 text-sm font-medium text-warm-umber border border-warm-stone/40 rounded-lg hover:bg-stone-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </>
  )
}

export default function PlantsPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-10 text-warm-stone">Loading…</div>}>
      <PlantsPageInner />
    </Suspense>
  )
}
