# Phase 1: Server-Side Filtering - Research

**Researched:** 2026-05-18
**Domain:** Next.js 14 App Router RSC + nuqs URL state + Supabase server-side filtering + append pagination
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `app/(app)/plants/page.tsx` becomes an RSC. It reads `searchParams` (via nuqs server utilities), runs the filtered Supabase query inline, and renders the initial result set.
- **D-02:** A client `FilterBar` island uses nuqs `useQueryState` hooks to read/write URL params. URL is the single source of truth — no prop drilling from RSC parent.
- **D-03:** Existing `FilterSection` and `PlantCard` logic extracted to separate co-located files, kept intact — no logic rewrites.
- **D-04:** The filtered Supabase query lives directly in `page.tsx` (inline, not a lib helper).
- **D-05:** "Load more" button — appends next page of results to the current grid. No infinite scroll, no page numbers.
- **D-06:** Page size: 24 plants per page.
- **D-07:** Show result count via a separate `COUNT` query with the same filters — "Showing 24 of 47 plants". Run in parallel.
- **D-08:** Any filter change resets to page 1 and replaces the loaded result set entirely.
- **D-09:** Extract `FilterSection` to a reusable component, `PlantCard` to its own file, and shared constants (`SUN_ICONS`, `WATER_ICONS`, `SUN_LABELS`, `WATER_LABELS`, etc.) to `lib/plant-labels.ts`.
- **D-10:** Desktop sidebar and mobile drawer both render a single shared `FilterControls` component.
- **D-11:** All extracted components co-located in `app/(app)/plants/`.
- **D-12:** Loading state: skeleton cards — 24 placeholder card-shaped rectangles while server results load.
- **D-13:** No debounce on URL updates — instant on each filter checkbox toggle.
- **D-14:** Empty state: friendly message + active filter chips showing each applied filter with an individual × remove button.
- **D-15:** Active filter chips also appear above the results grid — visible on both mobile and desktop at all times.

### Claude's Discretion
- Exact file names for extracted components (`PlantsFilterSidebar.tsx` vs `FilterBar.tsx` etc.)
- nuqs configuration details (serializer format for arrays, shallow routing vs full navigation)
- Skeleton card implementation details (exact dimensions, animation style)

### Deferred Ideas (OUT OF SCOPE)
- `lib/plant-labels.ts` consolidation benefits Phase 2 — extract now, keep extensible
- Personalized relevance ranking (PERS-01) — deferred to v2
- Full-text search (SRCH-01) — deferred to v2
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PERF-01 | Plant browser filter state lives in the URL (shareable, bookmarkable, RSC-compatible) via nuqs | nuqs 2.8.9 `createSearchParamsCache` + `useQueryState(shallow:false)` pattern; URL becomes single source of truth |
| PERF-02 | Plant catalog is fetched server-side with pagination and server-applied filters — no full client-side load | Supabase `.range(from, to)` + dynamic filter chaining; RSC page fetches only the current page's records |
</phase_requirements>

---

## Summary

Phase 1 converts `app/(app)/plants/page.tsx` from a 654-line `'use client'` component that downloads up to 2000 rows into an RSC shell that fetches only the current page of results server-side. The refactor has three interlocking parts: (1) URL-driven filter state via nuqs, (2) server-side Supabase query with dynamic filter chaining, and (3) client-side "load more" state that accumulates pages without nuqs.

The nuqs library (v2.8.9) is the right tool for D-01 and D-02. Its `createSearchParamsCache` API lets the RSC page parse `searchParams` type-safely, and `useQueryState(shallow: false)` in client components triggers RSC re-renders on filter change without prop drilling. The critical architectural insight is that filter changes must use `shallow: false` to cause the RSC to re-execute its Supabase query — the default `shallow: true` updates the URL client-only and does not notify the server.

The "load more" pagination (D-05) cannot be a pure RSC pattern because it requires client-side state accumulation: each "load more" action appends to an in-memory list. The recommended pattern is a client wrapper component (`PlantsGrid`) that holds accumulated plants in `useState`, calls a Server Action for each subsequent page, and appends results. Filter changes reset this state entirely (D-08). The RSC page passes the initial page's data as a prop; subsequent pages are fetched client-side via Server Action.

