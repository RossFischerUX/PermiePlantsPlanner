---
phase: 01-server-side-filtering
plan: "05"
subsystem: plant-browser-filter-ui
tags: [nuqs, filter-ui, client-components, url-state]
dependency_graph:
  requires: [01-03, 01-04]
  provides: [FilterControls, ActiveFilterChips, PlantsFilterSidebar]
  affects: [app/(app)/plants/page.tsx]
tech_stack:
  added: []
  patterns: [nuqs-useQueryStates-shallow-false, useTransition-pending, react-fragment-sibling-components]
key_files:
  created:
    - app/(app)/plants/FilterControls.tsx
    - app/(app)/plants/ActiveFilterChips.tsx
    - app/(app)/plants/PlantsFilterSidebar.tsx
decisions:
  - "PlantsFilterSidebar mobile footer uses 'Show results' close button instead of dynamic count — totalCount is RSC-owned, not available in this client component"
  - "ActiveFilterChips and FilterControls both set shallow:false — chip removal is a filter change that must trigger RSC re-render"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-18T22:09:26Z"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 01 Plan 05: FilterControls, ActiveFilterChips, PlantsFilterSidebar Summary

## One-Liner

Three nuqs-powered client components: FilterControls writes URL filter state with shallow:false to trigger RSC re-renders; ActiveFilterChips renders removable terracotta pills above the grid; PlantsFilterSidebar wraps FilterControls in both desktop sticky sidebar and mobile collapsible drawer.

## What Was Done

Created three new `'use client'` components that form the filter UI binding layer for the server-side plant browser refactor.

**FilterControls.tsx** — The central filter writer. Uses `useQueryStates(plantSearchParsers, { shallow: false, startTransition, history: 'replace' })`. The `shallow: false` option is critical: it causes the RSC `page.tsx` to re-execute its Supabase query whenever any filter is changed. Renders all 11 filter params (permUses, layers, types, sun, water, growthRate, dormancy, months, zones, state) via FilterSection components and a native state select. Wraps output in `data-pending` attribute for CSS-based loading feedback.

**ActiveFilterChips.tsx** — Renders terracotta `rounded-full` pill buttons above the results grid for every active filter. Each chip has a × remove button that calls `setFilters` with the value removed. Also uses `shallow: false` so chip removal triggers RSC re-render. Returns `null` when no filters are active (D-14, D-15). Label format follows the UI-SPEC contract: water adds " water" suffix, zones prefix with "Zone ", native state uses full state name via US_STATES lookup.

**PlantsFilterSidebar.tsx** — The desktop/mobile wrapper. Renders two sibling elements via React Fragment: (1) `<aside className="w-72 flex-shrink-0 hidden lg:block">` with sticky top-24 and max-h scroll for desktop; (2) a `lg:hidden` mobile toggle button with filter count badge and a collapsible drawer. Both desktop and mobile render `<FilterControls />` — a single shared instance per D-10 (no FilterSection duplication). Mobile drawer includes "Clear all" and "Show results" footer buttons.

## Files Created

| File | Exports | Purpose |
|------|---------|---------|
| `app/(app)/plants/FilterControls.tsx` | `default FilterControls` | nuqs-powered filter form; shallow:false writer |
| `app/(app)/plants/ActiveFilterChips.tsx` | `default ActiveFilterChips` | Active filter chip row above results grid |
| `app/(app)/plants/PlantsFilterSidebar.tsx` | `default PlantsFilterSidebar` | Desktop sidebar + mobile drawer wrapper |

## Verification Results

**TypeScript (tsc --noEmit):**
```
(no output — clean)
```
Zero errors for all three files and the full codebase.

**Build (npm run build):**
Build succeeded. `/plants` route: 7.19 kB, all routes compiled without errors. New components are not yet imported by page.tsx (per plan: that wiring happens in Plan 01-06), so they are compiled but not yet bundled into the page route.

**Critical confirmation — shallow:false:**
`FilterControls.tsx` line 14: `shallow: false` is set in `useQueryStates` options. Without this the RSC would never re-execute on filter change (Pitfall 1 from RESEARCH.md).

## Decisions Made

1. **Mobile footer button**: The plan noted that `PlantsFilterSidebar` cannot access `totalCount` (that lives in the RSC-rendered `PlantsGrid`). Used "Show results" as the mobile close button label instead of "Show N plants". The existing `page.tsx` mobile drawer had `Show {filtered.length} plants` but `filtered` was local client state — in the new architecture, that count belongs to the RSC. This is a minor UX simplification; the real count is shown by `ActiveFilterChips` and the "Showing X of Y" line in the grid.

2. **ActiveFilterChips also uses shallow:false**: The plan specified `shallow: false` for clearing chips. This ensures chip removal triggers RSC re-render to refresh plant results, consistent with FilterControls behavior.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. These are filter UI components — they contain no data stubs. They read/write nuqs URL state; actual data rendering is the responsibility of PlantsGrid (Plan 01-06).

## Threat Flags

None. These components only write URL search params (client-side) and read from nuqs state. No new network endpoints or auth paths introduced. The nuqs URL writes trigger RSC re-renders, but the RSC validates all params via `plantSearchParamsCache.parse()` before they reach Supabase (T-05-01 mitigation is in the RSC, per the plan's threat register).

## Self-Check

Files exist:
- FOUND: app/(app)/plants/FilterControls.tsx
- FOUND: app/(app)/plants/ActiveFilterChips.tsx
- FOUND: app/(app)/plants/PlantsFilterSidebar.tsx

Commit exists: 51b7777

## Self-Check: PASSED
