---
phase: 02-functional-data-enrichment
plan: 01
subsystem: database
tags: [supabase, postgresql, typescript, plant-data, migration]

# Dependency graph
requires:
  - phase: 01-server-side-filtering
    provides: lib/plant-labels.ts extensible constants home (Phase 1 D-09), Plant interface in lib/types.ts, PERM_USE_OPTIONS as filter sidebar anchor
provides:
  - 7 new functional-data columns in live plants table (succession_role, propagation_methods, edible_parts, harvest_months, establishment_difficulty, maintenance_level, years_to_bearing)
  - Extended Plant TypeScript interface with all 7 fields under strict mode
  - D-02 16-tag FUNCTIONAL_ROLE_OPTIONS vocab with PERM_USE_OPTIONS alias preserving v1 filter sidebar
  - Enrichment script vocab sets: SUCCESSION_OPTIONS, ESTABLISHMENT_OPTIONS, MAINTENANCE_OPTIONS, PROPAGATION_OPTIONS, EDIBLE_PART_OPTIONS
  - FUNCTIONAL_INFO_LABELS map for detail-page InfoCell display labels
affects:
  - 02-02 (enrich-functional-data script — reads Plant interface + uses all vocab consts as VALID_ sets)
  - 02-03 (detail page display — reads new Plant fields + uses FUNCTIONAL_INFO_LABELS + FUNCTIONAL_ROLE_OPTIONS)

# Tech tracking
tech-stack:
  added:
    - eslint 8.x + eslint-config-next 14.x (pre-existing missing devDeps — added to enable lint verification)
    - .eslintrc.json (Next.js core-web-vitals preset)
  patterns:
    - FUNCTIONAL_ROLE_OPTIONS as canonical + PERM_USE_OPTIONS = FUNCTIONAL_ROLE_OPTIONS alias pattern (D-04 import preservation)
    - FUNCTIONAL_INFO_LABELS Record<string, string> for InfoCell label lookup (extensible per Phase 1 D-09)

key-files:
  created:
    - supabase/migrations/20260518192238_add_functional_data_fields.sql — 7 ADD COLUMN DDL, CHECK constraints for enums
    - .eslintrc.json — Next.js ESLint config (pre-existing gap filled)
  modified:
    - lib/types.ts — 7 new fields appended to Plant interface after permaculture_uses
    - lib/plant-labels.ts — FUNCTIONAL_ROLE_OPTIONS (16-tag D-02 vocab), PERM_USE_OPTIONS alias, 5 new vocab arrays, FUNCTIONAL_INFO_LABELS map
    - package.json — eslint, eslint-config-next devDeps added
    - package-lock.json — dependency lock update

key-decisions:
  - "D-02 reconciliation: legacy PERM_USE_OPTIONS 10-tag vocab replaced with 16-tag D-02 controlled vocabulary; alias preserved for FilterControls.tsx v1 importer (D-04)"
  - "D-08: ForestGardenLayer type unchanged; forest_garden_layer not re-added to migration"
  - "Task 2 was a human-verified live DB push (supabase db push) — confirmed applied before Task 3 TS types were written"
  - "ESLint was absent from project devDeps; added as Rule 3 blocking fix to enable npm run lint verification"

patterns-established:
  - "FUNCTIONAL_ROLE_OPTIONS canonical + PERM_USE_OPTIONS alias: use this pattern for any future vocab reconciliation where a legacy export name must be preserved for existing importers"
  - "FUNCTIONAL_INFO_LABELS Record<string, string>: per-field InfoCell label lookup in lib/plant-labels.ts — extend for new scalar fields rather than inlining in page components"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04]

# Metrics
duration: ~25min (Tasks 1+3; Task 2 was human-verified DB push)
completed: 2026-05-19
---

# Phase 2 Plan 01: Schema + Type Foundation Summary

**7-column Supabase migration applied live, Plant interface extended strict-TS, and D-02 16-tag functional-role vocabulary reconciled with PERM_USE_OPTIONS alias preserving v1 filter sidebar**

## Performance

- **Duration:** ~25 min (active executor time; Task 2 was an async human-verified DB push)
- **Started:** 2026-05-19T02:21:23Z
- **Completed:** 2026-05-19
- **Tasks:** 3 (Task 1: migration write, Task 2: human-verified DB push, Task 3: types + vocab)
- **Files modified:** 6

## Accomplishments