**Primary recommendation:** Implement `PlantsGrid` as a `'use client'` component that accepts initial RSC-fetched data as props and manages subsequent "load more" fetches via a Server Action that mirrors the same Supabase filter logic. Use `shallow: false` on all nuqs hooks in `FilterControls` so filter changes trigger a full RSC re-render with fresh page-1 data.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filter state (URL) | Browser/Client | Frontend Server (RSC reads it) | nuqs `useQueryState` writes URL; RSC reads via `createSearchParamsCache` |
| Initial page data fetch (page 1) | Frontend Server (RSC) | — | `page.tsx` becomes async RSC; Supabase query runs at server render time |
| Subsequent pages ("load more") | Browser/Client | API/Backend (Server Action) | Client accumulates state; Server Action runs the next-page Supabase query |
| Count query ("Showing X of Y") | Frontend Server (RSC) | — | Parallel Supabase `count` query in the RSC; passed as prop |
| Filter chip rendering | Browser/Client | — | `ActiveFilterChips` client component reads from nuqs |
| Skeleton loading state | Browser/Client | — | Suspense fallback rendered in the client boundary |
| Add-to-list mutations | Browser/Client | — | `AddToListClient` already client; no change |
| List fetch (auth user's lists) | Frontend Server (RSC) | — | RSC fetches user session + lists; passes as prop to `PlantCard` |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| nuqs | 2.8.9 | URL search param state management | Featured at Next.js Conf 2025; 2M+ weekly downloads; official Next.js 14.2.0+ support; peer-dep aligned |
| @supabase/supabase-js | 2.105.4 (already installed) | Database client for server-side queries | Already in project |
| @supabase/ssr | 0.10.3 (already installed) | SSR-safe Supabase client | Already in project |
| react | 18.3.1 (already installed) | `useTransition` for pending state during RSC re-render | Already in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| next (built-in) | 14.2.35 | `Suspense`, Server Actions | Suspense wraps the results grid; Server Action handles "load more" fetches |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| nuqs | `useSearchParams` + `router.replace` manually | nuqs is the locked decision (D-02); manual approach already in the 654-line file and has duplication/sync bugs |
| Server Action for load more | Route Handler (`/api/plants`) | Server Action is simpler — no HTTP boilerplate, same type safety, no separate file |
| Client state for load more | URL `page` param + RSC | URL-based page param would reload the entire RSC on "load more"; client accumulation (D-05) is the correct pattern for append behavior |

**Installation:**
```bash
npm install nuqs
```

**Version verification:** `npm view nuqs version` → `2.8.9` (verified 2026-05-18) [VERIFIED: npm registry]

---

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| nuqs | npm | ~2.5 yrs (created 2023-11-19) | 2.09M/wk | github.com/47ng/nuqs | N/A (slopcheck unavailable) | Approved — see notes |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

**slopcheck availability:** slopcheck was not installable in this environment. Manual verification performed instead:
- Package exists on npm registry: confirmed [VERIFIED: npm registry]
- Source repo exists: `github.com/47ng/nuqs` — confirmed public repo with 8k+ stars [VERIFIED: github.com/47ng/nuqs]
- Author: François Best (47ng) — identifiable maintainer, not anonymous [VERIFIED: nuqs.dev]
- Official endorsement: Featured speaker at Next.js Conf 2025 (Vercel's conference) [VERIFIED: nextjs.org/conf]
- No postinstall network scripts: confirmed — `scripts` in package.json contains only `dev`, `build`, `test`, `prepack` [VERIFIED: npm view nuqs]
- Weekly downloads: 2,096,921 — well above threshold for legitimate packages [VERIFIED: npmtrends.com/nuqs via WebSearch]
- Peer dependencies include `next: >=14.2.0` which exactly matches project's Next.js version [VERIFIED: npm view nuqs]

**Verdict: APPROVED** — All manual legitimacy signals are strongly positive.

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (URL: /plants?sun=full+sun&zones=9b)
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  app/(app)/plants/page.tsx  [RSC — async]                       │
│                                                                  │
│  1. Parse searchParams via createSearchParamsCache               │
│     → { sun: ['full sun'], zones: ['9b'], ... }                 │
│                                                                  │
│  2. Run two Supabase queries in parallel:                        │
│     a) .select('*').eq/overlaps/gte/lte...range(0, 23)          │
│     b) .select('*', { count: 'exact' }).eq/overlaps/gte/lte...  │
│                                                                  │
│  3. Fetch user session + lists (if authenticated)               │
│                                                                  │
│  4. Render layout:                                              │
│     ├── <NuqsAdapter> (in root layout)                          │
│     ├── <PlantsFilterSidebar>  [Client island]                  │
│     │     └── <FilterControls> (useQueryStates, shallow:false)  │
│     └── <Suspense fallback=<SkeletonGrid />>                    │
│           └── <PlantsGrid                                       │
│                 initialPlants={page1}                           │
│                 totalCount={count}                              │
│                 filterParams={parsedParams}    [Client wrapper] │
│               />                                                │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         │ Filter change                │ "Load more" click
         ▼                              ▼
┌──────────────────┐        ┌──────────────────────────┐
│ FilterControls   │        │ fetchMorePlants()         │
│ setQueryState(   │        │ [Server Action]           │
│   shallow:false  │        │                           │
│   startTransition│        │ Runs same filter query    │
│ )                │        │ with .range(offset, ...)  │
│                  │        │ Returns Plant[]           │
│ → URL update     │        │                           │
│ → RSC re-renders │        │ Client appends to         │
│   with new data  │        │ useState([...prev, ...new])│
└──────────────────┘        └──────────────────────────┘
```

### Recommended Project Structure
```
app/(app)/plants/
├── page.tsx                    # RSC — reads searchParams, Supabase query, Suspense wrapper
├── actions.ts                  # Server Action — fetchMorePlants(filters, offset)
├── searchParams.ts             # nuqs createSearchParamsCache + parser definitions
├── PlantCard.tsx               # 'use client' — extracted from page.tsx, unchanged logic
├── FilterSection.tsx           # 'use client' — extracted from page.tsx, unchanged logic
├── FilterControls.tsx          # 'use client' — uses useQueryStates(shallow:false)
├── PlantsFilterSidebar.tsx     # 'use client' — desktop sticky wrapper
├── ActiveFilterChips.tsx       # 'use client' — terracotta chip row, reads nuqs state
├── PlantCardSkeleton.tsx       # Server-renderable — no client state needed
└── PlantsGrid.tsx              # 'use client' — accumulates pages, Load More button
lib/
└── plant-labels.ts             # NEW — SUN_ICONS, WATER_ICONS, SUN_LABELS, WATER_LABELS, option arrays
```

### Pattern 1: nuqs createSearchParamsCache (RSC searchParams parsing)

**What:** Define parsers once; RSC page uses them to read `searchParams`; client components use the same parser definitions with `useQueryState`.
**When to use:** Any time filter state must be readable both server-side (for data fetching) and client-side (for UI state).

```typescript
// Source: https://nuqs.dev/docs/server-side
// app/(app)/plants/searchParams.ts
import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsString,
} from 'nuqs/server'

export const plantSearchParamsCache = createSearchParamsCache({
  sun:       parseAsArrayOf(parseAsString).withDefault([]),
  water:     parseAsArrayOf(parseAsString).withDefault([]),
  types:     parseAsArrayOf(parseAsString).withDefault([]),
  months:    parseAsArrayOf(parseAsString).withDefault([]),
  dormancy:  parseAsArrayOf(parseAsString).withDefault([]),
  growthRate: parseAsArrayOf(parseAsString).withDefault([]),
  layers:    parseAsArrayOf(parseAsString).withDefault([]),
  permUses:  parseAsArrayOf(parseAsString).withDefault([]),
  zones:     parseAsArrayOf(parseAsString).withDefault([]),
  state:     parseAsString.withDefault(''),
  q:         parseAsString.withDefault(''),
})

