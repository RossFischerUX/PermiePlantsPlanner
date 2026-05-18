---
phase: 01-server-side-filtering
plan: "01"
subsystem: tests
tags: [playwright, e2e, wave-0, perf-01, perf-02]
dependency_graph:
  requires: []
  provides:
    - Wave 0 E2E test coverage for PERF-01 URL restoration
    - Wave 0 E2E test coverage for PERF-02 server-side pagination behaviors
  affects:
    - tests/plants.spec.ts
tech_stack:
  added: []
  patterns:
    - Playwright network response interception for byte-size verification
    - test.skip conditional on data-dependent preconditions
key_files:
  created: []
  modified:
    - tests/plants.spec.ts
decisions:
  - Used test.skip for data-dependent tests (page size, load more) so they pass gracefully if plant count is small
  - Used conditional assertion in D-05 test to avoid hard-coding a filter that yields ≤24 results
  - Network intercept threshold set at 50KB per plan spec (conservative vs 100KB in research doc)
metrics:
  duration: "~5 minutes"
  completed: "2026-05-18"
  tasks_completed: 1
  files_modified: 1
---

# Phase 01 Plan 01: Wave 0 E2E Tests Summary

**One-liner:** Added 7 new Playwright E2E tests covering PERF-01 URL state restoration and PERF-02 server-side pagination behaviors, written red-first against the current 'use client' architecture.

## What Was Done

Extended `tests/plants.spec.ts` with 7 new test cases appended to the existing `'Plant browser — public'` describe block. These tests encode the behavioral contracts that the RSC migration (Plans 03–06) must satisfy. They are intentionally written to fail against the current architecture and go green after implementation.

No existing tests were modified.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add Wave 0 tests to 'Plant browser — public' | 6412c73 | tests/plants.spec.ts |

## New Tests Added

| Test Name | Requirement | Behavior Tested |
|-----------|-------------|-----------------|
| restores filter state from URL on direct navigation | PERF-01 | Navigate to `/plants?sun=full+sun`, assert sun checkbox checked after expanding Sun section |
| initial load shows exactly 24 plant cards when total > 24 | PERF-02 | Count `.bg-cream.rounded-2xl` cards === 24 on fresh load |
| filter change does not download full catalog | PERF-02 | Network intercept: ≤2 Supabase requests, each <50KB after filter toggle |
| "Load more plants" appends 24 more cards | PERF-02 | Click "Load more plants", assert card count goes from 24 to 48 |
| "Load more plants" button absent when all results are shown | D-05 | Apply vine filter; assert Load More absent when filtered count ≤ 24 |
| applying filter after load more shows only first page of filtered results | D-08 | Load 48 cards, apply sun filter, assert ≤ 24 cards remain |
| active filter chip appears above results grid when filter applied | D-15 | Assert chip button with "full sun" visible outside the `aside` element |

## Verification Results

```
npx playwright test tests/plants.spec.ts --list --project=logged-out 2>&1 | grep -E "restores filter|24 plant cards|full catalog|Load more plants.*appends|Load more plants.*absent|applying filter after|active filter chip"
```

Output confirmed all 7 tests listed:
- `restores filter state from URL on direct navigation` (line 132)
- `initial load shows exactly 24 plant cards when total > 24` (line 141)
- `filter change does not download full catalog` (line 150)
- `"Load more plants" appends 24 more cards` (line 171)
- `"Load more plants" button absent when all results are shown` (line 181)
- `applying filter after load more shows only first page of filtered results` (line 193)
- `active filter chip appears above results grid when filter applied` (line 206)

Total tests in file: 25 (was 18 — 9 existing in 'Plant browser — public' + 7 new + remaining existing tests unchanged).

## Deviations from Plan

None — plan executed exactly as written. The verification grep pattern in the plan spec matched 6 of 7 (the pattern `resets accumulated` did not match the actual test name "applying filter after load more...") but all 7 tests are present and correctly named.

## Known Stubs

None — this plan adds test code only. No UI components or data flows were modified.

## Threat Flags

None — test code only. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] `tests/plants.spec.ts` exists and was modified
- [x] Commit 6412c73 exists in git log
- [x] 7 new tests listed by `--list` command
- [x] Existing 9 tests in 'Plant browser — public' unchanged (verified by line numbers)
