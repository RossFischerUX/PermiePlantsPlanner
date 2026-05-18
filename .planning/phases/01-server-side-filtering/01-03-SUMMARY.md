---
phase: "01"
plan: "03"
subsystem: plants-ui
tags: [component-extraction, filter-section, plant-card, skeleton, refactor]
dependency_graph:
  requires: [01-02]
  provides: [FilterSection, PlantCard, PlantCardSkeleton, SkeletonGrid]
  affects: []
tech_stack:
  added: []
  patterns: [verbatim-extraction, rsc-compatible-skeleton, named-exports]
key_files:
  created:
    - app/(app)/plants/FilterSection.tsx
    - app/(app)/plants/PlantCard.tsx
    - app/(app)/plants/PlantCardSkeleton.tsx
  modified: []
decisions:
  - PlantCardSkeleton exports two named exports (PlantCardSkeleton + SkeletonGrid) — no default export, consistent with plan spec
  - PlantCard imports SUN_ICONS/WATER_ICONS from @/lib/plant-labels (plan 01-02), no inline duplication
  - PlantCardSkeleton has no 'use client' directive — server-renderable for use as Suspense fallback
metrics:
  duration: "75s"
  completed: "2026-05-18T22:05:17Z"
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 01 Plan 03: Component Extraction Summary

Verbatim extraction of FilterSection and PlantCard from `app/(app)/plants/page.tsx` into standalone co-located component files, plus creation of new PlantCardSkeleton/SkeletonGrid components.

## What Was Done

**Task 1 — FilterSection.tsx:** Extracted the accordion filter section component verbatim from `page.tsx` lines 33–75. Added `'use client'` directive as first line and `import { useState } from 'react'`. Changed to `export default function FilterSection(...)`. All className strings, badge count logic, and SVG chevron preserved exactly.

**Task 2 — PlantCard.tsx:** Extracted the plant card component verbatim from `page.tsx` lines 77–211. Added `'use client'` directive and required imports. Removed inline `SUN_ICONS`/`WATER_ICONS` constants; these are now imported from `@/lib/plant-labels` (created in plan 01-02). Changed to `export default function PlantCard(...)`. All JSX, useEffect handlers, dropdown behavior, and className strings preserved exactly.

**Task 3 — PlantCardSkeleton.tsx:** Created new RSC-compatible skeleton component file with NO `'use client'` directive. Exports two named exports: `PlantCardSkeleton` (single card) and `SkeletonGrid` (24-card grid using `Array.from`). Uses Botanical Heritage design tokens (`stone-white`, `warm-stone`) with `animate-pulse`. SkeletonGrid serves as the Suspense fallback in plan 01-06.

## Files Created

| File | Type | Exports |
|------|------|---------|
| `app/(app)/plants/FilterSection.tsx` | Client component | `default FilterSection` |
| `app/(app)/plants/PlantCard.tsx` | Client component | `default PlantCard` |
| `app/(app)/plants/PlantCardSkeleton.tsx` | Server-compatible | `PlantCardSkeleton`, `SkeletonGrid` (named) |

## Verification Results

- `npx tsc --noEmit` — no errors on the three new files (zero output matching file names)
- `npm run build` — green; all routes compile successfully; `/plants` bundle 7.19 kB

## Deviations from Plan

None — plan executed exactly as written. All three files match the spec verbatim.

## Known Stubs

None. These are component extractions with no data sources — they receive data via props.

## Threat Flags

None. Component extraction only; no new network endpoints, auth paths, or trust boundaries introduced.

## Self-Check: PASSED

- [x] `app/(app)/plants/FilterSection.tsx` exists
- [x] `app/(app)/plants/PlantCard.tsx` exists
- [x] `app/(app)/plants/PlantCardSkeleton.tsx` exists
- [x] Commit `db4b27d` exists in git log
- [x] Build passes (green)
