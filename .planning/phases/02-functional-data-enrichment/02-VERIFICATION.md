---
phase: 02-functional-data-enrichment
verified: 2026-05-19T08:00:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 4/5
  gaps_closed:
    - "DATA-05: verify gate now hard-fails only on {} (dishonest locked state); NULL is accepted informational residual per D-20"
    - "succession_role: zero {} rows (was 129 pre-02-04); 85 NULL rows are semantically honest residual per D-20"
    - "propagation_methods: zero {} rows (was 4 pre-02-04); 1 NULL row (Spinulum annotinum — spore plant outside 8-method vocab)"
    - "permaculture_uses: zero {} rows (was 8 pre-02-04); 8 NULL rows (toxic invasives, sterile ornamentals — no D-02 role)"
    - "IN-04 closed: Forest Layer & Succession test is now unconditional (no if-hasForestSection wrapper)"
    - "CR-01 closed: enrichWithClaude guards against empty/truncated content block before dereference"
    - "WR-01 closed: years_to_bearing clamped to integer in (0, 200]"
    - "CR-02 skip path closed: {} → NULL normalization on Claude failure prevents relocking rows"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Deploy main branch to Vercel and run the full plants.spec.ts test suite against the production URL"
    expected: "All detail-page tests pass including Functional Roles pill, Forest Layer & Succession unconditional assertion, Establishment & Care, Harvest conditional-hide, and Permaculture regression (D-05)"
    why_human: "Playwright config targets the production URL. The 02-03 and 02-04 commits are on main locally but cannot be verified against the deployed production app without a Vercel deploy. Local validation passed against localhost with live Supabase data."
  - test: "Monitor the Forest Layer & Succession Playwright test (tests/plants.spec.ts line 311) after any future enrichment re-run that touches common ivy (invasivePlantId 3de58838-baf3-4c42-84b8-ad1b2d359529)"
    expected: "The test asserts a succession pill is visible for common ivy. This holds as long as common ivy has succession_role non-empty in the live DB. A future re-enrichment run where Claude returns no valid succession tags for this plant would set the field to NULL (per D-20 semantics) and silently false-fail the test — the test would fail with no code regression."
    why_human: "D-20 explicitly permits succession_role=NULL as a legitimate reviewed state. The test's unconditional assertion couples a hard invariant to a mutable production row. Code review WR-02 flagged this: the fix is to assert the section's conditional-hide contract (section present-with-content OR absent) rather than coupling to a specific row's enrichment value. No code break exists today — common ivy has succession_role=['pioneer','early successional'] in the live DB — but this is fragile to future enrichment re-runs."
---

# Phase 02: Functional Data Enrichment — Verification Report (Re-verification after 02-04)

**Phase Goal:** Every plant in the database has structured ecological role, forest layer, establishment, and harvest data — readable in the UI and filterable
**Verified:** 2026-05-19
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan 02-04 (D-20 / CR-01 / CR-02 / WR-01 / IN-04)

## Re-verification Context

The initial verification (2026-05-18) found one blocker: the `--verify` gate reported a hollow green for `succession_role` and `propagation_methods`. A direct DB query showed 129 plants had `succession_role = '{}'` (empty array), which `.not(f,'is',null)` counted as covered. Gap-closure plan 02-04 closed this with decision D-20:

- **D-20:** `{}` is never acceptable for required-array fields — hard-fail on `{}`. `NULL` is the honest re-targetable terminal state — informational, not a failure. This supersedes the implicit D-19 "every plant has non-empty required-array data" assumption.
- Zero `{}` rows now exist for all three required-array fields (confirmed by independent live DB query below).
- The verify gate was reworked to hard-fail on `{}` and print `NULL` residuals as informational.
- The skip path (Claude failure) was patched to convert any `{}` → `NULL` before early return (CR-02 skip-path closure).
- CR-01 (unguarded content[0] dereference) closed.
- WR-01 (unbounded years_to_bearing) closed.
- IN-04 (Forest Layer test silently skipped if section absent) closed.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A plant detail page shows functional role tags from a structured permaculture_uses array | VERIFIED | `plant.permaculture_uses?.length` guard at page.tsx line 151; 1447/1455 plants have non-empty permaculture_uses (8 NULL = honest D-20 residual: toxic invasives, sterile ornamentals) |
| 2 | A plant detail page shows forest layer classification and succession role | VERIFIED | Forest Layer & Succession section at page.tsx lines 163-179; conditional on `plant.forest_garden_layer \|\| plant.succession_role?.length`; 1370/1455 plants have succession data; 85 NULL = reviewed informational residual per D-20 |
| 3 | A plant detail page shows propagation methods, establishment difficulty, and maintenance level | VERIFIED | Establishment & Care section at page.tsx lines 182-208; 1455/1455 establishment_difficulty non-null; 1455/1455 maintenance_level non-null; 1454/1455 propagation_methods non-null (1 NULL = Spinulum annotinum, spore plant outside 8-method vocab) |
| 4 | A plant detail page shows edible parts and approximate harvest months | VERIFIED | Harvest section at page.tsx lines 211-229; conditional-hide on `plant.edible_parts?.length \|\| plant.harvest_months?.length`; D-19: empty arrays valid for non-edible plants |
| 5 | DATA-05 genuinely satisfied: the --verify gate distinguishes "enriched with data" from "enriched with empty array"; zero {} rows for required-array fields | VERIFIED | verify() uses `.not(f,'is',null).neq(f,'{}')` for required-array fields — hard-fails only on `{}`. Live DB (independent query, verifier-run): succession_role `{}`=0, propagation_methods `{}`=0, permaculture_uses `{}`=0. D-20 NULL residuals printed as informational. |

**Score:** 5/5 truths verified

## Live DB State (Verifier-Run, Independent Query — 2026-05-19)

| Field | `= '{}'` count | IS NULL count | OK (non-null, non-empty) | Total |
|-------|---------------|---------------|--------------------------|-------|
| succession_role | **0** | 85 | 1370 | 1455 |
| propagation_methods | **0** | 1 | 1454 | 1455 |
| permaculture_uses | **0** | 8 | 1447 | 1455 |
| edible_parts (D-19) | 839 (valid) | 0 | 616 | 1455 |
| harvest_months (D-19) | 857 (valid) | 0 | 598 | 1455 |
| establishment_difficulty | N/A (scalar) | **0** | 1455 | 1455 |
| maintenance_level | N/A (scalar) | **0** | 1455 | 1455 |

