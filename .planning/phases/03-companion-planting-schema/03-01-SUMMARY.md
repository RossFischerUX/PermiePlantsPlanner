---
phase: 03-companion-planting-schema
plan: "01"
subsystem: types + tooling
tags: [types, verification, companion-planting, catalog-resolution]
dependency_graph:
  requires: []
  provides:
    - PlantRelationship type contract (lib/types.ts)
    - Failing verification harness (scripts/verify-relationships.ts)
    - Confirmed-present pair list (03-SEED-MANIFEST.md)
  affects:
    - lib/types.ts
    - scripts/verify-relationships.ts
    - package.json
    - .planning/phases/03-companion-planting-schema/03-SEED-MANIFEST.md
tech_stack:
  added: []
  patterns:
    - PlantRelationship/RelationshipType/RelationshipConfidence string-union + interface (lib/types.ts style)
    - Service-role tsx verification script scaffold (backfill-usda-zones.ts pattern)
key_files:
  created:
    - scripts/verify-relationships.ts
    - .planning/phases/03-companion-planting-schema/03-SEED-MANIFEST.md
  modified:
    - lib/types.ts
    - package.json
decisions:
  - "Probe plant for verify script is tomato (confirmed present via exact common_name ILIKE match)"
  - "Three Sisters (corn/bean/squash) and basil absent from catalog — substituted with nasturtium, chives, comfrey-apple guild"
  - "15 directed pairs curated from 15 confirmed-present species; D-06 coverage met (verified/traditional/anecdotal all used)"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-19"
  tasks: 2
  files: 4
---

# Phase 3 Plan 01: Type Contract, Verification Harness, and Seed Manifest Summary

**One-liner:** PlantRelationship TS type contract (RelationshipType/RelationshipConfidence unions) + failing D-06 honest-gate verify script + 15-pair hand-curated SEED-MANIFEST resolved against live production catalog.

## What Was Built

### Task 1: PlantRelationship types + failing verification harness

`lib/types.ts` — appended three new exports after `PlantListItem`, mirroring the existing single-line union + 2-space interface conventions (no semicolons, `string | null` for nullable):

- `export type RelationshipType = 'HELPS' | 'AVOIDS'`
- `export type RelationshipConfidence = 'verified' | 'traditional' | 'anecdotal'`
- `export interface PlantRelationship` with `id`, `subject_plant_id`, `object_plant_id`, `relationship_type: RelationshipType`, `confidence: RelationshipConfidence`, `mechanism: string | null` (D-08), `created_at: string`. No optional joined `subject_plant?`/`object_plant?` fields — Phase 3 has no UI consumer.

`scripts/verify-relationships.ts` — scaffolded from `backfill-usda-zones.ts` (shebang, JSDoc header, `SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY!` fallback, `if (!SERVICE_ROLE_KEY) throw`). Implements D-06 honest-gate assertions: resolves probe plant (tomato) via `.ilike('common_name','tomato').single()`, fetches all relationships via `.or(subject_plant_id.eq.${id},object_plant_id.eq.${id}).returns<PlantRelationship[]>()`, accumulates failures for row count, HELPS/AVOIDS presence, field population, and empty mechanism checks, plus a global confidence-coverage query. Exits 1 on any failure.

`package.json` — added `"verify-relationships": "tsx scripts/verify-relationships.ts"` after `dedupe-plants`.

**RED state confirmed:** `npx tsx scripts/verify-relationships.ts` exits 1 — the `plant_relationships` table does not yet exist, so the harness fails loud as expected.

### Task 2: A1 catalog resolution + SEED-MANIFEST

Queried the live production `plants` catalog (1455 rows, service-role via `.env.local`) for 20 candidate classic companion species. Results:

- **Present (15):** tomato, eastern black walnut, common comfrey, garden nasturtium, Mexican Marigold, Bronze Fennel, German Chamomile, Yarrow, Borage, Lavender, Rosemary, European black elderberry, apple, Chives, spearmint
- **Absent (5):** basil, corn, bean/Phaseolus vulgaris, squash, garlic

`.planning/phases/03-companion-planting-schema/03-SEED-MANIFEST.md` created with:
- Catalog resolution table for all 20 candidates
- 15 directed pairs drawn exclusively from confirmed-present species
- D-06 coverage verification table
- Exact resolve strings for Plan 02's seed migration (safe for `INTO STRICT`)
- Substitutions section documenting absent species replacements
- A1 risk resolution statement

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 1 | 9572cae | feat(03-01): add PlantRelationship types and failing verification harness |
| Task 2 | accfaa9 | docs(03-01): add seed manifest with D-06-satisfying pair list from confirmed-present plants |

## Verification Results

| Check | Result |
|-------|--------|
| `npm run build` exits 0 (TS strict) | PASS |
| `export interface PlantRelationship` in lib/types.ts | PASS |
| `mechanism: string | null` (not optional) | PASS |
| `relationship_type` and `confidence` non-optional fields | PASS |
| `import type { PlantRelationship }` in verify script | PASS |
| `.returns<PlantRelationship[]>()` typed query | PASS |
| No `as any` in verify script | PASS |
| `process.exit(1)` in verify script | PASS |
| `"verify-relationships"` in package.json | PASS |
| `npx tsx scripts/verify-relationships.ts` exits 1 (RED) | PASS |
| 03-SEED-MANIFEST.md exists | PASS |
| Manifest has HELPS, AVOIDS, verified, traditional, anecdotal | PASS |
| No `## BLOCKER` in manifest | PASS |
| Service-role key literal not in any committed file | PASS (JSDoc `...` placeholder only) |

## Deviations from Plan

### Substitutions (D-04 scope — expected, not deviations)

**Three Sisters absent:** corn, bean (Phaseolus vulgaris), and squash (Cucurbita pepo) are all absent from the 1455-row iNaturalist-imported catalog. The plan anticipated this via RESEARCH.md A1 and directed substitution. Substituted with:
- nasturtium → tomato HELPS (replaces basil → tomato HELPS)
- chives → tomato HELPS (Allium companion, similar to absent garlic)
- comfrey → apple HELPS + elderberry → comfrey HELPS (replace Three Sisters multi-plant guild)

These are documented in the SEED-MANIFEST `## Substitutions` section as directed by the plan.

All other aspects executed exactly as written.

## Known Stubs

None. The type contract and manifest are complete artifacts; no UI, no placeholder data.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced in this plan (the `plant_relationships` table is Plan 02's work). The verify script uses service-role key from `.env.local` — no new threat surface beyond the existing pattern in all other `scripts/*.ts` files.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| lib/types.ts | FOUND |
| scripts/verify-relationships.ts | FOUND |
| 03-SEED-MANIFEST.md | FOUND |
| 03-01-SUMMARY.md | FOUND |
| Commit 9572cae | FOUND |
| Commit accfaa9 | FOUND |
