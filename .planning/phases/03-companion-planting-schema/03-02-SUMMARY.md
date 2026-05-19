---
phase: 03-companion-planting-schema
plan: "02"
subsystem: database schema + seed data
tags: [migrations, plant-relationships, companion-planting, seed, rls]
dependency_graph:
  requires:
    - PlantRelationship type contract (lib/types.ts, Plan 01)
    - Failing verification harness (scripts/verify-relationships.ts, Plan 01)
    - Confirmed-present pair list (03-SEED-MANIFEST.md, Plan 01)
  provides:
    - plant_relationships table (live Supabase, RLS public-SELECT-only)
    - 15 curated directed companion-planting relationship rows
    - GREEN verification harness (success criterion #3 proven)
  affects:
    - supabase/migrations/
    - live Supabase plant_relationships table
tech_stack:
  added: []
  patterns:
    - Directed subject->object relationship DDL with named UNIQUE triple + named self-ref CHECK (RESEARCH.md Pattern 1)
    - Fail-loud pg_temp.resolve_plant + SELECT id INTO STRICT seed (RESEARCH.md Pattern 2)
key_files:
  created:
    - supabase/migrations/20260519084146_create_plant_relationships_table.sql
    - supabase/migrations/20260519084147_seed_plant_relationships.sql
  modified: []
decisions:
  - "D-01..D-08 locked schema applied verbatim; directed pairs, no is_reciprocal, named constraints, ON DELETE CASCADE x2"
  - "Seed migration version bumped 20260519084146 -> 20260519084147 to resolve a schema_migrations PK collision with the create-table migration (deviation, see below)"
metrics:
  duration: ~7m (resume + fix)
  completed: 2026-05-19
  tasks: 3
  files: 2
---

# Phase 03 Plan 02: Plant Relationships Schema + Curated Seed Summary

Applied the `plant_relationships` DDL and the 15-pair fail-loud curated seed to live Supabase, turning the previously-RED verification harness GREEN and proving all three phase success criteria against real rows.

## What Was Built

- **`supabase/migrations/20260519084146_create_plant_relationships_table.sql`** — `plant_relationships` table per D-01..D-08: UUID PK, two `ON DELETE CASCADE` FKs to `plants(id)`, scalar CHECK-enum `relationship_type` (`HELPS`/`AVOIDS`) and `confidence` (`verified`/`traditional`/`anecdotal`), nullable `mechanism`, named `plant_relationships_unique_triple` UNIQUE and `plant_relationships_no_self_ref` CHECK, `object_plant_id` index, RLS enabled with a single public `FOR SELECT USING (true)` policy and NO write policy. Already applied remotely before this session (recorded at version `20260519084146`).
- **`supabase/migrations/20260519084147_seed_plant_relationships.sql`** — fail-loud `pg_temp.resolve_plant` helper (`SELECT id INTO STRICT` with `NO_DATA_FOUND`/`TOO_MANY_ROWS` RAISE handlers, D-05) seeding the 15 curated SEED-MANIFEST pairs in a single transactional `DO` block: 12 HELPS + 3 AVOIDS, confidence coverage verified=5 / traditional=7 / anecdotal=3 (D-04, D-06). Applied this session.

## Verification Results

- `supabase db push`: seed migration `20260519084147` applied cleanly; create-table `20260519084146` skipped (already applied). No D-05 RAISE — all 15 manifest plants resolved uniquely against the live catalog.
- `supabase migration list`: both `20260519084146` (create-table) and `20260519084147` (seed) show Local + Remote applied; no orphaned local-only rows remain.
- `npm run verify-relationships`: exit 0 — `✓ 6 tomato relationships, all fields populated, D-06 coverage met.` (success criterion #3 proven end-to-end).
- `npm run build`: exit 0 (success criterion #2 re-confirmed with the real query path).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Seed migration shared a version with the create-table migration, colliding on the `schema_migrations` primary key**
- **Found during:** Task 2 (`supabase db push`, surfaced via human-run checkpoint)
- **Issue:** Task 1 authored both migration files with the identical version timestamp `20260519084146`. Supabase keys `supabase_migrations.schema_migrations` by `version` (PK). The create-table migration applied and recorded `version=20260519084146` remotely; the seed migration then failed with `duplicate key value violates unique constraint "schema_migrations_pkey" (SQLSTATE 23505) Key (version)=(20260519084146) already exists`. Each migration runs in its own transaction, so the seed SQL fully rolled back — zero rows inserted, table created but empty.
- **Fix:** `git mv supabase/migrations/20260519084146_seed_plant_relationships.sql supabase/migrations/20260519084147_seed_plant_relationships.sql` — a unique, strictly-later version not present in `supabase migration list`. The already-applied create-table migration was left untouched (renaming a remotely-recorded migration would orphan it). The seed SQL body was NOT modified — the D-05 `INTO STRICT` guard and the 15 curated pairs were correct; only the version collision was the defect.
- **Files modified:** `supabase/migrations/20260519084147_seed_plant_relationships.sql` (rename only, 0 content lines changed)
- **Commit:** `bca132b`
- **Re-push outcome:** create-table skipped (already applied), seed applied cleanly, no D-05 RAISE, harness GREEN.

## Known Stubs

None — the seed inserts 15 real curated relationship rows; no placeholder/empty-value patterns introduced.

## Threat Flags

None — no new security surface beyond the planned RLS-protected table (T-03-04 mitigated: RLS enabled, SELECT-only, no write policy).

## Self-Check: PASSED

- `supabase/migrations/20260519084146_create_plant_relationships_table.sql` — FOUND
- `supabase/migrations/20260519084147_seed_plant_relationships.sql` — FOUND
- Commit `18ef0f2` (Task 1 author) — FOUND
- Commit `bca132b` (version-collision fix) — FOUND
- `supabase migration list`: both versions Local+Remote applied — CONFIRMED
- `npm run verify-relationships` exit 0 — CONFIRMED
- `npm run build` exit 0 — CONFIRMED