export type PlantSearchParams = ReturnType<typeof plantSearchParamsCache.all>
```

```typescript
// app/(app)/plants/page.tsx  — RSC
import { plantSearchParamsCache } from './searchParams'
import type { SearchParams } from 'nuqs/server'

type Props = { searchParams: Promise<SearchParams> }

export default async function PlantsPage({ searchParams }: Props) {
  // parse() validates all params, applies defaults
  const params = await plantSearchParamsCache.parse(searchParams)
  
  const supabase = await createClient()
  
  // Build query — see Pattern 3
  const [{ data: plants }, { count }] = await Promise.all([
    buildPlantsQuery(supabase, params).range(0, 23),
    buildPlantsQuery(supabase, params, { count: 'exact', head: true }),
  ])

  return (
    <Suspense fallback={<SkeletonGrid />}>
      <PlantsGrid
        initialPlants={plants ?? []}
        totalCount={count ?? 0}
        filterParams={params}
        // ... lists, user
      />
    </Suspense>
  )
}
```

### Pattern 2: nuqs useQueryStates with shallow:false + useTransition

**What:** Client FilterControls updates the URL, which triggers RSC re-render to fetch fresh server data.
**When to use:** Any filter toggle that should cause the RSC to re-execute its Supabase query.

```typescript
// Source: https://nuqs.dev/docs/options — shallow:false causes RSC re-render
// app/(app)/plants/FilterControls.tsx
'use client'

import { useQueryStates, parseAsArrayOf, parseAsString } from 'nuqs'
import { useTransition } from 'react'
import { plantSearchParsers } from './searchParams'  // reuse parser defs
import FilterSection from './FilterSection'

export default function FilterControls() {
  const [isPending, startTransition] = useTransition()
  const [filters, setFilters] = useQueryStates(plantSearchParsers, {
    shallow: false,       // triggers RSC re-render on change
    startTransition,      // isPending = true while RSC is loading
    history: 'replace',   // replace so back button goes to previous page, not previous filter
  })

  function toggleFilter(key: keyof typeof filters, value: string) {
    const current = filters[key] as string[]
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value]
    setFilters({ [key]: next })
  }

  return (
    <div data-pending={isPending ? '' : undefined}>
      <FilterSection
        label="Permaculture Uses"
        options={PERM_USE_OPTIONS}
        selected={filters.permUses}
        onToggle={v => toggleFilter('permUses', v)}
      />
      {/* ... other FilterSections */}
    </div>
  )
}
```

**Key detail:** The `data-pending` attribute can be used in CSS to show a dimmed/pulsing state on the grid while the RSC re-renders: `[data-pending] { opacity: 0.6; pointer-events: none; }`. This is the recommended pattern from the nuqs documentation and community examples. [CITED: aurorascharff.no/posts/managing-advanced-search-param-filtering-next-app-router]

### Pattern 3: Supabase Dynamic Filter Chaining

**What:** Build the Supabase query incrementally based on which filters are active.
**When to use:** RSC page and Server Action both need the same filter logic — extract to a shared builder function.

```typescript
// Source: https://supabase.com/docs/reference/javascript/using-filters [CITED]
// app/(app)/plants/actions.ts (or inline in page.tsx for initial query)
import { encodeZone } from '@/lib/zones'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PlantSearchParams } from './searchParams'

// Returns a Supabase query builder with all active filters applied.
// Call .range(from, to) or .select('*', { count: 'exact', head: true }) after this.
function buildPlantsQuery(
  supabase: SupabaseClient,
  params: PlantSearchParams,
  selectOptions?: { count: 'exact'; head: boolean }
) {
  let query = supabase
    .from('plants')
    .select('*', selectOptions)
    .order('common_name')

  // Single-value text filters: use .in() for multiple OR selections
  if (params.sun.length)    query = query.in('sun', params.sun)
  if (params.water.length)  query = query.in('water', params.water)
  if (params.types.length)  query = query.in('plant_type', params.types)
  if (params.dormancy.length) query = query.in('dormancy', params.dormancy)
  if (params.growthRate.length) query = query.in('growth_rate', params.growthRate)
  if (params.layers.length) query = query.in('forest_garden_layer', params.layers)

  // Array column: overlaps — plant must share at least one value with the selected set
  // bloom_months TEXT[] — any selected month is sufficient (OR semantics)
  if (params.months.length) query = query.overlaps('bloom_months', params.months)

  // Array column: contains — plant must have ALL selected permaculture uses (AND semantics)
  // Matches current client-side behavior: permUses.every(u => plant.permaculture_uses?.includes(u))
  if (params.permUses.length) query = query.contains('permaculture_uses', params.permUses)

  // Array column: native_states — single state code filter
  if (params.state) query = query.contains('native_states', [params.state])

  // USDA zone range overlap:
  // Plant qualifies if ANY selected zone falls within plant's [usda_zone_min, usda_zone_max] range.
  // SQL: usda_zone_min <= zone AND zone <= usda_zone_max for any selected zone.
  // Equivalent: usda_zone_min <= MAX(selectedEncoded) AND usda_zone_max >= MIN(selectedEncoded)
  if (params.zones.length) {
    const encoded = params.zones
      .map(z => encodeZone(z))
      .filter((n): n is number => n !== null)
    if (encoded.length > 0) {
      const minEncoded = Math.min(...encoded)
      const maxEncoded = Math.max(...encoded)
      // Plant range overlaps the selected zone range
      query = query
        .lte('usda_zone_min', maxEncoded)
        .gte('usda_zone_max', minEncoded)
    }
  }

  // Text search: ilike on common_name OR latin_name
  // Note: PostgREST OR filter syntax for ilike across columns
  if (params.q) {
    query = query.or(
      `common_name.ilike.%${params.q}%,latin_name.ilike.%${params.q}%`
    )
  }

  return query
}
```

**USDA zone filter logic explanation:** The current client-side code checks `usda_zone_min <= z && z <= usda_zone_max` for each selected zone `z`. In SQL with multiple selected zones, this becomes: the plant's zone range must overlap the range `[min(selectedEncoded), max(selectedEncoded)]`. That translates to `usda_zone_min <= max(selected)` AND `usda_zone_max >= min(selected)`. This is mathematically equivalent and uses only `.gte()` and `.lte()`, avoiding PostgREST range column syntax. [ASSUMED — the equivalence proof is from training knowledge; verify by testing with a known edge case like a single zone selection]

### Pattern 4: "Load More" with Server Action

**What:** Client component accumulates pages; Server Action runs the same query with an offset.
**When to use:** D-05 append-style pagination where filter changes reset state entirely (D-08).

```typescript
// app/(app)/plants/actions.ts
'use server'

