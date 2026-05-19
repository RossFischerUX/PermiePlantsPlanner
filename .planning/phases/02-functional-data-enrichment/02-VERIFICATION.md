---
phase: 02-functional-data-enrichment
verified: 2026-05-18T12:00:00Z
status: gaps_found
score: 4/5 success criteria verified
overrides_applied: 0
gaps:
  - truth: "Running the enrichment pipeline script skips already-populated records and completes without errors; a post-run verification confirms all fields are non-null for the enriched set (Success Criterion 5 / DATA-05)"
    status: failed
    reason: "The --verify gate reports 1716/1716 OK for succession_role and propagation_methods using a .not(f,'is',null) check, but a direct DB query shows 129 plants have succession_role = '{}' (empty array) and 4 have propagation_methods = '{}'. An empty Postgres array is not null, so .not('is',null) counts it as covered. The verify gate is therefore hollow for these two fields — 7.5% of the catalog (129 plants) has zero succession data with no rerun path. The SUMMARY's '1716/1716 OK' claim for succession_role is a false positive masking real data-quality gaps, not evidence of true coverage."
    artifacts:
      - path: "scripts/enrich-functional-data.ts"
        issue: "validArr writes [] when Claude returns all out-of-vocab tags for succession_role/propagation_methods (line 232, 240). verify() checks .not(f,'is',null) which accepts {} as covered (line 317). These two halves disagree. CR-02 from code review is confirmed by live DB query: 129 plants with succession_role={}, 4 with propagation_methods={}."
    missing:
      - "In enrichWithClaude merge block: treat all-invalid array result as null for required fields (succession_role, propagation_methods) — write null instead of [] so the row stays in the OR-of-nulls target for reruns."
      - "In verify(): change .not(f,'is',null) to count rows where succession_role != '{}' and is not null, or add a second check counting empty-array rows. The current gate cannot distinguish 'enriched with data' from 'enriched with empty'."
      - "Re-run enrichment for the 129 succession_role={} plants after fixing the validator to leave null instead of []."
---

# Phase 02: Functional Data Enrichment — Verification Report

**Phase Goal:** Every plant in the database has structured ecological role, forest layer, establishment, and harvest data — readable in the UI and filterable
**Verified:** 2026-05-18
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A plant detail page shows functional role tags drawn from a structured array field | VERIFIED | `permaculture_uses` pills render in Functional Roles section; page.tsx line 151-160 confirmed; 1716-8=1708 plants have non-empty permaculture_uses in DB |
| 2 | A plant detail page shows forest layer classification and succession role | VERIFIED | Forest Layer & Succession section in page.tsx (lines 162-179); InfoCell for forest_garden_layer, pills for succession_role; conditional-hide via `plant.forest_garden_layer \|\| plant.succession_role?.length` |
| 3 | A plant detail page shows propagation methods, establishment difficulty, and maintenance level | VERIFIED | Establishment & Care section (lines 181-208); IIFE pattern with careCells filter-Boolean; InfoCells for establishment_difficulty/maintenance_level/years_to_bearing; pills for propagation_methods; years_to_bearing != null guard present |
| 4 | A plant detail page shows edible parts and approximate harvest months | VERIFIED | Harvest section (lines 210-229); edible_parts pills and calendar-sorted harvest_months pills; conditional-hide via `plant.edible_parts?.length \|\| plant.harvest_months?.length` |
| 5 | Enrichment pipeline skips already-populated records and completes without errors; post-run verification confirms all fields are non-null for the enriched set | FAILED | `--verify` reports 1716/1716 OK for succession_role and propagation_methods — but this is a hollow pass. Direct DB query confirms: **129 plants have succession_role = '{}' (empty array, 7.5% of catalog)** and **4 have propagation_methods = '{}'**. These are not null, so `.not(f,'is',null)` counts them as covered. CR-02 from the code review is confirmed real by live DB evidence. |

**Score:** 4/5 truths verified

### CR-02 Investigation: verify() Green vs. DB Reality

The verifier ran a read-only DB query to resolve CR-02. Results:

| Field | verify() reports | Actual DB state |
|-------|-----------------|-----------------|
| succession_role | 1716/1716 OK | 129 plants = `{}`, 0 = NULL |
| propagation_methods | 1716/1716 OK | 4 plants = `{}`, 0 = NULL |
| permaculture_uses | 1716/1716 OK | 8 plants = `{}`, 0 = NULL |
| edible_parts | typed-presence OK | 876 plants = `{}` (expected/valid per D-19) |
| harvest_months | typed-presence OK | 890 plants = `{}` (expected/valid per D-19) |

The 8 empty permaculture_uses plants are also anomalous: this field is supposed to be always-overwritten (D-01) for every targeted row. Since the targeting OR-of-nulls now returns 0 rows (idempotency achieved), those 8 plants with empty permaculture_uses are permanently stuck — the second run no-op means they will never be re-enriched unless the script is re-run with a manual override.

