---
phase: 01-server-side-filtering
plan: 02
subsystem: foundations
tags: [nuqs, url-state, plant-filters, constants]
dependency_graph:
  requires: []
  provides: [nuqs-adapter, plant-labels, search-params-cache]
  affects: [app/layout.tsx, lib/plant-labels.ts, app/(app)/plants/searchParams.ts]
tech_stack:
  added: [nuqs@2.8.9]
  patterns: [createSearchParamsCache, NuqsAdapter, parseAsArrayOf]
key_files:
  created:
    - lib/plant-labels.ts
    - app/(app)/plants/searchParams.ts
  modified:
    - app/layout.tsx
    - package.json
    - package-lock.json
decisions:
  - NuqsAdapter placed in app/layout.tsx (root layout) not app/(app)/layout.tsx — ensures nuqs context is available to all routes including presents/ and api/
  - plantSearchParsers exported separately from cache — allows client components to use useQueryStates with the same parser definitions as the RSC cache
  - lib/plant-labels.ts uses named exports only (no default) — follows lib/zones.ts style, tree-shakeable
metrics:
  duration: 5m
  completed: 2026-05-18T22:01:44Z
  tasks: 2
  files_modified: 5
---

# Phase 01 Plan 02: Install nuqs foundations and create URL type contract

nuqs 2.8.9 installed, NuqsAdapter wired into root layout, filter constants extracted to lib/plant-labels.ts, nuqs parser definitions created in searchParams.ts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install nuqs and wire NuqsAdapter | c2e3b36 | package.json, package-lock.json, app/layout.tsx |
| 2 | Create lib/plant-labels.ts and searchParams.ts | c2e3b36 | lib/plant-labels.ts, app/(app)/plants/searchParams.ts |

## What Was Done

### Task 1: nuqs installation and NuqsAdapter

Installed `nuqs@2.8.9` (2.x.x confirmed via `npm list nuqs`). Modified `app/layout.tsx` to:
- Import `NuqsAdapter` from `nuqs/adapters/next/app`
- Wrap `{children}` inside `<body>` with `<NuqsAdapter>{children}</NuqsAdapter>`

All existing layout structure (html element, font variables, metadata export) preserved exactly.

### Task 2: lib/plant-labels.ts

Created with 11 named exports matching exact values from `app/(app)/plants/page.tsx` lines 12-31:
- `SUN_OPTIONS`, `WATER_OPTIONS`, `TYPE_OPTIONS`, `MONTH_OPTIONS`, `DORMANCY_OPTIONS`, `GROWTH_OPTIONS`, `SEASON_OPTIONS`, `LAYER_OPTIONS`, `PERM_USE_OPTIONS` — typed as `string[]`
- `SUN_ICONS`, `WATER_ICONS` — typed as `Record<string, string>`

No default export; follows lib/zones.ts style.

### Task 3: app/(app)/plants/searchParams.ts

Created with no `'use client'` or `'use server'` directive — importable by both RSC and client components:
- `plantSearchParsers` — parser definitions for all 11 filter keys (arrays: sun, water, types, months, dormancy, growthRate, layers, permUses, zones; strings: state, q)
- `plantSearchParamsCache` — `createSearchParamsCache(plantSearchParsers)` for RSC page use
- `PlantSearchParams` — `ReturnType<typeof plantSearchParamsCache.all>`

## Verification Results

```
npm list nuqs:
permaculture-plant-picker@0.1.0
└── nuqs@2.8.9          ← 2.x.x confirmed

npx tsc --noEmit:
(no output — zero errors)

npm run build:
Build succeeded. All routes compiled successfully.
/plants route: 7.19 kB (unchanged behavior)
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. This plan creates pure foundation files with no UI rendering or data wiring.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced. nuqs was audited as APPROVED in RESEARCH.md (2.09M weekly downloads, 8k+ GitHub stars, featured at Next.js Conf 2025, no postinstall scripts).

## Self-Check: PASSED

- [x] lib/plant-labels.ts exists
- [x] app/(app)/plants/searchParams.ts exists
- [x] app/layout.tsx modified (NuqsAdapter wrapping children)
- [x] Commit c2e3b36 exists
- [x] nuqs@2.8.9 installed (2.x.x)
- [x] tsc --noEmit: no errors
- [x] npm run build: green