Zero `{}` rows across all three required-array fields. This confirms the D-20 invariant is met. The NULL residuals are the honest documented outcome per D-20 and are not a failure.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260518192238_add_functional_data_fields.sql` | 7-column DDL with CHECK constraints for scalar enums | VERIFIED | All 7 columns present; CHECK for establishment_difficulty (easy/moderate/challenging) and maintenance_level (low/moderate/high); plain TEXT[] for array columns (no DB CHECK, per D-discretion in CONTEXT.md) |
| `lib/types.ts` | Plant interface with 7 new fields | VERIFIED | Lines 32-38: succession_role, establishment_difficulty, maintenance_level, years_to_bearing, propagation_methods, edible_parts, harvest_months all present with correct types; `tsc --noEmit` exits 0 |
| `lib/plant-labels.ts` | FUNCTIONAL_ROLE_OPTIONS (16-tag D-02 vocab) + PERM_USE_OPTIONS alias + 5 vocab arrays + FUNCTIONAL_INFO_LABELS | VERIFIED | All exports present; FUNCTIONAL_ROLE_OPTIONS has 16 D-02 tags; PERM_USE_OPTIONS = alias of FUNCTIONAL_ROLE_OPTIONS (line 10); SUCCESSION_OPTIONS / ESTABLISHMENT_OPTIONS / MAINTENANCE_OPTIONS / PROPAGATION_OPTIONS / EDIBLE_PART_OPTIONS all present; FUNCTIONAL_INFO_LABELS Record with 4 keys |
| `scripts/enrich-functional-data.ts` | Hardened enrichment script with CR-01/CR-02/WR-01 fixes, D-20 verify gate, and empty-array-aware targeting | VERIFIED | 512-line script; CR-01 guard on content[0] (line 135-136: `const block = response.content[0]; const text = block && block.type === 'text' ? block.text.trim() : ''`); CR-02 success-path null-not-[] for succession_role/propagation_methods/permaculture_uses (lines 271-278); CR-02 skip-path {} → NULL normalization (lines 231-256); WR-01 clamp `y > 0 && y <= 200` (line 287); empty-array OR-clause (lines 189-197); verify() dual-count {} vs NULL (lines 366-438) |
| `app/(app)/plants/[id]/page.tsx` | 4 dedicated sections replacing old Permaculture section | VERIFIED | Functional Roles (151-160), Forest Layer & Succession (162-179), Establishment & Care (181-208), Harvest (210-229); no standalone Permaculture h2; InfoCell reused; MONTH_OPTIONS calendar sort; conditional-hide guards present on all 4 sections; build + tsc + lint clean |
| `tests/plants.spec.ts` | 5 new detail-page tests; Forest Layer test unconditional (IN-04 closed) | VERIFIED | Permaculture regression (D-05), Functional Roles pill test, Forest Layer & Succession unconditional test (lines 311-322, no `if (hasForestSection > 0)` wrapper confirmed by grep), Establishment & Care, Harvest conditional-hide. `grep -c "if (hasForestSection" = 0` |
| `package.json` | enrich-functional-data npm script | VERIFIED | `"enrich-functional-data": "tsx scripts/enrich-functional-data.ts"` at line 12 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/types.ts Plant interface` | `supabase/migrations/20260518192238_add_functional_data_fields.sql` | exact column name match | VERIFIED | All 7 field names match migration columns |
| `app/(app)/plants/[id]/page.tsx sections` | `plants.*` (7 new fields) | Supabase `.select('*')` RSC query | VERIFIED | `.select('*')` unchanged; all 7 field reads present in JSX sections |
| `scripts/enrich-functional-data.ts targeting` | `plants table` | `.or()` OR-of-nulls + empty-array terms | VERIFIED | orClause includes `succession_role.is.null`, `propagation_methods.is.null`, `edible_parts.is.null`, `harvest_months.is.null`, `establishment_difficulty.is.null`, `maintenance_level.is.null`, `succession_role.eq.{}`, `propagation_methods.eq.{}`, `permaculture_uses.eq.{}`; paginated with PAGE_SIZE=1000 `.range()` loop |
| `scripts/enrich-functional-data.ts verify()` | `plants table` | `.not(f,'is',null).neq(f,'{}')` for REQUIRED_ARRAY | VERIFIED | Lines 369-376: dual-filter count excludes both NULL and {} from OK tally for permaculture_uses, succession_role, propagation_methods |
| `scripts/enrich-functional-data.ts` | `lib/plant-labels.ts vocab constants` | import at lines 27-35 | VERIFIED | Imports FUNCTIONAL_ROLE_OPTIONS, SUCCESSION_OPTIONS, ESTABLISHMENT_OPTIONS, MAINTENANCE_OPTIONS, PROPAGATION_OPTIONS, EDIBLE_PART_OPTIONS, MONTH_OPTIONS |
| `lib/plant-labels.ts PERM_USE_OPTIONS` | `app/(app)/plants/FilterControls.tsx` | import for permaculture_uses filter sidebar | VERIFIED (pre-existing) | Phase 1 wiring unchanged; PERM_USE_OPTIONS = FUNCTIONAL_ROLE_OPTIONS alias |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| Functional Roles section | `plant.permaculture_uses` | Supabase `.select('*')` RSC | 1447/1455 non-null non-empty; 8 NULL = reviewed D-20 residual | FLOWING |
| Forest Layer & Succession section | `plant.forest_garden_layer`, `plant.succession_role` | Supabase `.select('*')` RSC | forest_garden_layer: pre-existing; succession_role: 1370/1455; 85 NULL = reviewed D-20 residual | FLOWING |
| Establishment & Care section | `plant.establishment_difficulty`, `plant.maintenance_level`, `plant.propagation_methods`, `plant.years_to_bearing` | Supabase `.select('*')` RSC | establishment_difficulty: 1455/1455; maintenance_level: 1455/1455; propagation_methods: 1454/1455; years_to_bearing: legitimately null for non-food plants | FLOWING |
| Harvest section | `plant.edible_parts`, `plant.harvest_months` | Supabase `.select('*')` RSC | 616/1455 non-empty edible_parts; 598/1455 non-empty harvest_months; D-19: empty arrays valid | FLOWING (conditional-hide correct) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript strict build | `npx tsc --noEmit` | exit 0, no errors | PASS |
| ESLint | `npm run lint` | exit 0 (2 pre-existing AddToListClient.tsx warnings only — unchanged) | PASS |
| Zero {} rows — succession_role | Live DB query: `eq('succession_role','{}')` | 0 | PASS |
| Zero {} rows — propagation_methods | Live DB query: `eq('propagation_methods','{}')` | 0 | PASS |
| Zero {} rows — permaculture_uses | Live DB query: `eq('permaculture_uses','{}')` | 0 | PASS |
| verify gate semantics — no bare `.not('is',null)` for array fields | `grep -n ".neq(f, '{}')" scripts/enrich-functional-data.ts` | line 373: `.neq(f, '{}')` present | PASS |
| IN-04 conditional wrapper removed | `grep -c "if (hasForestSection > 0)" tests/plants.spec.ts` | 0 | PASS |
| enrich script npm entry | `grep "enrich-functional-data" package.json` | line 12 confirmed | PASS |

