---
phase: 02-functional-data-enrichment
plan: 03
subsystem: ui
tags: [typescript, react, nextjs, playwright, tailwind, botanical-heritage, functional-data]

# Dependency graph
requires:
  - phase: 02-01
    provides: 7 new functional-data columns in plants table, Plant interface, lib/plant-labels.ts MONTH_OPTIONS + FUNCTIONAL_INFO_LABELS constants
  - phase: 02-02
    provides: All 1716 plants fully enriched with permaculture_uses (D-02 16-tag vocab), succession_role, establishment_difficulty, maintenance_level, propagation_methods, edible_parts, harvest_months
provides:
  - app/(app)/plants/[id]/page.tsx — 4 dedicated display sections (Functional Roles, Forest Layer & Succession, Establishment & Care, Harvest) replacing the generic Permaculture section
  - tests/plants.spec.ts — 5 new Playwright assertions covering 4 sections + conditional-hide + D-05 regression
  - DATA-01..DATA-04 user-facing display layer complete
affects:
  - Phase 3+ (Companion Planting, Location Infrastructure) — detail page pattern established for conditional-hide sections; plants table enrichment complete

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "filter-Boolean idiom for IIFE section guards: careCells computed in IIFE returned to JSX — handles compound section guards without top-level variables"
    - "years_to_bearing != null guard (not truthy): Pitfall 4 prevention — 0 is a valid integer value for years_to_bearing"
    - "harvest_months calendar sort: [...array].sort((a,b) => MONTH_OPTIONS.indexOf(a) - MONTH_OPTIONS.indexOf(b)) — identical pattern to bloom_months"
    - "Playwright section scoping: page.locator('section').filter({ hasText: 'Section Title' }) — prevents footer link ambiguity per CLAUDE.md"

key-files:
  created: []
  modified:
    - app/(app)/plants/[id]/page.tsx — D-05 section restructure: 4 dedicated sections replacing generic Permaculture, byte-identical pill/InfoCell markup, conditional-hide via && guards
    - tests/plants.spec.ts — 5 new assertions in Plant detail page — public describe block

key-decisions:
  - "D-05: retired generic Permaculture section redistributed into 4 dedicated sections — Functional Roles (permaculture_uses pills), Forest Layer & Succession (InfoCell + pills), Establishment & Care (3 InfoCells + propagation pills), Harvest (edible_parts + calendar-ordered harvest_months pills)"
  - "D-06: byte-identical pill markup reused for all 5 array fields; InfoCell component reused for all 4 scalar fields — no new components introduced"
  - "D-07: per-section && guard hides entire section when all fields null/empty; per-field guards omit individual InfoCells/pill rows within sections — never renders N/A or Unknown"
  - "IIFE pattern for Establishment & Care: careCells filter-Boolean array computed inside IIFE to allow compound section guard (careCells.length || propagation_methods?.length) without top-level variable pollution"

patterns-established:
  - "Section conditional-hide: section-level guard on the outermost JSX node (not a wrapper div); per-field guards inside for individual omissions"
  - "IIFE for compound section guards: wrap in (() => { ... })() when section guard depends on computed array from filter-Boolean"
  - "Playwright assertions against enriched data: section.filter({ hasText }) scoping + .locator('span.rounded-full') for pills + .locator('p', { hasText }) for InfoCell labels"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04]

# Metrics
duration: ~2min (Task 2 — tests only; Task 1 was pre-completed in commit 65f42db)
completed: 2026-05-19
---

# Phase 2 Plan 03: Display Slice Summary

**Plant detail page restructured with 4 dedicated functional-data sections (Functional Roles, Forest Layer & Succession, Establishment & Care, Harvest) replacing the generic Permaculture section — conditionally hidden per D-07, verified with 10 passing Playwright assertions against live enriched Supabase data**

## Performance

- **Duration:** Task 1 pre-completed (commit 65f42db); Task 2 ~2 min active executor time
- **Started:** 2026-05-19T05:30:43Z
- **Completed:** 2026-05-19
- **Tasks:** 2 (Task 1 pre-committed; Task 2 this session)
- **Files modified:** 2

## Accomplishments