import { createClient } from '@/lib/supabase/server'
import type { PlantSearchParams } from './searchParams'
import type { Plant } from '@/lib/types'

export async function fetchMorePlants(
  params: PlantSearchParams,
  offset: number
): Promise<Plant[]> {
  const supabase = await createClient()
  const { data } = await buildPlantsQuery(supabase, params)
    .range(offset, offset + 23)
  return data ?? []
}
```

```typescript
// app/(app)/plants/PlantsGrid.tsx  — 'use client'
'use client'

import { useState, useTransition } from 'react'
import { fetchMorePlants } from './actions'
import type { Plant } from '@/lib/types'
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

  // When initialPlants prop changes (filter changed → RSC re-rendered),
  // reset accumulated state to the new first page.
  // Use a key prop on this component in page.tsx keyed by filter params hash
  // to ensure a complete remount on filter change rather than reconciliation.

  function handleLoadMore() {
    startTransition(async () => {
      const next = await fetchMorePlants(filterParams, plants.length)
      setPlants(prev => [...prev, ...next])
    })
  }

  const hasMore = plants.length < totalCount

  return (
    <>
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {plants.map(plant => (
          <Link key={plant.id} href={`/plants/${plant.id}`} className="block">
            <PlantCard plant={plant} lists={lists} ... />
          </Link>
        ))}
      </div>
      {hasMore && (
        <div className="mt-10 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="text-sm font-medium border border-warm-stone/40 text-warm-umber py-2 px-6 rounded-lg hover:bg-stone-white transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Loading…' : 'Load more plants'}
          </button>
        </div>
      )}
      {!hasMore && totalCount > 24 && (
        <p className="text-sm text-warm-stone text-center mt-10">
          All {totalCount} plants loaded
        </p>
      )}
    </>
  )
}
```

**Key insight — resetting on filter change:** When `FilterControls` sets new filter state with `shallow: false`, the RSC `page.tsx` re-executes and passes new `initialPlants` + `filterParams` props to `PlantsGrid`. To ensure `PlantsGrid` resets its accumulated `useState` instead of merging old and new data, `page.tsx` must pass a `key` prop to `PlantsGrid` that changes whenever filters change (e.g., a stable string derived from the serialized `filterParams`). React will unmount and remount the component, clearing state. [ASSUMED — this key-remount pattern is well-established in React; verify it works cleanly with the Suspense boundary]

### Pattern 5: NuqsAdapter Placement

**What:** `NuqsAdapter` must wrap the component tree in the root layout.
**When to use:** Required once; placed in `app/layout.tsx`.

```typescript
// Source: https://nuqs.dev/docs/adapters [CITED]
// app/layout.tsx — add NuqsAdapter around children
import { NuqsAdapter } from 'nuqs/adapters/next/app'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  )
}
```

**Important:** The current `app/layout.tsx` only contains HTML shell/fonts. `NuqsAdapter` wraps `{children}` inside `<body>`. The `(app)` group layout (`app/(app)/layout.tsx`) does not need changes.

### Anti-Patterns to Avoid

- **Using `shallow: true` (default) for filter interactions:** The URL will update in the browser but the RSC will NOT re-execute its Supabase query. Filters will appear active in the UI but results will not change. Always use `shallow: false` on filter hooks.
- **Deriving filter state from RSC-passed props:** The URL is the single source of truth (D-02). `FilterControls` reads from nuqs hooks, not from props passed down from the RSC. This prevents prop-drilling and stale state mismatches.
- **Running the same Supabase query twice (page + count):** Use `Promise.all` with two queries — one for data (`.range(0,23)`) and one for count (`.select('*', { count: 'exact', head: true })`). The `head: true` option fetches only the count without returning rows.
- **Using `.overlaps()` for permaculture uses filter:** The current client-side code uses `.every()` (AND semantics — plant must have ALL selected uses). This maps to `.contains()` on the Supabase side, not `.overlaps()`. Using `.overlaps()` would give OR semantics and return too many plants.
- **Forgetting to handle `null` in zone filter:** `usda_zone_min` and `usda_zone_max` are nullable. The Supabase query with `.gte('usda_zone_max', minEncoded)` will naturally exclude NULL rows (PostgreSQL NULL comparison returns false), matching the current client-side `if (p.usda_zone_min === null) return false` behavior.
- **Passing Server Action parameters as raw user input:** `filterParams` passed to `fetchMorePlants` must be parsed through `plantSearchParamsCache.parse()` in the RSC before being forwarded. The Server Action should re-validate or trust the typed `PlantSearchParams` shape — do not pass raw `searchParams` strings directly.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| URL param serialization/deserialization | Custom comma-join/split | `nuqs parseAsArrayOf(parseAsString)` | nuqs handles encoding, defaults, null/empty distinctions, TypeScript types, and browser History API throttling |
| RSC searchParams type safety | Manual `searchParams.get('sun')?.split(',')` | `createSearchParamsCache` | Validates types, applies defaults, throws on invalid values, reusable across page + child server components |
| Filter count badge | `Object.values(filters).flat().length` logic | nuqs state values (already typed arrays) | Trivial but easily miscounted; derive directly from parsed nuqs state |
| Supabase connection in Server Action | New `createServerClient(...)` | `createClient()` from `lib/supabase/server.ts` | Project convention; SSR-safe cookie handling already implemented |
| Loading skeleton animation | Custom keyframe CSS | `animate-pulse` (Tailwind built-in) | Already used in project; consistent with Botanical Heritage style |

**Key insight:** The nuqs + Supabase combination handles the two hardest parts (URL serialization and server filter logic) with well-tested library code. The remaining work is component extraction and wiring — follow established project patterns exactly.

---

## Common Pitfalls

### Pitfall 1: `shallow: true` (default) produces no server results
**What goes wrong:** Filter toggles update the URL visually but the plant grid never changes. The RSC fetches happen once at initial render and never again.
**Why it happens:** nuqs defaults to `shallow: true` (client-only URL update, no server notification).
**How to avoid:** Set `shallow: false` on every `useQueryState`/`useQueryStates` call in `FilterControls`. Pass `startTransition` from `useTransition()` to get `isPending` for skeleton display.
**Warning signs:** URL updates but grid count stays the same after filter change.

### Pitfall 2: PlantsGrid accumulates stale results across filter changes
**What goes wrong:** User applies "full sun" filter, sees 40 plants. Then adds "shrub" filter. Grid shows 40 + 15 plants instead of 15 only.
**Why it happens:** `PlantsGrid`'s `useState` accumulates pages but doesn't reset when `initialPlants` prop changes.
**How to avoid:** Pass a `key` prop to `PlantsGrid` in `page.tsx` that is derived from the serialized filter state. When filters change, the RSC re-renders and the key changes, unmounting the old `PlantsGrid` and mounting a fresh one with the new `initialPlants`. The `key` can be a stable string like `JSON.stringify(params)` or the raw `?search` string.
**Warning signs:** Result count ("Showing X of Y") shows a number larger than the total count after combining filters.

### Pitfall 3: COUNT query not filtered the same as data query
**What goes wrong:** "Showing 24 of 892 plants" when a filter is active, because the count query ignores the filters.
**Why it happens:** Copy-paste the count query but forget to apply the same filter chain.
**How to avoid:** Extract `buildPlantsQuery(supabase, params)` as a shared helper. Both the data query and count query call this helper and then add their own terminal (`.range()` or `{ count: 'exact', head: true }`).
**Warning signs:** Count number doesn't change when filters are applied.

### Pitfall 4: permaculture_uses filter uses OR instead of AND
**What goes wrong:** Searching for "nitrogen fixer" + "edible" returns plants that have either, not both.
**Why it happens:** `.overlaps()` is the natural Supabase choice for array intersection but has OR semantics. The current client code uses `.every()` (AND semantics).
**How to avoid:** Use `.contains('permaculture_uses', params.permUses)` for permaculture uses — this is PostgreSQL's `@>` operator which checks the column contains all listed values.
**Warning signs:** Permaculture use filter returns too many plants when multiple uses are selected.

### Pitfall 5: `searchParams` is a Promise in Next.js 14.2+
**What goes wrong:** TypeScript error or runtime crash when treating `searchParams` as a plain object.
**Why it happens:** Next.js 14.2+ changed `searchParams` to be a `Promise<SearchParams>`. The nuqs server API expects `await searchParamsCache.parse(searchParams)` where `searchParams` is the Promise.
**How to avoid:** Always `await plantSearchParamsCache.parse(searchParams)` in the RSC page. The nuqs type `SearchParams` from `'nuqs/server'` is already typed as `Promise<...>` compatible.
**Warning signs:** TypeScript errors about `searchParams` type mismatch.

### Pitfall 6: NuqsAdapter missing from root layout
**What goes wrong:** `useQueryState` hooks throw a React context error at runtime.
**Why it happens:** nuqs requires `NuqsAdapter` in the component tree above any hook usage.
**How to avoid:** Add `NuqsAdapter` to `app/layout.tsx` (the root layout, not the `(app)` group layout). This is the first task in Wave 0.
**Warning signs:** "Missing NuqsAdapter" or context error in browser console.

### Pitfall 7: Playwright tests fail because filter state is in URL, not local state
**What goes wrong:** Existing Playwright test `await page.locator('aside button').filter({ hasText: 'Sun' }).click()` works but URL assertion `await expect(page).toHaveURL(/sun=/)` fails.
**Why it happens:** nuqs uses comma-separated encoding for `parseAsArrayOf` by default: `?sun=full+sun` not `?sun[]=full+sun`.
**How to avoid:** Verify the URL encoding format nuqs uses for arrays (comma-separated by default). Update Playwright URL assertions to match: `?sun=full%20sun` or similar. The existing `?zones=9b` assertion style in the tests should work if nuqs serializes single-element arrays as `zones=9b`.
**Warning signs:** `toHaveURL` assertions fail while visual state looks correct.

---

## Code Examples

### Supabase COUNT query (parallel with data query)
```typescript
// Source: Supabase JS docs — count option [CITED: supabase.com/docs/reference/javascript/using-filters]
const [{ data: plants, error: dataError }, { count, error: countError }] =
  await Promise.all([
    buildPlantsQuery(supabase, params).range(0, 23),
    buildPlantsQuery(supabase, params)
      .select('*', { count: 'exact', head: true }),
  ])
