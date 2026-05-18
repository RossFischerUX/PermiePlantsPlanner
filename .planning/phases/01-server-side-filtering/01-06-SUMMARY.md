---
phase: "01-server-side-filtering"
plan: "06"
subsystem: "plants/page"
tags: ["rsc", "server-side-filtering", "pagination", "load-more", "walking-skeleton"]
dependency_graph:
  requires:
    - "01-03: PlantCard, PlantCardSkeleton extracted"
    - "01-04: actions.ts (fetchMorePlants)"
    - "01-05: PlantsFilterSidebar, ActiveFilterChips, FilterControls"
  provides:
    - "PlantsGrid.tsx: client load-more accumulator"
    - "page.tsx: RSC shell with server-side Supabase queries"
    - "queryBuilder.ts: shared buildPlantsQuery utility"
  affects:
    - "app/(app)/plants/[id]/page.tsx: now imports from @/lib/plant-labels"
tech_stack:
  added: []
  patterns:
    - "RSC async page with Promise.all parallel Supabase queries"
    - "key={JSON.stringify(params)} for PlantsGrid remount on filter change (D-08)"
    - "queryBuilder.ts shared between RSC page and 'use server' Server Action"
    - "useTransition + Server Action for load-more pagination"
key_files:
  created:
    - "app/(app)/plants/PlantsGrid.tsx"
    - "app/(app)/plants/queryBuilder.ts"
  modified:
    - "app/(app)/plants/page.tsx"
    - "app/(app)/plants/actions.ts"
    - "app/(app)/plants/[id]/page.tsx"
decisions:
  - "Moved buildPlantsQuery to queryBuilder.ts (not 'use server') to resolve Next.js constraint that all 'use server' file exports must be async functions"
  - "page.tsx imports buildPlantsQuery from queryBuilder.ts directly; actions.ts also imports from queryBuilder.ts"
  - "ActiveFilterChips rendered inside PlantsGrid (above grid and in empty state) per plan spec"
  - "Discard Changes button label in modal (plan spec) rather than Cancel from old page.tsx"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-18T22:40:02Z"
  tasks_completed: 3
  files_modified: 5
---

# Phase 01 Plan 06: PlantsGrid + RSC Page Rewrite Summary

Complete RSC refactor of the plant browser: page.tsx rewritten from a 654-line `'use client'` full-catalog loader to a 53-line server component with server-applied filters and 24-plant pagination.

## What Was Done

**Task 1 — Created PlantsGrid.tsx**
New `'use client'` component that receives initial plants, total count, filter params, and user's lists as RSC props. Manages load-more state accumulation via `useTransition` + `fetchMorePlants` Server Action. Renders create-list modal, ActiveFilterChips, result count line, plant grid, and load-more/exhausted states.

**Task 2 — Rewrote page.tsx as RSC**
Replaced 654-line `'use client'` PlantsPageInner with a 53-line async RSC. Runs three parallel Supabase queries: filtered 24-plant page, exact COUNT with same filters, and auth user lookup. Fetches user's lists conditionally. Passes `key={JSON.stringify(params)}` to PlantsGrid to force remount on filter change.

**Task 3 — Updated plants/[id]/page.tsx**
Replaced inline `SUN_ICONS` and `WATER_ICONS` constant definitions with import from `@/lib/plant-labels`.

## Files Created/Modified

| File | Action | Notes |
|------|--------|-------|
| `app/(app)/plants/PlantsGrid.tsx` | Created (new) | 175 lines; 'use client' load-more accumulator |
| `app/(app)/plants/queryBuilder.ts` | Created (new) | Shared buildPlantsQuery extracted from actions.ts |
| `app/(app)/plants/page.tsx` | Rewritten | 53 lines (was 654); pure RSC, no 'use client' |
| `app/(app)/plants/actions.ts` | Modified | Now imports buildPlantsQuery from queryBuilder.ts |
| `app/(app)/plants/[id]/page.tsx` | Modified | SUN_ICONS/WATER_ICONS from @/lib/plant-labels |

## Verification Results

**TypeScript:** Clean (`npx tsc --noEmit` — no output / no errors)

**Build:**
```
Route (app)          Size     First Load JS
ƒ /plants            13.2 kB  179 kB
ƒ /plants/[id]       1.38 kB  167 kB
... all other routes: green
Build completed successfully.
```

**page.tsx line count:** 53 lines (target was ~60)

**Checklist:**
- page.tsx has NO 'use client' directive — PASS
- page.tsx contains `plantSearchParamsCache.parse` — PASS
- page.tsx contains `key={JSON.stringify(params)}` — PASS
- PlantsGrid.tsx imports `fetchMorePlants` from `./actions` — PASS
- PlantsGrid.tsx has `ActiveFilterChips` above the grid — PASS
- plants/[id]/page.tsx imports from `@/lib/plant-labels` — PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] buildPlantsQuery extracted to queryBuilder.ts**
- **Found during:** Task 2 build run
- **Issue:** `actions.ts` has `'use server'` directive. Next.js requires all exports from `'use server'` files to be async functions. `buildPlantsQuery` is not async. When `page.tsx` imported `buildPlantsQuery` from `actions.ts`, the build failed: `Server actions must be async functions`.
- **Fix:** Created `app/(app)/plants/queryBuilder.ts` as a plain TypeScript module (no directive). `buildPlantsQuery` lives there. Both `page.tsx` and `actions.ts` import from `queryBuilder.ts`. This is the pattern hinted at in RESEARCH.md ("move it to a shared file if a bundling conflict occurs — see RESEARCH.md A4").
- **Files modified:** `queryBuilder.ts` (created), `actions.ts` (updated import), `page.tsx` (updated import)
- **Commit:** 674418c

**2. [Minor] Count query uses opts parameter, not chained .select()**
- **Found during:** Task 2 TypeScript check
- **Issue:** Plan specified `buildPlantsQuery(supabase, params).select('*', { count: 'exact', head: true })` but this caused TS error because `.select()` was already called inside `buildPlantsQuery`. TypeScript saw the chained `.select()` as having incorrect arity.
- **Fix:** Used `buildPlantsQuery(supabase, params, { count: 'exact', head: true })` — passing opts directly to the function, which passes them to the initial `supabase.from('plants').select('*', opts)` call. This is the pattern from RESEARCH.md Pattern 3 and matches the existing `actions.ts` function signature.
- **Files modified:** `page.tsx`

## Known Stubs

None. All data flows are wired: initialPlants from Supabase, totalCount from COUNT query, lists from authenticated user's plant_lists, load-more via fetchMorePlants Server Action.

## Threat Flags

None. No new trust boundaries introduced. buildPlantsQuery is accessed only from RSC page and Server Action (both server-side). PlantsGrid is a client component that calls the Server Action — matching the existing architecture.

## Self-Check: PASSED

- PlantsGrid.tsx: FOUND
- queryBuilder.ts: FOUND
- page.tsx: FOUND
- Commit 674418c: FOUND