**Root cause (CR-02):** `validArr` writes `[]` when Claude returns all out-of-vocab tags. `[]` is not null in Postgres, so the OR-of-nulls targeting clause will not re-select these rows. `verify()` uses `.not(f,'is',null)` which accepts `{}` as covered. The two halves of the system disagree about what "populated" means.

**Root cause (CR-01):** `response.content[0]` is accessed without checking the array length (script line 135). An empty `content` array from the Anthropic SDK — possible on max_tokens truncation — would throw TypeError, caught by the outer try/catch, causing the plant to be silently skipped as "no Claude data". The 129 empty-succession plants could be plants where Claude's response was truncated or refused, which then took the null-return path but should have set the field to null rather than []. CR-01 is a contributing factor.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/20260518192238_add_functional_data_fields.sql` | 7-column DDL with CHECK constraints for enums | VERIFIED | All 7 columns present; CHECK for establishment_difficulty/maintenance_level; plain TEXT[] for array columns (no DB CHECK per D-discretion); forest_garden_layer/permaculture_uses not re-added |
| `lib/types.ts` | Plant interface with 7 new fields under strict TS | VERIFIED | All 7 fields present at lines 32-38; exact migration column name match; ForestGardenLayer type unchanged (D-08); compiles strict (npx tsc --noEmit exits 0) |
| `lib/plant-labels.ts` | FUNCTIONAL_ROLE_OPTIONS (16-tag D-02 vocab) + PERM_USE_OPTIONS alias + 5 vocab arrays + FUNCTIONAL_INFO_LABELS | VERIFIED | All exports present; FUNCTIONAL_ROLE_OPTIONS has 16 D-02 tags; PERM_USE_OPTIONS = FUNCTIONAL_ROLE_OPTIONS alias on line 10; SUCCESSION_OPTIONS/ESTABLISHMENT_OPTIONS/MAINTENANCE_OPTIONS/PROPAGATION_OPTIONS/EDIBLE_PART_OPTIONS present; FUNCTIONAL_INFO_LABELS Record with 4 keys |
| `scripts/enrich-functional-data.ts` | Claude Haiku enrichment with two opposite skip paths + --verify branch | VERIFIED (structure) / PARTIAL (data quality) | 370-line script; model = 'claude-haiku-4-5-20251001'; CLAUDE_BATCH_SIZE=10; CLAUDE_BATCH_DELAY_MS=15000; TARGET_FIELDS excludes permaculture_uses and years_to_bearing; paginated OR-of-nulls targeting; --verify branch present; CR-01 unguarded content[0] present; CR-02 validArr writes [] not null confirmed by DB |
| `app/(app)/plants/[id]/page.tsx` | 4 dedicated sections replacing Permaculture section | VERIFIED | 4 sections present (Functional Roles, Forest Layer & Succession, Establishment & Care, Harvest); no Permaculture h2 heading; byte-identical pill markup; InfoCell reused; MONTH_OPTIONS imported for calendar sort; FUNCTIONAL_INFO_LABELS imported; years_to_bearing != null guard (Pitfall 4) present; build/tsc/lint clean |
| `tests/plants.spec.ts` | Playwright assertions for 4 new sections + conditional-hide | VERIFIED (local) / HUMAN NEEDED (production) | 5 new tests added in Plant detail page — public describe block; Permaculture regression test; Functional Roles pill test; Forest Layer section test (conditionally guarded per IN-04); Establishment & Care test; Harvest conditional-hide test. Tests validated against local dev server with live Supabase data. Production CI is deploy-gated. |
| `package.json` | enrich-functional-data npm script | VERIFIED | "enrich-functional-data": "tsx scripts/enrich-functional-data.ts" present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `lib/types.ts Plant interface` | migration column names | exact name match | VERIFIED | All 7 field names match migration columns exactly |
| `app/(app)/plants/FilterControls.tsx` | `lib/plant-labels.ts PERM_USE_OPTIONS` | import at line 7 | VERIFIED | FilterControls.tsx line 7 imports PERM_USE_OPTIONS; still resolves to alias of FUNCTIONAL_ROLE_OPTIONS; queryBuilder.ts line 20 uses it for permaculture_uses filter |
| `scripts/enrich-functional-data.ts` | `lib/plant-labels.ts vocab constants` | import at lines 27-35 | VERIFIED | Imports FUNCTIONAL_ROLE_OPTIONS, SUCCESSION_OPTIONS, ESTABLISHMENT_OPTIONS, MAINTENANCE_OPTIONS, PROPAGATION_OPTIONS, EDIBLE_PART_OPTIONS, MONTH_OPTIONS |
| `scripts/enrich-functional-data.ts targeting query` | `plants table` | .or() OR-of-nulls on 7 new fields | VERIFIED | TARGET_FIELDS = 6 fields (succession_role, establishment_difficulty, maintenance_level, propagation_methods, edible_parts, harvest_months); years_to_bearing correctly excluded per Deviation 2 |
| `app/(app)/plants/[id]/page.tsx sections` | `plant.<new fields>` | RSC .select('*') | VERIFIED | .select('*') unchanged; all 7 new field reads present in section JSX |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `app/(app)/plants/[id]/page.tsx` Functional Roles | `plant.permaculture_uses` | Supabase .select('*') RSC query | Yes — 1708/1716 non-empty; 8 empty | FLOWING (with caveat: 8 plants have empty array) |
| `app/(app)/plants/[id]/page.tsx` Forest Layer & Succession | `plant.forest_garden_layer`, `plant.succession_role` | Supabase .select('*') RSC query | Partial — 129/1716 succession_role = {} | HOLLOW (partial): succession data absent for 7.5% of catalog |
| `app/(app)/plants/[id]/page.tsx` Establishment & Care | `plant.establishment_difficulty`, `plant.maintenance_level`, `plant.propagation_methods` | Supabase .select('*') RSC query | Yes — establishment_difficulty 1716/1716 not-null; maintenance_level 1716/1716; 4/1716 propagation_methods = {} | FLOWING (with caveat: 4 plants have empty propagation_methods) |
| `app/(app)/plants/[id]/page.tsx` Harvest | `plant.edible_parts`, `plant.harvest_months` | Supabase .select('*') RSC query | 840/1716 non-empty edible_parts; 826/1716 non-empty harvest_months | FLOWING (expected — D-19 permits empty arrays for non-edible plants) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript strict build | `npx tsc --noEmit` | exit 0, no errors | PASS |
| Production build | `npm run build` | exit 0, all routes compile | PASS |
| Lint | `npm run lint` | exit 0 (2 pre-existing warnings in unrelated AddToListClient.tsx) | PASS |
| enrich script exists and is importable | `test -f scripts/enrich-functional-data.ts` | exists, 370 lines | PASS |
| verify gate reports hollow green | DB query: count where succession_role = '{}' | 129 rows — verify() would count as OK | FAIL (confirms CR-02) |

