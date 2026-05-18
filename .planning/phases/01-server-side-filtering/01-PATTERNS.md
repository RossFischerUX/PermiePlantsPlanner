# Phase 1: Server-Side Filtering - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `app/(app)/plants/page.tsx` | page (RSC) | request-response + CRUD | `app/(app)/lists/page.tsx` | exact |
| `app/(app)/plants/searchParams.ts` | utility/config | transform | `lib/zones.ts` | role-match |
| `app/(app)/plants/actions.ts` | service (Server Action) | CRUD | `app/(app)/lists/[id]/page.tsx` inline fetch | role-match |
| `app/(app)/plants/FilterSection.tsx` | component | event-driven | `app/(app)/plants/page.tsx` lines 33–75 (inline) | exact (extract) |
| `app/(app)/plants/FilterControls.tsx` | component | event-driven | `app/(app)/plants/page.tsx` lines 452–598 (sidebar JSX) | exact (extract + nuqs) |
| `app/(app)/plants/PlantsFilterSidebar.tsx` | component | request-response | `app/(app)/NavUser.tsx` | role-match |
| `app/(app)/plants/PlantCard.tsx` | component | event-driven + CRUD | `app/(app)/plants/page.tsx` lines 77–211 (inline) | exact (extract) |
| `app/(app)/plants/PlantsGrid.tsx` | component | CRUD + event-driven | `app/(app)/lists/[id]/ListItemActions.tsx` | role-match |
| `app/(app)/plants/PlantCardSkeleton.tsx` | component | — | `app/(app)/lists/page.tsx` empty state | partial |
| `lib/plant-labels.ts` | utility | transform | `app/(app)/plants/[id]/page.tsx` lines 8–17 | exact (extract) |
| `app/layout.tsx` | layout (modified) | — | current `app/layout.tsx` | exact |
| `tests/plants.spec.ts` | test | — | existing `tests/plants.spec.ts` | exact |

---

## Pattern Assignments

### `app/(app)/plants/page.tsx` (RSC page, request-response)

**Analog:** `app/(app)/lists/page.tsx` (RSC that runs Supabase queries inline and renders results)

**Imports pattern** (`app/(app)/lists/page.tsx` lines 1–4):
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NewListForm from './NewListForm'
```

For `page.tsx` adapt to:
```typescript
import { createClient } from '@/lib/supabase/server'
import { Suspense } from 'react'
import type { SearchParams } from 'nuqs/server'
import { plantSearchParamsCache } from './searchParams'
import PlantsGrid from './PlantsGrid'
import PlantsFilterSidebar from './PlantsFilterSidebar'
import { SkeletonGrid } from './PlantCardSkeleton'
```

**Auth + parallel data fetch pattern** (`app/(app)/lists/page.tsx` lines 6–15):
```typescript
export default async function ListsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: lists } = await supabase
    .from('plant_lists')
    .select('*, plant_list_items(count)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })
```

For `page.tsx` adapt to (plants is public — no redirect; use Promise.all):
```typescript
export default async function PlantsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await plantSearchParamsCache.parse(searchParams)
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: plants }, { count }, { data: lists }] = await Promise.all([
    buildPlantsQuery(supabase, params).range(0, 23),
    buildPlantsQuery(supabase, params).select('*', { count: 'exact', head: true }),
    user
      ? supabase.from('plant_lists').select('*').eq('owner_id', user.id).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] }),
  ])
```

**Page layout pattern** (`app/(app)/lists/page.tsx` lines 17–19):
```typescript
  return (
    <div className="bg-parchment min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-12">
```

For `page.tsx` — use 7xl and sidebar flex pattern (from current `plants/page.tsx` lines 451–453):
```typescript
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex gap-8">
      <PlantsFilterSidebar />
      <div className="flex-1 min-w-0">
        <Suspense fallback={<SkeletonGrid />}>
          <PlantsGrid
            initialPlants={plants ?? []}
            totalCount={count ?? 0}
            filterParams={params}
            lists={lists ?? []}
            key={JSON.stringify(params)}
          />
        </Suspense>
      </div>
    </div>
```

**RSC multi-query + notFound pattern** (`app/(app)/plants/[id]/page.tsx` lines 1, 28–38):
```typescript
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'

export default async function PlantDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: plant } = await supabase
    .from('plants')
    .select('*')
    .eq('id', id)
    .single()

  if (!plant) notFound()