- `app/(app)/plants/[id]/page.tsx` restructured with 4 dedicated sections (D-05): Functional Roles (permaculture_uses pills), Forest Layer & Succession (forest_garden_layer InfoCell + succession_role pills), Establishment & Care (establishment_difficulty/maintenance_level/years_to_bearing InfoCells + propagation_methods pills), Harvest (edible_parts + calendar-sorted harvest_months pills)
- D-07 conditional-hide fully implemented: section-level guards hide entire sections when all fields null/empty; per-field guards omit individual rows — no N/A or Unknown shown anywhere
- `years_to_bearing != null` guard (Pitfall 4 prevention) — integer 0 is valid, truthy check would omit it
- 5 new Playwright tests added to `Plant detail page — public` describe block; all 10 detail tests pass green against localhost with live enriched Supabase data
- DATA-01..DATA-04 user-facing display layer complete — real users can now see functional role tags, forest layer, succession roles, establishment info, and harvest data on any plant detail page

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace Permaculture section with 4 dedicated sections** - `65f42db` (feat)
2. **Task 2: Add Playwright assertions for 4 new sections + conditional-hide** - `bbfb644` (test)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `app/(app)/plants/[id]/page.tsx` — D-05 section restructure: 4 dedicated sections replacing retired generic Permaculture section; `MONTH_OPTIONS` + `FUNCTIONAL_INFO_LABELS` imported from `@/lib/plant-labels`; byte-identical `bg-terracotta/10 text-terracotta px-3 py-1.5 rounded-full border border-terracotta/20 capitalize` pill markup for all 5 array fields; reused `InfoCell` for all 4 scalar fields; conditional-hide via `&&`/filter-Boolean guards; `years_to_bearing != null` guard
- `tests/plants.spec.ts` — 5 new tests in `Plant detail page — public` describe: Permaculture heading count=0 regression, Functional Roles pill visible, Forest Layer & Succession presence, Establishment & Care InfoCell labels, Harvest conditional-hide

## Decisions Made

- **Test robustness over strict assertion:** Forest Layer & Succession test checks `hasLayer + hasPills > 0` (rather than asserting a specific label) because the specific fields present depend on which plant first loads in the browser — section presence alone verifies D-07 correctly rendered data. Establishment & Care and Functional Roles tests use the known `invasivePlantId` for deterministic plant selection.
- **IIFE for Establishment & Care section guard:** The section needs a compound guard (InfoCells array OR propagation_methods), requiring a computed `careCells` variable. Rather than hoisting to file scope, wrapped in an IIFE `(() => { ... })()` to keep the section self-contained — matches existing `overviewCells` pattern but scoped to JSX.

## Deviations from Plan

None — plan executed exactly as specified. Both tasks implemented per plan action spec; byte-identical pill markup, D-07 conditional-hide, MONTH_OPTIONS calendar ordering, years_to_bearing != null guard all present as required.

## Known Deploy Gate

**Production-targeted CI verification is deploy-gated (expected, not a failure).**

`playwright.config.ts` hardcodes `baseURL: 'https://permacultureplantpicker.com'` (intentional per CLAUDE.md — CI targets production). The Task 1 page.tsx restructure is committed to `main` locally but not yet deployed to Vercel. Therefore:

- Production Playwright CI run will pass the Permaculture-removed regression test (that section was already absent before this plan)
- The 4 new section tests will fail on production CI until `main` is deployed to Vercel

**Validation completed locally:** All 10 detail-page tests passed green (`10 passed (14.4s)`) against `http://localhost:3000` with the live enriched Supabase DB (1716 plants, all fields populated). Local run confirmed:
- Real `permaculture_uses` pills render in Functional Roles section
- `forest_garden_layer`/`succession_role` data visible in Forest Layer & Succession
- `establishment_difficulty`/`maintenance_level` InfoCells present in Establishment & Care
- Harvest section conditional-hide works (absent for non-edible plants, present with pills for edible plants)
- Old Permaculture `<h2>` has count 0

**Required next step:** Deploy `main` to Vercel to enable full production CI validation of the 4 new section assertions.

## Issues Encountered

None — Task 1 page.tsx changes were pre-validated (build/tsc/lint green per commit 65f42db); Task 2 tests passed first run against localhost.

## User Setup Required

None — no external service configuration required. Deploy to Vercel to complete production CI verification.

## Next Phase Readiness

- DATA-01..DATA-04 user-facing display complete: plant detail page shows functional roles, forest layer + succession, establishment + care, harvest for all 1716 enriched plants
- DATA-05 pipeline verification (from 02-02) already in place
- Phase 2 complete once `main` deployed to Vercel
- Phase 3 (Companion Planting Schema) can begin; no blockers from this plan

---
*Phase: 02-functional-data-enrichment*
*Completed: 2026-05-19*
