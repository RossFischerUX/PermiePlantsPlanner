# Phase 3: Companion Planting Schema - Context

**Gathered:** 2026-05-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a `plant_relationships` database table and the `PlantRelationship` TypeScript type so companion/antagonist data between plants is structured and query-ready (COMP-01, COMP-02).

Includes a small hand-curated seed of classic, well-established relationships — enough to prove the schema works (success criterion #3), **not** the v2 dataset.

**Explicitly out of scope (v2, not this phase):**
- Companion section on plant detail pages — COMP-03 (v2)
- ~100-relationship AI-backfill enrichment + manual validation pass — COMP-04 (v2)
- Any plant-browser filter or UI surface for relationships

</domain>

<decisions>
## Implementation Decisions

### Pair Directionality Model
- **D-01:** Relationships are **directed**: `subject_plant_id → object_plant_id`, one row asserts "subject HELPS/AVOIDS object". Asymmetry is modeled honestly (e.g., comfrey→apple HELPS does not imply apple→comfrey). A reciprocal relationship is simply two rows. No symmetric/canonical-ordering scheme, no `is_reciprocal` flag.
- **D-02:** Integrity constraints: `UNIQUE(subject_plant_id, object_plant_id, relationship_type)` (the same ordered pair may carry both a HELPS and an AVOIDS row if mechanisms differ, but no duplicate of the same triple); `CHECK (subject_plant_id <> object_plant_id)` (a plant cannot relate to itself).
- **D-03:** Both `subject_plant_id` and `object_plant_id` are FKs to `plants(id)` with **`ON DELETE CASCADE`** — a relationship to a deleted plant is meaningless, so the table self-cleans. (Deliberately diverges from `plant_list_items`' bare `REFERENCES plants(id)` — relationship/junction rows have no standalone value.)

### Seed Data (proves success criterion #3)
- **D-04:** Ship a **hand-curated seed migration** (~10–20 well-established classic companion/antagonist pairs — e.g. Three Sisters corn→beans→squash, tomato↔basil, black walnut→tomato AVOIDS). This is the verification fixture, NOT the v2 COMP-04 dataset.
- **D-05:** Plant IDs are resolved in the seed via **name subquery** (`INSERT ... SELECT ... WHERE common_name/latin_name ILIKE '...'`). If any referenced plant resolves to zero rows, the migration **must RAISE and fail loudly** — it must NOT silently insert nothing. (Honest-gates principle: a missing referenced plant is a visible failure, never a false-pass empty table. See [[feedback_honest_gates_no_fabrication]].)
- **D-06:** Seed composition is a meaningful proof, not a trivial row: must include **≥1 HELPS and ≥1 AVOIDS**, exercise **all three confidence levels** (verified/traditional/anecdotal) at least once, and every seeded row has **non-empty mechanism text**. The verification query targets one well-known plant (e.g. tomato) and asserts multiple rows with every expected field populated.

### Vocabulary & Null Semantics
- **D-07:** `relationship_type` and `confidence` are **scalar single-value columns with Postgres `CHECK (col IN (...))`** — mirrors the Phase 2 `forest_garden_layer` / `establishment_difficulty` / `maintenance_level` enum precedent (D-08/D-10/D-11). DB rejects out-of-vocab values, protecting the v2 AI backfill.
  - `relationship_type` vocabulary: `HELPS | AVOIDS` (locked by COMP-01).
  - `confidence` vocabulary: `verified | traditional | anecdotal` (locked by COMP-01).
- **D-08:** `relationship_type` **NOT NULL**; `confidence` **NOT NULL with no default** (every row must explicitly classify its evidence level — no silent default that could mislabel evidence strength); `mechanism` (text) is **nullable** — an honest "no documented mechanism" state for genuinely anecdotal/folklore pairs (extends the Phase 2 D-20 "NULL is an honest terminal state, never fabricate to satisfy a column" precedent). The `PlantRelationship` type therefore has `mechanism: string | null`.

### Claude's Discretion
- **Query access surface:** type-only — export `PlantRelationship` from `lib/types.ts` and use inline `.from('plant_relationships').select(...)`. No `lib/` query-helper function this phase (Phase 2 added zero query helpers; COMP-03 detail-page consumption is v2 and can introduce a helper then if warranted). User did NOT select this as a discussion area — locked as the consistent default.
- **RLS:** `ALTER TABLE plant_relationships ENABLE ROW LEVEL SECURITY` + public SELECT policy `USING (true)`, mirroring the `plants` table (relationship data is reference data, public-readable). No public INSERT/UPDATE/DELETE policy — writes happen only via service-role migrations/scripts, exactly like enrichment.
- Exact column names (suggested `subject_plant_id` / `object_plant_id`), timestamped migration filename(s), whether seed lives in the schema migration or a paired second migration, `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` + `created_at TIMESTAMPTZ DEFAULT now()` boilerplate — follow existing `supabase/migrations/` conventions.
- Exact curated pair list and mechanism prose for the seed (must satisfy D-06 coverage).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — COMP-01, COMP-02 (the requirements this phase satisfies); confirms COMP-03 (detail UI) and COMP-04 (~100 AI seed set) are v2 — informs the D-04 seed scope boundary.
- `.planning/ROADMAP.md` § Phase 3 — goal and the three success criteria (criterion #3 is the seed-data driver behind D-04/D-05/D-06).

### Existing Schema & Type Patterns
- `lib/types.ts` — `Plant` / `PlantList` / `PlantListItem` interface conventions; `PlantRelationship` is added here (COMP-02). Note the existing scalar-enum-as-string-union style (`Sun`, `ForestGardenLayer`).
- `supabase/migrations/20260515024609_create_plant_lists_table.sql` — canonical FK + RLS pattern (`REFERENCES plants(id)`, `ENABLE ROW LEVEL SECURITY`, public-SELECT `USING (true)`, owner-scoped writes). Mirror the RLS public-read shape; diverge on cascade per D-03.
- `supabase/migrations/20260515024612_add_permaculture_fields.sql` — `CHECK` enum column pattern (single-value vocab enforcement) — apply to `relationship_type` / `confidence` per D-07.
- `supabase/migrations/20260518192238_add_functional_data_fields.sql` — most recent migration; timestamp/style reference for the new migration filename.

### Prior Phase Decisions (carry-forward)
- `.planning/phases/02-functional-data-enrichment/02-CONTEXT.md` — D-08/D-10/D-11 (scalar enums use Postgres `CHECK`) directly justify D-07; **D-20** (`NULL` is an honest, explicitly-reviewed terminal state; the gate hard-fails only on the dishonest fabricated state — never invent data to satisfy a column) is the precedent behind D-05 (fail-loud seed) and D-08 (nullable mechanism).

### Project Conventions
- `CLAUDE.md` § Database — RLS expectations, half-zone note (unrelated but confirms migration discipline); § Code Conventions — TS strict, no `any`.
- `.planning/PROJECT.md` — COMP relationships are an Active requirement; "curated quality over broad coverage" key decision aligns with the small honest seed (D-04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase/migrations/20260515024609_create_plant_lists_table.sql` — copyable scaffolding for table creation + RLS enable + public SELECT policy.
- `lib/types.ts` — append `PlantRelationship` interface alongside existing domain interfaces (same export style).
- Existing scalar-enum string-union pattern in `lib/types.ts` (`Sun`, `Water`, `ForestGardenLayer`) — model `RelationshipType = 'HELPS' | 'AVOIDS'` and `RelationshipConfidence = 'verified' | 'traditional' | 'anecdotal'` the same way.

### Established Patterns
- Migrations: timestamped `supabase/migrations/*.sql`, applied via `supabase db push`; single-value enums use Postgres `CHECK (col IN (...))`; tables `ENABLE ROW LEVEL SECURITY` with explicit policies.
- Reference/catalog data (`plants`) is public-SELECT `USING (true)`; mutations are service-role only (no public write policy).
- Honest-gate verification: a coverage/verification check must fail loudly on missing/dishonest data, never silently pass (Phase 2 `--verify` + D-20 precedent) — applied to the D-05 seed RAISE-on-missing-plant.

### Integration Points
- New migration(s) in `supabase/migrations/` create `plant_relationships` + seed rows; applied via `supabase db push`.
- `lib/types.ts` — add `PlantRelationship` (+ supporting type unions); must compile under TS strict with no `any` (COMP-02).
- No application/UI code consumes this table in Phase 3 — the only "consumer" is the direct Supabase verification query proving criterion #3.

</code_context>

<specifics>
## Specific Ideas

- Directed model: a row reads literally as "`subject` `relationship_type` `object`" — `comfrey → apple : HELPS`, `black walnut → tomato : AVOIDS`.
- Seed should include the Three Sisters guild (corn→beans, beans→corn, squash→corn etc.) as a recognizable multi-row example, plus a classic AVOIDS (black walnut/juglone→tomato) and a tomato↔basil HELPS pair so the verification query on "tomato" returns several rows spanning both relationship types and multiple confidence levels.
- Verification query (criterion #3) should select relationships for a single well-known plant (e.g. tomato) by `subject_plant_id` and/or `object_plant_id` and assert every field (`relationship_type`, `confidence`, `mechanism`, both plant IDs) is populated as expected.

</specifics>

<deferred>
## Deferred Ideas

- COMP-03 — companion section on plant detail pages (HELPS/AVOIDS with mechanism notes). v2, already in REQUIREMENTS.md. A `lib/` query helper may be introduced then.
- COMP-04 — ~100 high-confidence relationships via AI backfill + manual validation pass. v2. Phase 3 deliberately ships only the small hand-curated verification seed (D-04), not this dataset.
- `is_reciprocal` flag / symmetric pair modeling — considered and rejected (D-01); revisit only if v2 data shows reciprocal duplication is a real maintenance burden.
- Additional relationship types beyond HELPS/AVOIDS (e.g. NEUTRAL, ATTRACTS_BENEFICIAL, TRAP_CROP) — out of scope; COMP-01 locks the two-value vocab. Would be a vocab-expansion decision in a future phase.

None — discussion stayed within phase scope (all deferrals above are pre-existing roadmap boundaries or explicitly-rejected alternatives, not scope creep surfaced in this discussion).

</deferred>

---

*Phase: 3-Companion-Planting-Schema*
*Context gathered: 2026-05-19*