```

---

### `app/(app)/plants/searchParams.ts` (utility/config, transform)

**Analog:** `lib/zones.ts` — defines and exports a lookup structure consumed by other files.

**Structure pattern** (`lib/zones.ts` lines 1–17):
```typescript
// Half-zone encoding: N_a = N*2, N_b = N*2+1
// e.g. 9a=18, 9b=19, 10a=20, 10b=21

export const ZONE_LABELS: string[] = []
for (let n = 1; n <= 13; n++) {
  ZONE_LABELS.push(`${n}a`, `${n}b`)
}

export function encodeZone(label: string): number | null {
  // ...
}
```

For `searchParams.ts` the equivalent is exporting parser definitions and the cache:
```typescript
// searchParams.ts — nuqs parser definitions for the plant browser.
// RSC pages use plantSearchParamsCache.parse(searchParams).
// Client components use useQueryStates(plantSearchParsers, ...).
import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsString,
} from 'nuqs/server'

export const plantSearchParsers = {
  sun:        parseAsArrayOf(parseAsString).withDefault([]),
  water:      parseAsArrayOf(parseAsString).withDefault([]),
  types:      parseAsArrayOf(parseAsString).withDefault([]),
  months:     parseAsArrayOf(parseAsString).withDefault([]),
  dormancy:   parseAsArrayOf(parseAsString).withDefault([]),
  growthRate: parseAsArrayOf(parseAsString).withDefault([]),
  layers:     parseAsArrayOf(parseAsString).withDefault([]),
  permUses:   parseAsArrayOf(parseAsString).withDefault([]),
  zones:      parseAsArrayOf(parseAsString).withDefault([]),
  state:      parseAsString.withDefault(''),
  q:          parseAsString.withDefault(''),
}

export const plantSearchParamsCache = createSearchParamsCache(plantSearchParsers)
export type PlantSearchParams = ReturnType<typeof plantSearchParamsCache.all>
```

---

### `app/(app)/plants/actions.ts` (Server Action, CRUD)

**Analog:** `app/(app)/plants/[id]/page.tsx` inline Supabase fetch — same `createClient()` from server, same `.from('plants').select('*')` shape.

**Server client import pattern** (`app/(app)/plants/[id]/page.tsx` lines 1, 29):
```typescript
import { createClient } from '@/lib/supabase/server'

const supabase = await createClient()
```

**Server Action pattern** — no existing Server Action in the codebase yet; use Next.js 14 `'use server'` directive:
```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { encodeZone } from '@/lib/zones'
import type { Plant } from '@/lib/types'
import type { PlantSearchParams } from './searchParams'

function buildPlantsQuery(
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
  if (params.months.length)     query = query.overlaps('bloom_months', params.months)
  if (params.permUses.length)   query = query.contains('permaculture_uses', params.permUses)
  if (params.state)             query = query.contains('native_states', [params.state])
  if (params.zones.length) {
    const encoded = params.zones.map(z => encodeZone(z)).filter((n): n is number => n !== null)
    if (encoded.length > 0) {
      query = query.lte('usda_zone_min', Math.max(...encoded)).gte('usda_zone_max', Math.min(...encoded))
    }
  }
  if (params.q) query = query.or(`common_name.ilike.%${params.q}%,latin_name.ilike.%${params.q}%`)
  return query
}

export async function fetchMorePlants(params: PlantSearchParams, offset: number): Promise<Plant[]> {
  const supabase = await createClient()
  const { data } = await buildPlantsQuery(supabase, params).range(offset, offset + 23)
  return data ?? []
}
```

Note: `buildPlantsQuery` must also be importable by `page.tsx`. Export it from `actions.ts` or move it to a shared file if a bundling conflict occurs (see RESEARCH.md A4).

---

### `app/(app)/plants/FilterSection.tsx` (component, event-driven)

**Analog:** `app/(app)/plants/page.tsx` lines 33–75 — extract verbatim.

**Full component to extract** (`app/(app)/plants/page.tsx` lines 33–75):
```typescript
'use client'

import { useState } from 'react'