```

### nuqs array parser (comma-separated by default)
```typescript
// Source: https://nuqs.dev/docs/parsers [CITED]
// ?sun=full+sun,part+shade  (comma is the default separator)
import { parseAsArrayOf, parseAsString } from 'nuqs/server'
const sunParser = parseAsArrayOf(parseAsString).withDefault([])
```

### Supabase overlaps for bloom_months (OR semantics — any selected month)
```typescript
// Source: https://supabase.com/docs/reference/javascript/overlaps [CITED]
// Returns plants that bloom in any of the selected months
if (params.months.length) {
  query = query.overlaps('bloom_months', params.months)
}
```

### Supabase contains for permaculture_uses (AND semantics — all selected uses)
```typescript
// Source: https://supabase.com/docs/reference/javascript/using-filters [CITED]
// Returns plants that have ALL selected permaculture uses
if (params.permUses.length) {
  query = query.contains('permaculture_uses', params.permUses)
}
```

### Skeleton grid (24 cards, Suspense fallback)
```typescript
// Following pattern from 01-UI-SPEC.md [CITED: 01-UI-SPEC.md]
function PlantCardSkeleton() {
  return (
    <div className="bg-stone-white rounded-2xl border border-warm-stone/20 overflow-hidden animate-pulse">
      <div className="h-52 bg-stone-white/80 rounded-t-2xl" />
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

function SkeletonGrid() {
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
      {Array.from({ length: 24 }, (_, i) => <PlantCardSkeleton key={i} />)}
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `router.replace` + manual `URLSearchParams` | nuqs `useQueryState` | nuqs v2 (2023) | Eliminates URL sync boilerplate; adds type safety |
| `'use client'` full-table load | RSC with server-side Supabase filtering | Next.js 13+ App Router | No client download of full catalog |
| Client-side `.filter()` on full array | Supabase `.overlaps()`, `.contains()`, `.in()` | Always possible; now the idiomatic path | Filter logic in database, not browser |
| Page-number pagination with full offset | `.range(from, to)` with append | Supabase SDK from day one | Efficient cursor-style paging |
| `searchParams` as plain object | `searchParams` as `Promise<SearchParams>` | Next.js 14.2 | Must `await` — nuqs handles this transparently |

**Deprecated/outdated:**
- `useSearchParams()` + `router.replace()` for URL state: works but verbose; nuqs is the ecosystem standard for this exact pattern
- Client-side loading of all rows then filtering in memory: the anti-pattern this phase removes

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | USDA zone SQL equivalence: `lte('usda_zone_min', maxEncoded).gte('usda_zone_max', minEncoded)` correctly replicates the client-side `encoded.some(z => min <= z && z <= max)` logic for multiple selected zones | Architecture Patterns / Pattern 3 | Zone filter returns wrong plants (too many or too few) — verify with test cases: single zone, two adjacent zones, two non-adjacent zones |
| A2 | `key` prop on `PlantsGrid` (derived from serialized filterParams) correctly triggers remount and resets useState on filter change | Architecture Patterns / Pattern 4 | Stale plant accumulation across filter changes (Pitfall 2) — verify with E2E test: apply filter A, see results, apply filter B, confirm only B's results show |
| A3 | nuqs `parseAsArrayOf(parseAsString)` serializes arrays as comma-separated values in the URL (e.g., `?sun=full+sun,part+shade`) matching the format the existing Playwright test expects (`/zones=9b/`) | Common Pitfalls / Pitfall 7 | Playwright URL assertions fail — verify by running the zone filter test after nuqs migration |
| A4 | `'use server'` Server Action in `actions.ts` can import and call `buildPlantsQuery` from the same file as the RSC uses it | Architecture Patterns / Pattern 4 | TypeScript import error or bundling conflict — if this occurs, move `buildPlantsQuery` to a shared `lib/plants-query.ts` file |
| A5 | `contains('native_states', [params.state])` correctly filters plants native to a single state (wrapping the state code in an array for the containment check) | Architecture Patterns / Pattern 3 | Native state filter returns no results or all results — verify against known plants with `native_states` populated |

---

## Open Questions

1. **nuqs array URL encoding format**
   - What we know: `parseAsArrayOf(parseAsString)` uses comma as default separator
   - What's unclear: Exact URL encoding for spaces — is `full sun` encoded as `full+sun`, `full%20sun`, or `full sun`? This affects Playwright URL assertions.
   - Recommendation: Verify by running a quick test in dev after nuqs installation, or check nuqs source. The existing Playwright test uses `?zones=9b` which works for single values; multi-value assertions may need updating.

2. **Search (q param) not in locked decisions**
   - What we know: The current 654-line page has a search bar (q param). The locked decisions (D-01 to D-15) don't explicitly address text search.
   - What's unclear: Should `q` be included as a nuqs-managed filter param in Phase 1, or deferred to SRCH-01 (v2)?
   - Recommendation: Include `q` in the nuqs parser definitions and server-side `ilike` filter — it's already in the UI and removing it would be a regression. Note: SRCH-01 refers to full-text search (PostgreSQL tsvector), which is a more powerful v2 upgrade; simple `ilike` search is the v1 baseline.

3. **Add-to-list in RSC → client component context**
   - What we know: `PlantCard` contains `handleAddToList`, `handleRemoveFromList`, `handleCreateList` — all requiring `createClient()` (browser client) and `setLists`. In the current architecture these are in the same client component.
   - What's unclear: With `PlantCard` extracted as a separate file and `PlantsGrid` as the accumulator, how do the list mutation handlers flow? Does `PlantsGrid` need to hold `lists` state and pass mutation handlers to each `PlantCard`?
   - Recommendation: Keep `lists` as a prop passed from RSC to `PlantsGrid`, which passes it to each `PlantCard`. The `PlantCard` creates its own Supabase client instance for mutations (same as the current `AddToListClient.tsx` pattern). The "create new list" modal state can live in `PlantsGrid` or be extracted to a separate `CreateListModal.tsx` client component.

---

## Environment Availability

Step 2.6: This phase requires no external tools beyond the existing project stack. All dependencies are already installed or available via npm.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | npm install | ✓ | v22.22.2 | — |
| npm | Package install | ✓ | Lockfile v3 | — |
| nuqs | URL state management | ✗ (not yet installed) | 2.8.9 on registry | — (no fallback; locked decision) |
| Supabase (production) | Server-side queries | ✓ | permacultureplantpicker.com | — |

**Missing dependencies with no fallback:**
- `nuqs` — must be installed before any implementation begins (Wave 0 task)

---

## Validation Architecture

`workflow.nyquist_validation: true` — validation section required.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.60.0 |
| Config file | `playwright.config.ts` |
| Quick run command | `npx playwright test tests/plants.spec.ts --project=logged-out` |
| Full suite command | `npx playwright test` |

**Important constraint:** Playwright targets `https://permacultureplantpicker.com` (production). Tests run against the deployed app, not localhost. All E2E verification requires a deployment to production or a staging URL.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PERF-01 | Filter state persists in URL (shareable/bookmarkable) | E2E | `npx playwright test tests/plants.spec.ts -g "updates URL"` | ✅ (existing zone URL test) |
| PERF-01 | URL with filters restores same filter state on load | E2E | New test: navigate to `/plants?sun=full+sun`, assert checkbox checked | ❌ Wave 0 |
| PERF-02 | Network: no full-catalog download on filter change | E2E (network intercept) | New test: use `page.route()` to count Supabase requests, verify ≤2 per filter change | ❌ Wave 0 |
| PERF-02 | Only 24 plants returned on initial load | E2E | New test: count `.bg-cream.rounded-2xl` cards === 24 when total > 24 | ❌ Wave 0 |
| PERF-02 | "Load more" adds 24 more plants | E2E | New test: click "Load more plants", count increases by 24 | ❌ Wave 0 |
| D-05 | "Load more" button hidden when all results shown | E2E | New test: apply narrow filter returning ≤24 results, assert button absent | ❌ Wave 0 |
| D-07 | "Showing X of Y plants" count is accurate | E2E | `npx playwright test tests/plants.spec.ts -g "count badge"` | ✅ (existing — `getFilteredCount` helper) |
| D-08 | Filter change resets to page 1 (replaces results) | E2E | New test: load more, apply filter, assert only ≤24 cards visible | ❌ Wave 0 |
| D-12 | Skeleton cards appear while loading | E2E (slow network) | Manual only — requires network throttling in browser | Manual |
| D-14 | Empty state shows filter chips with × remove buttons | E2E | `npx playwright test tests/plants.spec.ts -g "empty state"` | ✅ (existing empty state test — needs chip assertion added) |
| D-15 | Active filter chips appear above results grid | E2E | New test: apply filter, assert chip visible above grid (not only in aside) | ❌ Wave 0 |

### Network Interception Test Pattern (PERF-02 key test)

```typescript
// Source: https://playwright.dev/docs/network [CITED]
test('filter change fetches only filtered page, not full catalog', async ({ page }) => {
  let supabaseRequestCount = 0
  let maxResponseSize = 0

  // Intercept Supabase REST API calls
  page.on('response', async (response) => {
    if (response.url().includes('/rest/v1/plants')) {
      supabaseRequestCount++
      const body = await response.body()
      maxResponseSize = Math.max(maxResponseSize, body.length)
    }
  })

  await page.goto('/plants')
  await page.waitForSelector('p:has-text("Showing")', { timeout: 20000 })

  supabaseRequestCount = 0 // reset after initial load
  maxResponseSize = 0

  // Apply a filter
  await page.locator('aside button').filter({ hasText: 'Sun' }).click()
  await page.locator('aside label').filter({ hasText: 'full sun' }).locator('input[type="checkbox"]').check()
  await page.waitForSelector('p:has-text("Showing")')

  // Verify: 2 requests (data + count), not a full catalog download
  expect(supabaseRequestCount).toBeLessThanOrEqual(2)
  // Verify: response is small (24 plants << 2000 plants)
  expect(maxResponseSize).toBeLessThan(100_000) // 100KB limit heuristic
})
```

### Existing Test Compatibility

The existing `tests/plants.spec.ts` tests make these assertions that must continue to work after the refactor:

| Test | Key Assertion | Risk After Refactor |
|------|---------------|---------------------|
| `loads plants with count badge` | `p:has-text("Showing")` visible | Low — "Showing X of Y" UI preserved (D-07) |
| `search for "lavender"` | count === 1 after search | Medium — `q` param must still drive server-side ilike filter |
| `filter by "full sun"` | count decreases | Medium — `aside button` filter for "Sun" still works (FilterSection same DOM) |
| `USDA Zone filter updates URL` | `?zones=9b` in URL | Medium — nuqs serialization must match; verify comma encoding for single value |
| `filter by Native State` | `?state=CA` in URL | Medium — `state` param naming preserved in nuqs parsers |
| `"Clear all" appears and resets` | `aside .getByText('Clear all')` | Low — Clear all stays in FilterControls |
| `shows empty state` | `No plants match your filters.` text | Low — empty state text preserved |

**All existing tests should pass without modification.** The selector patterns (`aside button`, `aside label`, `aside select`) target the FilterControls which is still rendered inside a desktop `<aside>`. The count helper `getFilteredCount` works on `p:has-text("Showing")` which maps to the new "Showing X of Y plants" line.

### Sampling Rate
- **Per task commit:** `npx playwright test tests/plants.spec.ts --project=logged-out` (public browser tests only — faster)
- **Per wave merge:** `npx playwright test` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] New test assertions for PERF-01 URL restoration (navigate to filtered URL, assert filter state)
- [ ] New test for PERF-02 network intercept (verify no full-catalog download)
- [ ] New test for page size (24 cards max on initial load)
- [ ] New test for "Load more" appending behavior
- [ ] New test for active filter chips above grid (D-15)
- [ ] New test for "Load more" hidden when total ≤ 24

*(Existing test infrastructure covers all other requirements. New assertions should be added to `tests/plants.spec.ts` in the `'Plant browser — public'` describe block.)*

---

## Security Domain

`security_enforcement` not explicitly disabled — security section required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not changed — auth still via Supabase session cookies |
| V3 Session Management | No | Not changed — RSC reads session via `createClient()` from `lib/supabase/server.ts` |
| V4 Access Control | Partial | Supabase RLS remains; `plants` table has public SELECT — no change. `plant_lists` and `plant_list_items` RLS unchanged. |
| V5 Input Validation | Yes | `createSearchParamsCache` validates and sanitizes all URL params before they reach Supabase queries |
| V6 Cryptography | No | Not applicable |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection via filter params | Tampering | nuqs `parseAsArrayOf(parseAsString)` validates input is string array; Supabase JS client uses parameterized queries — never string concatenation |
| URL param injection (e.g., `?sun='; DROP TABLE plants; --`) | Tampering | nuqs parsers reject invalid types; Supabase JS `.in()`, `.overlaps()`, `.contains()` are parameterized, not string-interpolated into SQL |
| Excessive data exposure via Server Action | Information Disclosure | `fetchMorePlants` Server Action runs the same filtered query; no extra columns selected beyond `select('*')` which matches the public `plants` RLS policy |
| CSRF on Server Action | Tampering | Next.js Server Actions are protected against CSRF by default (same-origin enforcement + CSRF token header) |
| Rate limiting / DoS via rapid filter changes | Denial of Service | nuqs throttles URL updates to 50ms by default; Supabase has built-in connection pooling; each RSC request is a separate Supabase query — acceptable at current scale |

**Security assessment:** This phase reduces the attack surface compared to the current architecture. Moving from a client-side full-table load to server-side filtered queries means: (1) less data is sent to the browser, (2) filter logic is in parameterized SQL (not client JS), and (3) Supabase RLS enforces read permissions at the database level.

---

## Project Constraints (from CLAUDE.md)

All of the following directives apply to Phase 1 implementation:

| Directive | Impact on Phase |
|-----------|----------------|
| Next.js 14.2, React 18, TypeScript strict | All new files must be `.tsx`, strict types, no `any` |
| Tailwind CSS only — no component library | All new UI uses Botanical Heritage tokens; no shadcn, no external UI kit |
| No Prettier config — rely on `next lint` | Run `npm run lint` before committing |
| Botanical Heritage design tokens exclusively | New components: `bg-stone-white`, `text-warm-umber`, `font-playfair`, etc. — no Tailwind defaults |
| `@/*` path alias | Use `@/lib/types`, `@/lib/zones`, `@/lib/supabase/server`, `@/lib/supabase/client` |
| Supabase client: server.ts in RSC, client.ts in 'use client' | `page.tsx` (RSC) → `lib/supabase/server.ts`; `PlantsGrid`, `FilterControls`, `PlantCard` (client) → `lib/supabase/client.ts` |
| Playwright E2E only, targets production URL | Tests run against `permacultureplantpicker.com`, not localhost |
| `image_url` hosts: Wikimedia, Supabase, iNaturalist only | `PlantCard` — no changes to image rendering needed |
| No comments unless WHY is non-obvious | No inline explanatory comments except for encoding/query logic |
| Inline Tailwind classes preferred over custom CSS | No new CSS files; all skeleton and chip styles as class strings |
| Event handlers: `handle` prefix | `handleLoadMore`, `handleToggleFilter`, `handleClearAll` |
| Boolean state: descriptive noun | `loading`, `isPending`, `drawerOpen`, `showMenu` |

---

## Sources

### Primary (HIGH confidence)
- `https://nuqs.dev/docs/adapters` — NuqsAdapter placement in root layout [CITED]
- `https://nuqs.dev/docs/server-side` — `createSearchParamsCache`, `parseAsArrayOf`, RSC page pattern [CITED]
- `https://nuqs.dev/docs/options` — `shallow: false`, `history: replace`, throttling [CITED]
- `https://nuqs.dev/docs/parsers` — `parseAsArrayOf(parseAsString)`, comma separator [CITED]
- `https://nuqs.dev/docs/batching` — `useQueryStates` API [CITED]
- `https://supabase.com/docs/reference/javascript/using-filters` — filter chaining, count option [CITED]
- `https://supabase.com/docs/reference/javascript/overlaps` — array overlaps [CITED]
- `https://playwright.dev/docs/network` — network interception for E2E verification [CITED]
- `app/(app)/plants/page.tsx` — current 654-line implementation, all filter logic [VERIFIED: codebase]
- `lib/zones.ts` — `encodeZone`, `ZONE_LABELS` [VERIFIED: codebase]
- `lib/types.ts` — Plant interface, all column names [VERIFIED: codebase]
- `nextjs.org/conf/session/type-safe-url-state-in-nextjs-with-nuqs` — nuqs official endorsement [VERIFIED]

### Secondary (MEDIUM confidence)
- `https://medium.com/@Jaimayal/how-to-properly-manage-search-params-in-nextjs-app-router-leverage-the-power-of-nuqs-the-right-way-9f7238cff76a` — RSC + client island pattern with nuqs, `startTransition` usage [CITED]
- `https://aurorascharff.no/posts/managing-advanced-search-param-filtering-next-app-router/` — `data-pending` pattern for visual feedback during RSC re-render [CITED]
- `https://supabase.com/blog/infinite-scroll-with-nextjs-framer-motion` — Supabase `.range()` + client state accumulation pattern [CITED]

### Tertiary (LOW confidence — training knowledge)
- USDA zone SQL range equivalence proof (A1 in Assumptions Log)
- React `key` prop remount pattern for PlantsGrid state reset (A2 in Assumptions Log)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — nuqs version and peer deps verified on npm registry; Supabase client already in project
- Architecture: HIGH — pattern confirmed across multiple official docs and community examples
- Supabase filter operators: HIGH — confirmed via official Supabase filter docs
- USDA zone SQL logic: MEDIUM — mathematically reasoned but not tested in SQL yet (see A1)
- "Load more" pattern: MEDIUM — pattern confirmed but key-remount detail is training knowledge (see A2)
- Playwright network intercept: HIGH — confirmed via Playwright official docs

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (30 days — nuqs and Supabase JS are stable; Next.js 14 App Router patterns are not changing rapidly)
