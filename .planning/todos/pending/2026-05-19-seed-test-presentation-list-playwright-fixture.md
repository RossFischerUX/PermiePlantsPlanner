---
created: 2026-05-19T09:22:26.072Z
title: Seed "[TEST] Presentation List" for Playwright logged-in auth account
area: testing
resolves_phase: 5
files:
  - tests/plants.spec.ts:229
  - tests/plants.spec.ts:236
  - tests/.auth-state.json
---

## Problem

The two logged-in "Add to list" tests fail against production:

- `tests/plants.spec.ts:229` — *clicking "Add to list" opens dropdown with list names*
- `tests/plants.spec.ts:236` — *selecting a list changes button to "✓ Added"*

Both wait for `getByText('[TEST] Presentation List')` after clicking "+ Add to
list". The dropdown opens, but the stored-auth test account
(`tests/.auth-state.json`) owns no `plant_list` named `[TEST] Presentation List`,
so the locator never resolves and the tests time out.

This is a **test-fixture / seed-data gap in the lists feature**, not an
application-code bug. It surfaced during the 2026-05-19 Phase 2 verification-debt
closure: a full `plants.spec.ts` run against production passed all 28
detail-page/browse tests; only these 2 list-fixture-dependent tests failed. They
were explicitly out of scope for the Phase 2 debt item (which scoped to
detail-page tests) and are unrelated to Phase 2 or Phase 3 changes.

## Solution

Before Phase 5 (List UX & Security) — which is the natural home for lists work —
ensure the Playwright auth account has a deterministic seeded list:

- Create a `plant_list` titled exactly `[TEST] Presentation List` owned by the
  `tests/.auth-state.json` user (idempotent — create-if-absent), OR
- Add a Playwright fixture / global-setup step that provisions it before the
  logged-in project runs, OR
- Relax the tests to create the list via UI in a `beforeAll` rather than
  assuming pre-seeded data.

Decide which approach fits the suite's existing patterns (no global-setup exists
today; auth state is a cached storageState file). Whichever is chosen, the
logged-in `plants.spec.ts` suite must be fully green against production after
the fix. Tracked to resolve in Phase 5 (`resolves_phase: 5`).