### Probe Execution

No conventional `scripts/*/tests/probe-*.sh` probes exist. The `--verify` subcommand is the phase's declared verification probe. The verifier ran an independent DB query (not the `--verify` script) to confirm the zero-`{}` invariant directly.

The `--verify` gate's exit code 0 at the final state of 02-04 is documented in 02-04-SUMMARY.md:
```
functional_roles (permaculture_uses): 1447/1455 ✓  (8 NULL informational residual)
succession_role: 1370/1455 ✓  (85 NULL informational residual)
propagation_methods: 1454/1455 ✓  (1 NULL informational residual)
establishment_difficulty: 1455/1455 ✓
maintenance_level: 1455/1455 ✓
edible_parts / harvest_months: typed columns present ✓
EXIT_CODE: 0
```

Live DB counts (verifier-independent query) corroborate: zero `{}` rows across all three required-array fields.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 02-01, 02-02, 02-03 | Functional role tags stored as structured array and filterable | SATISFIED | permaculture_uses: 1447/1455 non-empty; 16-tag D-02 vocab enforced; PERM_USE_OPTIONS filter sidebar wiring intact from Phase 1; D-04 scope: no new filter UI, existing filter functional |
| DATA-02 | 02-01, 02-02, 02-03, 02-04 | Forest layer classification and succession role | SATISFIED | forest_garden_layer: pre-existing; succession_role: 1370/1455 non-null non-empty; 85 NULL = D-20 reviewed informational residual (non-successional plant types: annuals, tropical houseplants, etc.); section renders with conditional-hide |
| DATA-03 | 02-01, 02-02, 02-03 | Establishment and care data | SATISFIED | establishment_difficulty: 1455/1455; maintenance_level: 1455/1455; propagation_methods: 1454/1455 (1 NULL = spore plant); years_to_bearing: legitimately null for non-food plants per D-19 |
| DATA-04 | 02-01, 02-02, 02-03 | Edible parts and harvest months | SATISFIED | D-19: empty arrays valid for non-edible plants; columns present and typed; Harvest section conditionally renders; calendar sort via MONTH_OPTIONS |
| DATA-05 | 02-02, 02-04 | Enrichment pipeline with skip-if-populated guard and post-run verification | SATISFIED | verify() hard-fails on `{}` (`.not(f,'is',null).neq(f,'{}')` dual count); exits 0 when `{}`=0 for all required fields; NULL residual printed informational; skip-if-populated guard present (per-field merge block); skip path normalizes `{}` → NULL (CR-02 closed on all code paths) |

REQUIREMENTS.md traceability table marks DATA-01 through DATA-05 as Complete at Phase 2. ✓

