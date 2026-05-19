---
phase: quick/260518-vxy
plan: dedupe-plants-table
subsystem: database
tags: [supabase, postgresql, deduplication, data-cleanup, scripts]

requires: []
provides:
  - Clean 1-row-per-species plants catalog (1455 rows, zero duplicate groups)
  - Idempotent dedupe script with dry-run + --apply modes
affects:
  - Phase 2 gap-closure enrichment (correct coverage counts now possible)
  - Plant browser (no duplicate species cards)

tech-stack:
  added: []
  patterns:
    - "Service-role Supabase client + .range() pagination for catalog-scale reads"
    - "FK-safe deletion: repoint/delete join rows before deleting referenced parent rows"
    - "In-memory (list_id, plant_id) set for O(1) canonical-presence checks"

key-files:
  created:
    - scripts/dedupe-plants.ts
  modified:
    - package.json
    - CLAUDE.md

key-decisions:
  - "Canonical row = highest enrichment score across 9 functional fields; tiebreak oldest created_at; final tiebreak smallest id (deterministic)"
  - "Species identity key = normalized latin_name (trim + collapse whitespace + lowercase); fallback to common_name if latin_name null/empty"
  - "apply() always recomputes from fresh DB read (not stale --report-json) — keeps script idempotent and re-runnable"
  - "No unique constraint on plant_list_items(list_id, plant_id) — detect redundant join rows in-memory and DELETE instead of UPDATE"

requirements-completed: []

duration: ~15min
completed: 2026-05-18
---

# Quick Task 260518-vxy: De-duplicate plants table

**Collapsed 153 duplicate species groups (261 rows) from the live plants catalog using enrichment-score canonicalization, leaving 1455 clean 1-row-per-species rows with zero dangling FK references**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-05-18
- **Completed:** 2026-05-18
- **Tasks:** 3 (A + B checkpoint + C)
- **Files modified:** 3 (scripts/dedupe-plants.ts, package.json, CLAUDE.md)

## Accomplishments

- Created `scripts/dedupe-plants.ts` with dry-run (default), `--apply` (destructive), and `--report-json` modes
- Human-approved blocking checkpoint (Task B) reviewed the dry-run before any writes: 1716 rows, 153 dupe groups, 261 rows to delete, 1 affected join row
- Applied destructive dedupe: 261 plant rows deleted, 1 join row repointed, 0 errors, 0 duplicate groups remaining
- Post-apply dry-run confirmed catalog is clean: 1455 rows, 0 duplicate groups

## Task Commits

1. **Task A: Create dedupe-plants.ts (dry-run)** — `5c87b19` (feat)
2. **Task B: Human-verify checkpoint** — approved by user (no commit)
3. **Task C: Implement + run --apply destructive path** — `54aa7e7` (feat)

## Files Created/Modified

- `scripts/dedupe-plants.ts` — Full dedupe script: dry-run report, --apply destructive path, --report-json plan export
- `package.json` — Added `dedupe-plants` script
- `CLAUDE.md` — Added doc line for `npm run dedupe-plants`

## Final Numbers

| Metric | Value |
|--------|-------|
| Plant rows before | 1716 |
| Plant rows after | 1455 |
| Duplicate groups collapsed | 153 |
| Plant rows deleted | 261 |
| Join rows repointed | 1 |
| Redundant join rows deleted | 0 |
| Groups with errors | 0 |
| Duplicate groups remaining | 0 |

## Decisions Made

- Enrichment score across 9 functional fields picks canonical; oldest created_at tiebreaks deterministically
- Fresh DB read on every `--apply` invocation (not stale JSON) — script is safely re-runnable as a no-op if already clean
- FK ordering enforced: join rows handled before plant row deletions (no ON DELETE CASCADE on plant_list_items.plant_id)
- In-memory `(list_id, plant_id)` set maintained and updated throughout apply loop so canonical-presence checks reflect mid-run state

## Deviations from Plan

None — plan executed exactly as written. The apply stub from Task A was replaced with the full implementation as planned in Task C.

## Issues Encountered

None. The 1 affected join row was successfully repointed (list already contained a dupe plant; canonical was not yet in that list, so UPDATE was used, not DELETE).

## Important Notes

- Local commits only (`5c87b19`, `54aa7e7`) — NOT pushed, no deployment triggered
- Run this dedupe before Phase 2 gap-closure enrichment scripts — duplicate rows would skew coverage counts
- Script is idempotent: re-running `--apply` on the clean catalog reports "nothing to do" and exits cleanly

## Next Phase Readiness

- Catalog is clean: 1455 unique species rows, ready for Phase 2 gap-closure enrichment
- No blockers introduced

---
*Quick task: 260518-vxy*
*Completed: 2026-05-18*