### Probe Execution

No probe scripts discovered in `scripts/*/tests/probe-*.sh`. The `--verify` gate (`npm run enrich-functional-data -- --verify`) is the equivalent probe; it exits 0 per SUMMARY but is confirmed hollow by the independent DB query above (see CR-02 finding).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| DATA-01 | 02-01, 02-02, 02-03 | Each plant has functional role tags stored as structured array and filterable | SATISFIED | permaculture_uses populated at 1708/1716 non-empty; PERM_USE_OPTIONS filter sidebar wiring intact; D-04 scope: no new filter UI, existing filter functional with new 16-tag vocab |
| DATA-02 | 02-01, 02-02, 02-03 | Each plant has forest layer and succession role | PARTIAL | forest_garden_layer: pre-existing field, populated; succession_role: 1716 not-null BUT 129 have {} (empty), no real succession data for 7.5% of plants |
| DATA-03 | 02-01, 02-02, 02-03 | Each plant has establishment and care data | SATISFIED | establishment_difficulty, maintenance_level at 1716/1716; propagation_methods 4 empty (minor); years_to_bearing 529/1716 (expected — legitimately null for non-food plants per D-19) |
| DATA-04 | 02-01, 02-02, 02-03 | Each plant has edible parts and harvest months | SATISFIED | D-19: empty arrays valid for non-edible plants; columns present and typed; Harvest section conditionally renders |
| DATA-05 | 02-02 | Enrichment pipeline with skip-if-populated guard and post-run verification | BLOCKED | --verify gate exits 0 but is hollow: 129 plants have succession_role={} which passes .not(f,'is',null) but carries no data. Idempotency is proven (second run no-op) but the no-op now prevents fixing the 129 empty-succession-role plants. Criterion 5's "all fields non-null for the enriched set" is not genuinely satisfied. |