**Note on "filterable" scope:** REQUIREMENTS.md DATA-01 marks filterable as satisfied by the existing permaculture_uses filter. D-04 in CONTEXT.md explicitly scopes Phase 2 to schema + display + pipeline only — no new filter UI controls. SRCH-02 (filter sidebar for layer/succession/edible) is v2. This is an intentional scope boundary.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/enrich-functional-data.ts` | 135 | `const block = response.content[0]` — bare index-0 assignment (CR-01 residual) | Info | Safe: immediately guarded by `block && block.type === 'text'` on the next line; no bare dereference on the happy path. CR-01 is closed — this is the guard pattern. |
| `scripts/enrich-functional-data.ts` | 77-80 | `validArr` returns original `s` (not canonical-cased option), then persisted verbatim | Warning (WR-01 per review) | harvest_months sort uses `MONTH_OPTIONS.indexOf(a)` which is case-sensitive; off-casing Claude responses return -1 and sort to front. CSS `capitalize` masks the visual symptom. Affects harvest_months calendar order. Not a data-loss issue. |
| `tests/plants.spec.ts` | 311-322 | Forest Layer & Succession test asserts succession pill on specific mutable production row (common ivy) | Warning (WR-02 per review) | Test passes today (common ivy has succession_role=['pioneer','early successional']). Coupling a hard assertion to a mutable production row's enrichment state is fragile — a future re-enrichment run could set this to NULL (D-20 permits), turning the test into a false-fail with no code regression. |

No `TBD`, `FIXME`, or `XXX` debt markers found in files modified by this phase.

### Human Verification Required

### 1. Production CI — 5 New Detail Page Tests

**Test:** Deploy `main` branch to Vercel, then run `npx playwright test tests/plants.spec.ts` against the production URL.
**Expected:** All detail-page tests pass including: Permaculture section heading absent (D-05 regression), Functional Roles pill visible, Forest Layer & Succession unconditional assertion, Establishment & Care section visible, Harvest conditional-hide behaves correctly.
**Why human:** Playwright config targets the production URL (`permacultureplantpicker.com`). The 02-03 and 02-04 commits (`65f42db`, `bbfb644`, `f0ae261`, `b8cb096`, `d1f13a3`) are on `main` locally but a Vercel deploy is required for production CI validation. Local validation passed against localhost with live Supabase data (per 02-03-SUMMARY.md and 02-04-SUMMARY.md).

### 2. Forest Layer & Succession Test Coupling to Mutable DB Row (WR-02)

**Test:** After any future enrichment re-run that targets common ivy (invasivePlantId `3de58838-baf3-4c42-84b8-ad1b2d359529`), verify the Forest Layer & Succession test at `tests/plants.spec.ts:311` still passes.
**Expected:** The test asserts `forestSection.locator('span.rounded-full').first()` is visible. This is true today (common ivy has `succession_role=['pioneer','early successional']`). After a re-enrichment run, common ivy should still have this data — but D-20 semantics allow Claude to return all-out-of-vocab tags, which would write NULL and hide the pills.
**Why human:** Code review WR-02 identified this coupling as fragile. The recommended fix is to change the test to assert the section's conditional-hide contract (section present-with-content OR absent) rather than coupling to a specific row's enrichment value. This fix was not included in the 02-04 scope because the current state is stable. Consider addressing before the next enrichment re-run.

## Gaps Summary

No blocking gaps remain. All five Data phase truths are VERIFIED. The phase goal is achieved under the amended D-20 definition of done:

- Zero `{}` rows for all three required-array fields — **confirmed by independent live DB query** run by the verifier.
- The four UI sections render correctly with conditional-hide guards.
- The `--verify` gate is honest: it hard-fails only on `{}` (dishonest locked state) and exits 0 when zero `{}` rows exist.
- The 85 succession_role NULL rows, 8 permaculture_uses NULL rows, and 1 propagation_methods NULL row are semantically honest per D-20 — re-targetable on future enrichment runs, documented, and acceptable.

The two human verification items are about production deployment CI (standard practice, not a gap) and a known test fragility risk (WR-02) that is not blocking today.

**Remaining open items (non-blocking):**

- **WR-01 (harvest_months casing):** `validArr` writes Claude's raw casing rather than canonical MONTH_OPTIONS casing. The calendar sort at page.tsx:223 is case-sensitive (`MONTH_OPTIONS.indexOf(a)`), so off-casing months sort to the front. CSS `capitalize` hides the visual symptom. This is a correctness bug for harvest month display order but does not affect the phase goal. Address in a subsequent fix.
- **WR-04 (verify partition invariant):** verify() does not assert `okCount + emptyCount + nullCount === total`. A malformed row (neither NULL, nor `{}`, nor valid data) would be counted as OK. Low likelihood; address in a subsequent hardening pass.

---

_Verified: 2026-05-19_
_Verifier: Claude (gsd-verifier)_
_Re-verification: Yes — initial verification 2026-05-18 found gaps_found; this re-verification confirms gap closure after plan 02-04 (D-20)_
