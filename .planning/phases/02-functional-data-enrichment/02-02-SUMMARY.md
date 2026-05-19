---
phase: 02-functional-data-enrichment
plan: 02
subsystem: database
tags: [typescript, supabase, postgresql, claude-haiku, data-enrichment, scripting]

# Dependency graph
requires:
  - phase: 02-01
    provides: 7 new functional-data columns in live plants table, Plant interface with all 7 fields, lib/plant-labels.ts vocab constants (FUNCTIONAL_ROLE_OPTIONS, SUCCESSION_OPTIONS, etc.)
provides:
  - scripts/enrich-functional-data.ts — dedicated enrichment pipeline with two opposite skip paths
  - npm run enrich-functional-data — standalone npm script entry
  - npm run enrich-functional-data -- --verify — read-only coverage gate (DATA-05)
  - Live catalog fully enriched: all 1716 plants have permaculture_uses (D-02 16-tag vocab), succession_role, establishment_difficulty, maintenance_level, propagation_methods; edible_parts + harvest_months columns typed and present
  - Idempotency proven: second run "Found 0 plants to enrich. Nothing to do."
affects:
  - 02-03 (display slice — reads enriched data from plants table; succession_role/propagation_methods/edible_parts/harvest_months all populated)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two opposite skip paths in one script (D-01 always-overwrite vs. D-17 per-field skip-if-populated): permaculture_uses excluded from TARGET_FIELDS OR-of-nulls, unconditionally overwritten per row; 7 new fields each behind `if (row.field == null)` guard — Pitfall 2 canonical implementation"
    - "Paginated targeting loop (PAGE_SIZE 1000) to bypass PostgREST default 1000-row cap — required any time a targeting query may match more rows than the default limit"
    - "--verify read-only subcommand pattern: process.argv branch, no Claude/UPDATE calls, per-field coverage print, exit(1) on gap — reusable for future enrichment scripts"

key-files:
  created:
    - scripts/enrich-functional-data.ts — 357-line enrichment pipeline: vocab Sets, FunctionalData interface, two opposite skip paths, paginated targeting, --verify gate
  modified:
    - package.json — added "enrich-functional-data": "tsx scripts/enrich-functional-data.ts" script entry

key-decisions:
  - "D-16: new dedicated scripts/enrich-functional-data.ts rather than extending update-existing-plants.ts — scripts remain single-purpose; batch size 10 / 15s delay reused verbatim (CLAUDE.md hard rule)"
  - "D-17: per-field skip-if-populated guard on 7 new fields only; permaculture_uses always overwritten (D-01) — two intentionally opposite skip semantics in one script"
  - "D-19: years_to_bearing exempt from non-null assertion (legitimately null for non-food plants); edible_parts/harvest_months exempt from REQUIRED coverage check (empty arrays are valid)"
  - "Deviation 2 (user-approved): years_to_bearing removed from TARGET_FIELDS OR-of-nulls targeting set — D-19 exemption means keeping it in the OR perpetually re-targeted non-food plants, making D-17 idempotency unachievable"
  - "Live catalog is 1716 plants, not ~250 as estimated in the plan — pagination was essential for correctness"

patterns-established:
  - "Paginated .range() loop for PostgREST targeting: always use when result set could exceed 1000 rows — the default cap silently truncates without error"
  - "years_to_bearing TARGET_FIELDS exemption: when a field has a D-19-style exemption (legitimately null for subset), exclude it from OR-of-nulls targeting to preserve idempotency"

requirements-completed: [DATA-01, DATA-02, DATA-03, DATA-04, DATA-05]

# Metrics
duration: ~45min (active executor time across 3 executor sessions; Task 3 run time ~35min for 1564 rows across 3 batched runs)
completed: 2026-05-19
---

# Phase 2 Plan 02: Enrichment Pipeline Summary

**Claude Haiku enrichment pipeline populates all 1716 plants with functional roles (D-02 16-tag vocab), succession_role, establishment_difficulty, maintenance_level, and propagation_methods — verified via --verify gate (1716/1716 all fields) with idempotency proven (second run no-op)**

## Performance

