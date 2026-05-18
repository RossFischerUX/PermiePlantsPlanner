# Walking Skeleton — Phase 1: Server-Side Filtering

> Produced by gsd plan-phase (WALKING_SKELETON=true).
> Records the architectural decisions proven by the skeleton slice so subsequent plans build on them without renegotiating.

---

## Skeleton Definition

The walking skeleton is the thinnest possible end-to-end vertical slice that proves the full architecture works:

- `nuqs` installed and `NuqsAdapter` wired in `app/layout.tsx`
- `searchParams.ts` defines parsers (at minimum: `sun` array param)
- `app/(app)/plants/page.tsx` is an RSC that reads `searchParams` via `plantSearchParamsCache.parse()`, runs a Supabase query with at least the `sun` filter applied, and renders results
- A filter change (checking "full sun") updates the URL AND causes the RSC to re-execute AND the rendered plant grid changes

When this slice is green, the full architecture is validated: **URL state → RSC re-execution → Supabase server query → rendered results**.

---

## Architectural Decisions Locked by Skeleton

| Decision | Detail | Applies To |
|----------|--------|-----------|
| URL state library | `nuqs@^2` (`nuqs/adapters/next/app` + `nuqs/server`) | All plans |
| Adapter placement | `NuqsAdapter` wraps `{children}` inside `<body>` in `app/layout.tsx` (root layout only, NOT `(app)/layout.tsx`) | Plan B |
| RSC param parsing | `plantSearchParamsCache.parse(searchParams)` where `searchParams` is `Promise<SearchParams>` from nuqs/server | Plan F |
| Filter → RSC trigger | `useQueryStates(plantSearchParsers, { shallow: false, startTransition, history: 'replace' })` in FilterControls | Plan E |
| Server Supabase client | `createClient()` from `@/lib/supabase/server` in RSC page and Server Action | Plans D, F |
| Query builder location | `buildPlantsQuery()` lives in `app/(app)/plants/actions.ts` (exported, shared by page.tsx and the Server Action) | Plans D, F |
| Page size | 24 plants per page; `.range(0, 23)` for page 1, `.range(offset, offset + 23)` for load-more | Plans D, F |
| Count query | Parallel `Promise.all` with `.select('*', { count: 'exact', head: true })` — no rows returned | Plan F |
| PlantsGrid remount on filter change | `key={JSON.stringify(params)}` on `<PlantsGrid>` in page.tsx resets accumulated useState | Plan F |
| Co-location convention | All new components in `app/(app)/plants/` as `PascalCase.tsx` siblings of `page.tsx` | All plans |
| Path alias | All imports use `@/lib/...` and `@/app/...` — no relative `../` paths | All plans |
| Design tokens | Botanical Heritage only — no Tailwind color defaults | All plans |

---

## Stack Diagram

```
Browser URL: /plants?sun=full+sun
        │
        ▼ (nuqs shallow:false triggers RSC re-render)
app/(app)/plants/page.tsx  [RSC — async]
  ├─ plantSearchParamsCache.parse(searchParams)  → { sun: ['full sun'], ... }
  ├─ createClient() from lib/supabase/server
  ├─ Promise.all:
  │    ├─ buildPlantsQuery(supabase, params).range(0, 23)       → Plant[] (24 max)
  │    ├─ buildPlantsQuery(supabase, params) + count:exact      → totalCount
  │    └─ supabase.from('plant_lists').select ... (if user)     → PlantList[]
  └─ Renders:
       ├─ <PlantsFilterSidebar>  [Client island]
       │    └─ <FilterControls>  useQueryStates(shallow:false) → URL writes
       ├─ <ActiveFilterChips />  [Client — reads nuqs state, renders chips above grid]
       └─ <Suspense fallback=<SkeletonGrid />>
            └─ <PlantsGrid key={JSON.stringify(params)}
                  initialPlants={...} totalCount={...} filterParams={...} lists={...}>
                 [Client — accumulates load-more pages via Server Action]
                 └─ fetchMorePlants(params, offset)  [Server Action in actions.ts]
```

---

## Directory Layout After Phase 1

```
app/(app)/plants/
├── page.tsx                 # MODIFIED: RSC shell (was 654-line 'use client')
├── actions.ts               # NEW: 'use server' — buildPlantsQuery + fetchMorePlants
├── searchParams.ts          # NEW: nuqs parsers + cache + PlantSearchParams type
├── FilterSection.tsx        # NEW: extracted from page.tsx lines 33–75, unchanged logic
├── FilterControls.tsx       # NEW: useQueryStates(shallow:false), replaces URL sync
├── PlantsFilterSidebar.tsx  # NEW: desktop sticky sidebar + mobile drawer wrapper
├── ActiveFilterChips.tsx    # NEW: chip row above grid, reads nuqs state
├── PlantCard.tsx            # NEW: extracted from page.tsx lines 77–211, unchanged logic
├── PlantCardSkeleton.tsx    # NEW: 24-card skeleton grid (Suspense fallback)
└── PlantsGrid.tsx           # NEW: 'use client' — load-more accumulator
lib/
├── plant-labels.ts          # NEW: SUN_ICONS, WATER_ICONS, *_OPTIONS constants
├── types.ts                 # UNCHANGED
├── zones.ts                 # UNCHANGED
└── us-states.ts             # UNCHANGED
app/
└── layout.tsx               # MODIFIED: NuqsAdapter wraps {children}
tests/
└── plants.spec.ts           # MODIFIED: Wave 0 tests added
```

---

## Skeleton Verification (manual, pre-deploy)

After Plan B (nuqs + searchParams.ts) and a minimal Plan F skeleton where page.tsx runs at least one filter:

1. Run `npm run build` — must succeed with no TypeScript errors
2. Run `npm run dev` — visit `/plants`
3. In the filter sidebar, check "full sun"
4. Verify: URL changes to `/plants?sun=full+sun`
5. Verify: Plant grid re-renders with only full-sun plants (RSC re-executed)
6. Verify: Browser Network tab shows a Supabase REST call (not a full 2000-row download)

This is the architectural proof. All subsequent plans add filters, load-more, chips, and polish on top of this validated stack.