**Note on "filterable" in ROADMAP goal:** The ROADMAP one-liner says "readable in the UI and filterable." D-04 and CONTEXT explicitly scope this as "schema + display + pipeline only — filter UI for role/layer/succession/edible deferred to SRCH-02 (v2)." DATA-01 in REQUIREMENTS.md marks the existing permaculture_uses filter as satisfying filterable for v1. This is an intentional scope boundary, not a missing feature. DATA-02..DATA-04 new fields are schema-ready for future filter UI but no new filter controls were required by this phase.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/enrich-functional-data.ts` | 135 | `response.content[0]` accessed without length check (CR-01) | Warning | Empty content array from Anthropic SDK throws TypeError, caught as skip — silent data loss |
| `scripts/enrich-functional-data.ts` | 232, 240 | `validArr` writes `[]` on all-invalid tags for succession_role/propagation_methods (CR-02) | Blocker | 129 plants permanently stuck with empty succession_role; verify() reports green; no rerun path |
| `app/(app)/plants/[id]/page.tsx` | 318 | Forest Layer test wrapped in `if (hasForestSection > 0)` (IN-04) | Warning | Test passes with 0 assertions if section absent — silent false-green |
| `scripts/enrich-functional-data.ts` | 237-238 | `years_to_bearing` unbounded integer (WR-01) | Warning | Negative/absurd values accepted from Claude; renders as "-1 years" on detail page |

### Human Verification Required

### 1. Production CI — 4 New Detail Page Sections

**Test:** Deploy `main` branch to Vercel, then run `npx playwright test tests/plants.spec.ts --grep "detail"` against the production URL.
**Expected:** All 10 detail-page tests pass green including the 5 new section tests (Functional Roles pill, Forest Layer & Succession, Establishment & Care, Harvest conditional-hide, Permaculture regression).
**Why human:** Playwright config targets production URL. The 02-03 commits (`65f42db`, `bbfb644`) are on `main` locally but not yet deployed to Vercel. Local validation passed (10/10 green against localhost with live Supabase data per 02-03-SUMMARY.md), but production CI requires a Vercel deploy.

### 2. succession_role Empty-Array Scope Assessment

**Test:** Review whether 129 plants with `succession_role = '{}'` represent genuine non-succession species (e.g., lawn grasses, purely ornamental cultivars with no ecological role) or are enrichment failures where Claude returned out-of-vocab tags.
**Expected:** If these are enrichment failures, apply the CR-02 fix (write null instead of [] for required fields when all tags are invalid) and re-run enrichment for the affected rows.
**Why human:** Cannot programmatically distinguish "Claude returned out-of-vocab tags" from "Claude correctly returned [] because the plant has no succession role." A spot-check of 5-10 of the 129 plants (e.g., Agapanthus, Ornithogalum umbellatum, Variegated Croton) against known permaculture knowledge would clarify.

### 3. permaculture_uses 8 Empty-Array Plants

**Test:** Review the 8 plants with `permaculture_uses = '{}'` (e.g., jimsonweed, poison hemlock, Variegated Croton). These were targeted by the OR-of-nulls at some point (they have non-null succession_role), meaning they were enriched but Claude returned all out-of-vocab role tags.
**Expected:** If enrichment is correct (these plants genuinely have no permaculture roles from the 16-tag vocab), the empty array is acceptable. If not, CR-02 fix + re-run would populate them.
**Why human:** These plants (jimsonweed — toxic, poison hemlock — toxic) may legitimately have no permaculture functional roles in the 16-tag vocab. Human permaculture knowledge needed to verify.

### 4. ROADMAP Checkbox Update for 02-03

**Test:** Update ROADMAP.md `[ ] 02-03-PLAN.md` to `[x] 02-03-PLAN.md` and update "Plans: 2/3 plans executed" to "3/3 plans complete" since commits `65f42db`, `bbfb644`, `a0ada68` confirm plan completion.
**Expected:** ROADMAP accurately reflects phase execution state.
**Why human:** ROADMAP update requires human intent confirmation (should phase be marked fully complete given the DATA-05 gap?).

## Gaps Summary

The phase delivers all four display-layer success criteria (SC 1-4) and is substantially complete. The single blocker is **CR-02 confirmed by live DB evidence**: the `--verify` gate's 1716/1716 OK result for `succession_role` is a hollow green. Direct DB query shows 129 plants (7.5% of catalog) have `succession_role = '{}'` — non-null but empty. These plants display no succession data in the Forest Layer & Succession section (the section hides entirely when `succession_role` is empty and `forest_garden_layer` is also null). The verify gate cannot distinguish this from genuine enrichment.

The gap is in the `enrich-functional-data.ts` script: `validArr` writes `[]` rather than `null` when all Claude tags fail validation for `succession_role`/`propagation_methods`. Since `[]` is not null, the OR-of-nulls targeting clause will never re-select these plants, and the second-run no-op behavior (correctly proven) now locks in the empty state permanently.

**SC-5 verdict:** "All fields non-null for the enriched set" is NOT genuinely satisfied. The verify gate reports success but misses empty arrays. This is a data-quality / verification gap, not merely a robustness issue — it directly contradicts the observable truth that SC-5 requires.

**Scope clarification:** The ROADMAP goal says "filterable" — but this is explicitly scoped by D-04 and the CONTEXT document to mean query-ready schema only; no new filter UI controls were planned for Phase 2. The existing `permaculture_uses` filter in the plant browser works with the new 16-tag vocab. This is not a gap.

---

_Verified: 2026-05-18_
_Verifier: Claude (gsd-verifier)_