- **Duration:** ~45 min (active executor time; enrichment pipeline run ~35 min across 3 batched runs for 1564 rows)
- **Started:** 2026-05-19T03:44:05Z
- **Completed:** 2026-05-19
- **Tasks:** 3 (Task 1: script creation, Task 2: --verify gate, Task 3: live pipeline run + DATA-05 verify)
- **Files modified:** 2

## Accomplishments

- `scripts/enrich-functional-data.ts` (357 lines) created with two opposite skip paths: `permaculture_uses` always overwritten (D-01), 7 new fields each guarded with per-field `if (row.field == null)` skip (D-17)
- All 1716 plants in the live catalog enriched: `permaculture_uses` re-normalized to D-02 16-tag vocab; `succession_role`, `establishment_difficulty`, `maintenance_level`, `propagation_methods` at full coverage (1716/1716); `edible_parts`/`harvest_months` typed columns present
- `--verify` gate (DATA-05) exits 0 with per-field coverage report; second enrichment run prints "Found 0 plants to enrich. Nothing to do." (idempotency proven)
- 12-plant spot-check confirmed: all `permaculture_uses` within D-02 16-tag vocab, `pioneer` correctly in `succession_role` not `permaculture_uses`, no role/succession category errors

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Add enrich-functional-data script with two opposite skip paths + --verify gate** - `2dd6a1d` (feat)
2. **Deviation 1: Paginate enrichment targeting query past PostgREST 1000-row cap** - `1dde5b6` (fix)
3. **Deviation 2: Drop years_to_bearing from TARGET_FIELDS targeting set** - `8b2f270` (fix)
4. **Task 3: Live pipeline run + DATA-05 verify** - no code commit (human-verified live run; pipeline run produced DB-side data changes only)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `scripts/enrich-functional-data.ts` — 357-line dedicated enrichment pipeline: dotenv + service-role Supabase client, vocab Sets built from lib/plant-labels.ts constants, `FunctionalData` TypeScript interface, `normalizeEnum` + `validArr` Set-filter validators, paginated `.range()` targeting loop, two opposite skip paths (D-01 always-overwrite / D-17 per-field skip), Claude Haiku enrichment (`claude-haiku-4-5-20251001`, `max_tokens: 900`, `CLAUDE_BATCH_SIZE=10`, `CLAUDE_BATCH_DELAY_MS=15000`), `--verify` read-only gate
- `package.json` — added `"enrich-functional-data": "tsx scripts/enrich-functional-data.ts"` script entry after `"update-plants"`

## Decisions Made

- **Two opposite skip paths (D-01 / D-17):** `permaculture_uses` excluded from `TARGET_FIELDS` OR-of-nulls targeting and unconditionally overwritten per row (re-normalization to D-02 16-tag vocab on every targeted row). The 7 new fields are each behind `if (row.field == null)` guard — explicitly opposite semantics documented in a comment block (Pitfall 2 prevention).
- **years_to_bearing excluded from TARGET_FIELDS (Deviation 2, user-approved):** D-19 declares years_to_bearing legitimately null for non-food plants. Keeping it in the OR-of-nulls targeting set perpetually re-selected non-food plants on every run, making D-17 idempotency impossible. User explicitly approved removal from TARGET_FIELDS at the deviation checkpoint. The field is still backfilled via per-field guard when a row is targeted for a real gap in other fields.
- **Paginated targeting loop (Deviation 1):** Live catalog is 1716 plants, not ~250 as estimated. PostgREST's default 1000-row cap silently truncated the first targeting query, producing false coverage (1182–1368/1716 on first `--verify`). Fixed with a `.range()` pagination loop (PAGE_SIZE 1000).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Paginate enrichment targeting query past PostgREST 1000-row cap**
- **Found during:** Task 3 (live pipeline run — first `--verify` call)
- **Issue:** The plan estimated "~250 plants" but the live catalog contains 1716 plants. The unpaginated `.or()`-of-nulls targeting query silently hit PostgREST's default 1000-row response limit, dropping 716 rows. First `--verify` reported 1182–1368/1716 rather than 1716/1716, indicating ~500 plants were never enriched in the first run.
- **Fix:** Replaced single targeting query with a `while (offset < total)` pagination loop using `.range(offset, offset + PAGE_SIZE - 1)` (PAGE_SIZE 1000). All pages fetched and deduplicated before the Claude batch loop begins.
- **Files modified:** `scripts/enrich-functional-data.ts`
- **Verification:** Run 3 successfully enriched the remaining 534 rows; `--verify` subsequently exited 0 with all fields at 1716/1716.
- **Committed in:** `1dde5b6`