- Migration `20260518192238_add_functional_data_fields.sql` written and applied to live Supabase DB via `supabase db push` (Task 2, human-confirmed)
- `Plant` interface in `lib/types.ts` extended with 7 new fields (`succession_role`, `establishment_difficulty`, `maintenance_level`, `years_to_bearing`, `propagation_methods`, `edible_parts`, `harvest_months`) — exact migration column name match, strict TS passes
- `lib/plant-labels.ts` fully reconciled: legacy 10-tag `PERM_USE_OPTIONS` replaced by D-02 16-tag `FUNCTIONAL_ROLE_OPTIONS`; `PERM_USE_OPTIONS` kept as alias so `FilterControls.tsx:7,40` importer and `queryBuilder.ts:20` remain unbroken
- All downstream vocab constants exported: `SUCCESSION_OPTIONS`, `ESTABLISHMENT_OPTIONS`, `MAINTENANCE_OPTIONS`, `PROPAGATION_OPTIONS`, `EDIBLE_PART_OPTIONS`, `FUNCTIONAL_INFO_LABELS`

## Task Commits

Each task was committed atomically:

1. **Task 1: Write functional-data migration** - `b93f09e` (feat)
2. **Task 2: Apply migration to live Supabase DB** - no commit (human-verified DB push — `supabase db push` confirmed applied)
3. **Task 3: Extend Plant interface + reconcile plant-labels vocabulary** - `fbeab68` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `supabase/migrations/20260518192238_add_functional_data_fields.sql` — 7 ADD COLUMN DDL; CHECK constraints for establishment_difficulty/maintenance_level enums; plain TEXT[] for array fields (no DB CHECK per D-discretion)
- `lib/types.ts` — 7 new nullable fields on Plant interface inserted after permaculture_uses, before notable_cultivars
- `lib/plant-labels.ts` — FUNCTIONAL_ROLE_OPTIONS (canonical 16-tag), PERM_USE_OPTIONS alias, SUCCESSION_OPTIONS, ESTABLISHMENT_OPTIONS, MAINTENANCE_OPTIONS, PROPAGATION_OPTIONS, EDIBLE_PART_OPTIONS, FUNCTIONAL_INFO_LABELS map
- `.eslintrc.json` — Next.js core-web-vitals ESLint config (pre-existing gap)
- `package.json` + `package-lock.json` — eslint 8 + eslint-config-next 14 devDeps

## Decisions Made

- **PERM_USE_OPTIONS alias pattern** (D-04): rather than renaming the export (which would break `FilterControls.tsx`, `queryBuilder.ts`, `searchParams.ts`), `FUNCTIONAL_ROLE_OPTIONS` is the canonical constant and `PERM_USE_OPTIONS = FUNCTIONAL_ROLE_OPTIONS` is the alias. Future code should import `FUNCTIONAL_ROLE_OPTIONS`; existing importers continue to work.
- **Task 2 blocking checkpoint cleared by human**: `supabase db push` was run manually and confirmed. Task 3 TS types depend on column names matching the migration — the push happened before Task 3 was executed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing ESLint configuration prevented npm run lint**
- **Found during:** Task 3 (verify block)
- **Issue:** Project had no `.eslintrc.json` and ESLint was not in devDependencies. Running `npm run lint` launched Next.js interactive ESLint setup wizard, blocking verification.
- **Fix:** Created `.eslintrc.json` with `next/core-web-vitals` preset; installed `eslint@8` + `eslint-config-next@14` (matching Next.js 14.2 in use). ESLint 9 was initially auto-installed but is incompatible with the legacy bridge used by Next.js 14 — downgraded to 8.
- **Files modified:** `.eslintrc.json`, `package.json`, `package-lock.json`
- **Verification:** `npm run lint` exits 0; two pre-existing `react-hooks/exhaustive-deps` warnings in `AddToListClient.tsx` (not caused by this plan's changes)
- **Committed in:** `fbeab68` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking lint infrastructure gap)
**Impact on plan:** ESLint fix was necessary to complete the plan's own verify step. No scope creep; existing warnings are pre-existing in unrelated files.

## Issues Encountered

- ESLint 9 (auto-installed from npm latest) conflicts with `eslint-config-next@16` flat config bridge used by `next lint` — resolved by pinning `eslint@8` + `eslint-config-next@14` to match Next.js 14.2 version parity.

## User Setup Required

None — no external service configuration required beyond the Task 2 DB push (already completed).

## Next Phase Readiness

- All 7 columns exist in the live Supabase DB — Plan 02-02 enrichment script can write to them immediately
- `Plant` interface compiles under strict TS — Plan 02-03 detail page can read all new fields safely
- All vocab constants (`FUNCTIONAL_ROLE_OPTIONS`, `SUCCESSION_OPTIONS`, etc.) are exported from `lib/plant-labels.ts` — Plan 02-02 script imports them as `VALID_*` sets for enum validation
- `FUNCTIONAL_INFO_LABELS` ready for Plan 02-03 InfoCell label rendering
- No blockers for Phase 2 Plans 02 and 03

---
*Phase: 02-functional-data-enrichment*
*Completed: 2026-05-19*