export default function FilterSection({ label, options, selected, onToggle }: {
  label: string
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
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
```

Add `'use client'` directive at the top (not present in the inline version since the parent was already `'use client'`).

---

### `app/(app)/plants/FilterControls.tsx` (component, event-driven)

**Analog:** `app/(app)/plants/page.tsx` lines 452–598 (sidebar + drawer filter JSX) — plus pattern from `app/(app)/NavUser.tsx` for how client components use `createClient` and handlers.

**Client component directive + imports pattern** (`app/(app)/NavUser.tsx` lines 1–7):
```typescript
'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'
```

**nuqs hook pattern** (new — from RESEARCH.md Pattern 2):
```typescript
'use client'

import { useQueryStates } from 'nuqs'
import { useTransition } from 'react'
import { plantSearchParsers } from './searchParams'
import FilterSection from './FilterSection'
import {
  SUN_OPTIONS, WATER_OPTIONS, TYPE_OPTIONS, MONTH_OPTIONS,
  DORMANCY_OPTIONS, GROWTH_OPTIONS, LAYER_OPTIONS, PERM_USE_OPTIONS,
} from '@/lib/plant-labels'
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
    setFilters({ sun: [], water: [], types: [], months: [], dormancy: [],
      growthRate: [], layers: [], permUses: [], zones: [], state: '', q: '' })
  }
```

**Active pills pattern** (from `app/(app)/plants/page.tsx` lines 457–475):
```typescript
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
```

**FilterSection usage pattern** (from `app/(app)/plants/page.tsx` lines 478–495):
```typescript
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
```

**Native state select pattern** (from `app/(app)/plants/page.tsx` lines 497–514):
```typescript
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
```

---

### `app/(app)/plants/PlantsFilterSidebar.tsx` (component, request-response)

**Analog:** `app/(app)/NavUser.tsx` — co-located client island that wraps behavior; passed no data props.

**Client island wrapper pattern** (`app/(app)/NavUser.tsx` lines 1–8):
```typescript
'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function NavUser({ user }: { user: User | null }) {
```

For `PlantsFilterSidebar.tsx`:
```typescript
'use client'

import FilterControls from './FilterControls'

export default function PlantsFilterSidebar() {
  return (
    // Desktop sticky sidebar (from page.tsx lines 453–516)
    <aside className="w-72 flex-shrink-0 hidden lg:block">
      <div className="bg-stone-white rounded-2xl p-6 sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
        <h3 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">Filter Plants</h3>
        <FilterControls />
      </div>
    </aside>
  )
}
```

The mobile drawer toggle button and drawer panel also live here (from `app/(app)/plants/page.tsx` lines 533–598) — same DOM structure, same `drawerOpen` boolean state, same `bg-stone-white` panel.

**Mobile drawer toggle pattern** (from `app/(app)/plants/page.tsx` lines 534–550):
```typescript
        <div className="lg:hidden mb-5">
          <button
            onClick={() => setDrawerOpen(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 bg-stone-white border border-warm-stone/30 text-sm font-medium text-warm-umber hover:bg-stone-white/80 transition-colors ${drawerOpen ? 'rounded-t-xl border-b-0' : 'rounded-xl'}`}
          >
            <span className="flex items-center gap-2">
              <svg ...>...</svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-terracotta text-white text-xs font-bold">
                  {activeFilterCount}
                </span>
              )}
            </span>
```

---

### `app/(app)/plants/PlantCard.tsx` (component, event-driven + CRUD)

**Analog:** `app/(app)/plants/page.tsx` lines 77–211 — extract verbatim.

**Full component to extract** (`app/(app)/plants/page.tsx` lines 77–211):
```typescript
'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Plant, PlantList } from '@/lib/types'
import { SUN_ICONS, WATER_ICONS } from '@/lib/plant-labels'

export default function PlantCard({ plant, lists, onAddToList, onRemoveFromList, onOpenCreateList }: {
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
  // ... (full body from page.tsx lines 88–211)
```

**Card shell styling** (from `app/(app)/plants/page.tsx` line 117):
```typescript
    <div className="bg-cream rounded-2xl border border-warm-stone/30 shadow-warm overflow-hidden hover:shadow-warm-md transition-shadow duration-200">
```

**Add-to-list button pattern** (from `app/(app)/plants/page.tsx` lines 160–207):
```typescript
        {lists.length > 0 && (
          <div ref={menuRef} className="relative" onClick={e => e.preventDefault()}>
            <button
              onClick={e => { e.preventDefault(); setShowMenu(v => !v) }}
              className="w-full text-sm font-medium border border-forest text-forest py-2 rounded-lg hover:bg-forest hover:text-white transition-colors duration-150"
            >
              {added ? '✓ Added' : '+ Add to list'}
            </button>
```

Add `'use client'` directive and import `SUN_ICONS`, `WATER_ICONS` from `@/lib/plant-labels` instead of inline constants.

---

### `app/(app)/plants/PlantsGrid.tsx` (component, CRUD + event-driven)

**Analog:** `app/(app)/lists/[id]/ListItemActions.tsx` — client component that calls Supabase mutations, holds `loading` state, calls `router.refresh()` or Server Actions.

**Client component with mutation + loading state** (`app/(app)/lists/[id]/ListItemActions.tsx` lines 1–30):
```typescript
'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ListItemActions({ itemId, listId }: { itemId: string; listId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRemove() {
    if (!confirm('Remove this plant from the list?')) return
    setLoading(true)
    await supabase.from('plant_list_items').delete().eq('id', itemId)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      disabled={loading}
      className="... disabled:opacity-40 ..."
    >
      {loading ? '…' : '×'}
    </button>
  )
}
```

**`PlantsGrid` adapts this to `useTransition` + Server Action + accumulated state:**
```typescript
'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import PlantCard from './PlantCard'
import { fetchMorePlants } from './actions'
import type { Plant, PlantList } from '@/lib/types'
import type { PlantSearchParams } from './searchParams'

export default function PlantsGrid({
  initialPlants,
  totalCount,
  filterParams,
  lists,
}: {
  initialPlants: Plant[]
  totalCount: number
  filterParams: PlantSearchParams
  lists: PlantList[]
}) {
  const [plants, setPlants] = useState(initialPlants)
  const [isPending, startTransition] = useTransition()

  function handleLoadMore() {
    startTransition(async () => {
      const next = await fetchMorePlants(filterParams, plants.length)
      setPlants(prev => [...prev, ...next])
    })
  }
```

**Load more button styling** (follow disabled button pattern from `app/(app)/plants/page.tsx` lines 624–631):
```typescript
          className="px-4 py-2 text-sm font-medium text-warm-umber border border-warm-stone/40 rounded-lg hover:bg-stone-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
```

**Plant grid layout** (from `app/(app)/plants/page.tsx` line 611):
```typescript
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
```

**"Showing X of Y" text style** (from `app/(app)/plants/page.tsx` lines 607–609):
```typescript
            <p className="text-sm font-medium text-warm-umber mb-5">
              Showing {pageStart}–{pageEnd} of {filtered.length} plant{filtered.length !== 1 ? 's' : ''}
            </p>
```

---

### `app/(app)/plants/PlantCardSkeleton.tsx` (component, no data flow)

**Analog:** Empty state block in `app/(app)/lists/page.tsx` lines 58–70 — same `bg-cream rounded-2xl` card shell, `animate-pulse` is Tailwind built-in.

**Empty state card shell** (`app/(app)/lists/page.tsx` lines 58–70):
```typescript
          <div className="mt-8 text-center py-20 bg-cream rounded-2xl border border-warm-stone/20">
            <div className="w-14 h-14 bg-forest/10 rounded-full flex items-center justify-center mx-auto mb-4">
```

**Skeleton card — copy from RESEARCH.md** (no existing analog; use design system tokens):
```typescript
export function PlantCardSkeleton() {
  return (
    <div className="bg-stone-white rounded-2xl border border-warm-stone/20 overflow-hidden animate-pulse">
      <div className="h-52 bg-warm-stone/10 rounded-t-2xl" />
      <div className="p-5">
        <div className="h-5 w-3/4 bg-warm-stone/20 rounded mt-0" />
        <div className="h-3 w-1/2 bg-warm-stone/15 rounded mt-2" />
        <div className="flex gap-2 mt-3">
          <div className="h-6 w-16 bg-warm-stone/15 rounded-full" />
          <div className="h-6 w-16 bg-warm-stone/15 rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 24 }, (_, i) => <PlantCardSkeleton key={i} />)}
    </div>
  )
}
```

No `'use client'` needed — no browser state.

---

### `lib/plant-labels.ts` (utility, transform)

**Analog:** `app/(app)/plants/[id]/page.tsx` lines 8–17 + `app/(app)/plants/page.tsx` lines 12–31 — both files define the same constants. This file consolidates them.

**Constants to extract from `app/(app)/plants/page.tsx` lines 12–31:**
```typescript
export const SUN_OPTIONS = ['full sun', 'part shade', 'full shade']
export const WATER_OPTIONS = ['low', 'moderate', 'high']
export const TYPE_OPTIONS = ['shrub', 'tree', 'perennial', 'groundcover', 'vine', 'grass']
export const MONTH_OPTIONS = ['January','February','March','April','May','June','July','August','September','October','November','December']
export const DORMANCY_OPTIONS = ['evergreen', 'deciduous', 'semi-evergreen']
export const GROWTH_OPTIONS = ['slow', 'moderate', 'fast']
export const SEASON_OPTIONS = ['Spring', 'Summer', 'Fall', 'Winter']
export const LAYER_OPTIONS = ['canopy', 'sub-canopy', 'shrub', 'herb', 'ground cover', 'rhizosphere', 'climber']
export const PERM_USE_OPTIONS = ['nitrogen fixer', 'dynamic accumulator', 'edible', 'medicinal', 'pollinator', 'biomass', 'windbreak', 'wildlife habitat', 'pioneer', 'insectary']

export const SUN_ICONS: Record<string, string> = {
  'full sun': '☀️',
  'part shade': '⛅',
  'full shade': '🌥️',
}
export const WATER_ICONS: Record<string, string> = {
  'low': '💧',
  'moderate': '💧💧',
  'high': '💧💧💧',
}
```

**Also consolidate from `app/(app)/plants/[id]/page.tsx` lines 8–17** — same `SUN_ICONS` and `WATER_ICONS` objects; after extraction those inline definitions are replaced with imports from `@/lib/plant-labels`.

**File pattern** — follow `lib/zones.ts` style: constants at top, no default export, named exports only, no comments unless encoding is non-obvious.

---

### `app/layout.tsx` (layout, modified — NuqsAdapter added)

**Analog:** Current `app/layout.tsx` lines 1–30 — wrap `{children}` with `NuqsAdapter`.

**Current pattern** (lines 22–30):
```typescript
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-parchment font-inter">
        {children}
      </body>
    </html>
  )
}
```

**Modified pattern — add NuqsAdapter import and wrap:**
```typescript
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-parchment font-inter">
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  )
}
```

---

### `tests/plants.spec.ts` (test, extended)

**Analog:** Existing `tests/plants.spec.ts` — extend the `'Plant browser — public'` describe block. Copy test structure verbatim.

**Test structure pattern** (`tests/plants.spec.ts` lines 1–10, 19–27):
```typescript
import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

async function getFilteredCount(page: Page): Promise<number> {
  const text = await page.locator('p', { hasText: 'Showing' }).first().textContent() ?? ''
  const match = text.match(/of (\d+) plant/)
  return match ? parseInt(match[1]) : 0
}

test.describe('Plant browser — public', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('loads plants with count badge', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
```

**Filter + URL assertion pattern** (`tests/plants.spec.ts` lines 107–117):
```typescript
  test('USDA Zone filter section expands and updates URL', async ({ page }) => {
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    const zoneBtn = page.locator('aside button').filter({ hasText: 'USDA Zone' })
    await zoneBtn.scrollIntoViewIfNeeded()
    await zoneBtn.click()
    const nineB = page.locator('aside label').filter({ hasText: /^9b/ })
    await expect(nineB).toBeVisible()
    await nineB.locator('input[type="checkbox"]').check()
    await expect(page).toHaveURL(/zones=9b/, { timeout: 5000 })
  })
```

**Network intercept pattern** (from RESEARCH.md Validation Architecture — no existing analog):
```typescript
  test('filter change does not download full catalog', async ({ page }) => {
    let supabaseRequestCount = 0
    let maxResponseSize = 0
    page.on('response', async (response) => {
      if (response.url().includes('/rest/v1/plants')) {
        supabaseRequestCount++
        const body = await response.body()
        maxResponseSize = Math.max(maxResponseSize, body.length)
      }
    })
    await page.goto('/plants')
    await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })
    supabaseRequestCount = 0
    maxResponseSize = 0
    await page.locator('aside button').filter({ hasText: 'Sun' }).click()
    await page.locator('aside label').filter({ hasText: 'full sun' }).locator('input[type="checkbox"]').check()
    await page.waitForSelector('p:has-text("Showing")')
    expect(supabaseRequestCount).toBeLessThanOrEqual(2)
    expect(maxResponseSize).toBeLessThan(100_000)
  })
```

**Card count assertion pattern** (from existing test line 94):
```typescript
    expect(await page.getByRole('button', { name: '+ Add to list' }).count()).toBe(0)
```

Adapt for 24-card initial load:
```typescript
    const cards = page.locator('.bg-cream.rounded-2xl')
    await expect(cards).toHaveCount(24)   // page size is 24
```

---

## Shared Patterns

### Supabase Client Selection
**Rule:** RSC pages and Server Actions → `lib/supabase/server.ts`; `'use client'` components → `lib/supabase/client.ts`.

**Server import** (`app/(app)/lists/page.tsx` line 1):
```typescript
import { createClient } from '@/lib/supabase/server'
// usage: const supabase = await createClient()
```

**Client import** (`app/(app)/lists/[id]/ListItemActions.tsx` line 3):
```typescript
import { createClient } from '@/lib/supabase/client'
// usage: const supabase = createClient()  (not awaited)
```

**Apply to:** `page.tsx` (server), `actions.ts` (server), `PlantsGrid.tsx` (client, if direct Supabase needed), `PlantCard.tsx` (client, for add-to-list).

### Botanical Heritage Button Styles
**Source:** `app/(app)/plants/page.tsx`
**Apply to:** All new components with interactive buttons.

| Button type | Classes |
|---|---|
| Primary (forest) | `bg-forest text-white rounded-lg hover:bg-forest-dark transition-colors` |
| Secondary (outline forest) | `border border-forest text-forest rounded-lg hover:bg-forest hover:text-white transition-colors duration-150` |
| Tertiary (outline stone) | `border border-warm-stone/40 text-warm-umber rounded-lg hover:bg-stone-white transition-colors` |
| Destructive/remove chip | `bg-terracotta text-white rounded-full hover:bg-terracotta/80 transition-colors` |
| Disabled | `disabled:opacity-50 disabled:cursor-not-allowed` |

### Section Label / Eyebrow Typography
**Source:** `app/(app)/plants/page.tsx` line 455 + `app/(app)/lists/page.tsx` line 21
```typescript
className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em]"
```
Apply to: filter section headers, sidebar heading, "Filter Plants" label.

### Card Shell
**Source:** `app/(app)/plants/page.tsx` line 117
```typescript
className="bg-cream rounded-2xl border border-warm-stone/30 shadow-warm overflow-hidden hover:shadow-warm-md transition-shadow duration-200"
```
Apply to: `PlantCard.tsx`.

### Empty State Block
**Source:** `app/(app)/lists/page.tsx` lines 58–70
```typescript
          <div className="mt-8 text-center py-20 bg-cream rounded-2xl border border-warm-stone/20">
            <div className="w-14 h-14 bg-forest/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🌱</span>
            </div>
            <p className="font-playfair text-lg font-semibold text-dark-bark">No lists yet</p>
            <p className="text-warm-umber text-sm mt-1 mb-5">...</p>
```
Apply to: `PlantsGrid.tsx` empty state (zero results after filter).

### Page Heading
**Source:** `app/(app)/lists/page.tsx` line 23 + `app/(app)/plants/page.tsx` lines 521–523
```typescript
<h1 className="font-playfair text-3xl font-semibold text-dark-bark mb-1.5">Plant Database</h1>
<p className="text-warm-umber text-base mb-5">Browse our curated permaculture plant collection</p>
```

### Form Input
**Source:** `app/(app)/plants/page.tsx` line 529
```typescript
className="w-full px-3 py-2 border border-warm-stone/40 rounded-lg text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
```
Apply to: search input, native state select.

### Search Input (rounded-full variant)
**Source:** `app/(app)/plants/page.tsx` lines 524–530
```typescript
          <input
            type="search"
            placeholder="Search by name or latin name…"
            className="w-full px-5 py-3 border border-warm-stone/40 rounded-full text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest placeholder:text-warm-stone"
          />
```

### `@/*` Path Alias
**Source:** All existing files — always use `@/lib/...` not relative `../lib/...`
```typescript
import { createClient } from '@/lib/supabase/server'
import type { Plant } from '@/lib/types'
import { ZONE_LABELS } from '@/lib/zones'
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `app/(app)/plants/actions.ts` | Server Action | CRUD | No existing Server Actions in codebase — use `'use server'` directive; pattern from RESEARCH.md Pattern 4 |
| `app/(app)/plants/searchParams.ts` | nuqs cache | transform | No existing nuqs usage in codebase — use `createSearchParamsCache` from RESEARCH.md Pattern 1 |
| `app/(app)/plants/ActiveFilterChips.tsx` | component | event-driven | No existing chip-above-grid component — adapt pill pattern from sidebar (`plants/page.tsx` lines 457–475), make it a standalone client component reading from nuqs |

---

## Metadata

**Analog search scope:** `app/(app)/`, `lib/`, `tests/`
**Files scanned:** 12
**Pattern extraction date:** 2026-05-18