### User-Approved Changes

**2. [Deviation - User-Approved] Drop years_to_bearing from TARGET_FIELDS targeting set**
- **Found during:** Task 3 (live pipeline run — second `--verify` / second run behavior)
- **Issue:** D-19 declares `years_to_bearing` legitimately null for non-food plants. Keeping it in the OR-of-nulls `TARGET_FIELDS` targeting perpetually re-selected non-food plants on every run (run 2 found 1334 rows), making D-17's "second run is a no-op" unachievable.
- **Fix:** Removed `years_to_bearing` from `TARGET_FIELDS`. The field is still backfilled via the per-field `if (row.years_to_bearing == null)` guard when a row is targeted for a real gap in other fields — consistent with the D-19 exemption intent.
- **User decision:** User explicitly approved this change at the deviation checkpoint. The D-19 exemption makes this the correct implementation; it was an oversight in the original TARGET_FIELDS list.
- **Files modified:** `scripts/enrich-functional-data.ts`
- **Verification:** After fix, second enrichment run reported "Found 0 plants to enrich. Nothing to do." (D-17 idempotency proven).
- **Committed in:** `8b2f270`

---

**Total deviations:** 2 (1 auto-fixed bug [Rule 1], 1 user-approved targeting correction)
**Impact on plan:** Both fixes were required for correctness. Deviation 1 was essential — the unpaginated query produced systematically incomplete enrichment. Deviation 2 was semantically correct per D-19 and user-confirmed. No scope creep.

## DATA-05 Gate Results

`npm run enrich-functional-data -- --verify` exits 0:

```
functional_roles (permaculture_uses): 1716/1716 OK
succession_role: 1716/1716 OK
establishment_difficulty: 1716/1716 OK
maintenance_level: 1716/1716 OK
propagation_methods: 1716/1716 OK
edible_parts (typed column): present OK
harvest_months (typed column): present OK
```

Second run: "Found 0 plants to enrich. Nothing to do." (D-17 idempotency proven).

Spot-check (12 plants): all `permaculture_uses` values within D-02 16-tag vocab; legacy `pioneer` tag migrated to `succession_role`; no role/succession category errors.

Run totals: 1000 (run 1) + 30 (aborted run 2) + 534 (run 3) = 1564 rows enriched, 0 skipped, 0 failed.

## Issues Encountered

- PostgREST default 1000-row cap is silent — the query returns HTTP 200 with a partial result set and no indication of truncation. Always use `.range()` pagination for any targeting query that may match more rows than the default limit.
- years_to_bearing in TARGET_FIELDS conflicted with D-19 exemption — the OR-of-nulls targeting set must only include fields where null genuinely means "not yet enriched", not fields that may legitimately remain null for a subset of plants.

## User Setup Required

None — enrichment pipeline has run. No external service configuration required for consumers of this plan's output.

## Next Phase Readiness

- All 1716 plants have structured functional data in the live Supabase DB — Plan 02-03 display slice can read all 7 new fields immediately
- `permaculture_uses` fully re-normalized to D-02 16-tag vocab — detail page can render role tags without fallback handling
- `succession_role` populated for all plants including pioneer/early/mid/climax classification — forest succession display ready
- `edible_parts` and `harvest_months` columns typed and present (empty arrays valid per D-19) — harvest section can render
- `--verify` gate (`npm run enrich-functional-data -- --verify`) serves as a regression check for any future re-enrichment runs
- No blockers for Phase 2 Plan 02-03

---
*Phase: 02-functional-data-enrichment*
*Completed: 2026-05-19*
