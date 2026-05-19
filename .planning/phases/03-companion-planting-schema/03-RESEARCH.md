# Phase 3: Companion Planting Schema - Research

**Researched:** 2026-05-19
**Domain:** Supabase/PostgreSQL schema migration, fail-loud seed data, TypeScript strict domain types
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Relationships are **directed** — `subject_plant_id → object_plant_id`, one row = "subject HELPS/AVOIDS object". Asymmetry modeled honestly; a reciprocal relationship is two rows. No symmetric/canonical-ordering scheme, no `is_reciprocal` flag.
- **D-02:** `UNIQUE(subject_plant_id, object_plant_id, relationship_type)`; `CHECK (subject_plant_id <> object_plant_id)`.
- **D-03:** Both `subject_plant_id` and `object_plant_id` are FKs to `plants(id)` with **`ON DELETE CASCADE`**. Deliberately diverges from `plant_list_items`' bare `REFERENCES plants(id)`.
- **D-04:** Ship a **hand-curated seed migration** (~10–20 well-established classic pairs). Verification fixture, NOT the v2 COMP-04 dataset.
- **D-05:** Plant IDs resolved in the seed via **name subquery** (`ILIKE`). If any referenced plant resolves to zero rows, the migration **must RAISE and fail loudly** — never silently insert nothing.
- **D-06:** Seed must include **≥1 HELPS and ≥1 AVOIDS**, exercise **all three confidence levels** at least once, every row has **non-empty mechanism text**. Verification query targets one well-known plant (e.g. tomato) and asserts multiple rows fully populated.
- **D-07:** `relationship_type` and `confidence` are **scalar single-value columns with Postgres `CHECK (col IN (...))`** (mirrors Phase 2 enum precedent). `relationship_type` ∈ `HELPS | AVOIDS`; `confidence` ∈ `verified | traditional | anecdotal`.
- **D-08:** `relationship_type` **NOT NULL**; `confidence` **NOT NULL with no default**; `mechanism` (text) is **nullable**. `PlantRelationship` type has `mechanism: string | null`.

### Claude's Discretion

- **Query access surface:** type-only — export `PlantRelationship` from `lib/types.ts`, inline `.from('plant_relationships').select(...)`. No `lib/` query-helper this phase.
- **RLS:** `ENABLE ROW LEVEL SECURITY` + public SELECT `USING (true)` (mirror `plants`). No public write policy — writes are service-role migrations/scripts only.
- Exact column names (suggested `subject_plant_id` / `object_plant_id`), timestamped migration filename(s), whether seed is one migration or a paired second migration, `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` + `created_at TIMESTAMPTZ DEFAULT now()` boilerplate — follow `supabase/migrations/` conventions.
- Exact curated pair list and mechanism prose (must satisfy D-06 coverage).

### Deferred Ideas (OUT OF SCOPE)

- COMP-03 — companion section on plant detail pages (v2; a `lib/` query helper may be introduced then).
- COMP-04 — ~100 high-confidence relationships via AI backfill + manual validation (v2).
- `is_reciprocal` flag / symmetric pair modeling — considered and rejected (D-01).
- Additional relationship types beyond HELPS/AVOIDS — out of scope; COMP-01 locks the two-value vocab.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMP-01 | `plant_relationships` table exists: plant pairs with relationship type (HELPS/AVOIDS), mechanism text, confidence (verified/traditional/anecdotal) | Migration scaffolding from `20260515024609_create_plant_lists_table.sql`; CHECK-enum idiom from `20260515024612_add_permaculture_fields.sql`; FK + cascade syntax verified against repo conventions |
| COMP-02 | Companion schema integrated into `lib/types.ts`, accessible via Supabase queries | `lib/types.ts` string-union + interface conventions documented; service-role tsx verification script pattern from `scripts/backfill-usda-zones.ts` |
</phase_requirements>

## Summary

This phase is a pure data-layer phase: one (or two) timestamped SQL migration(s) creating `plant_relationships`, plus a `PlantRelationship` type + two string-union types in `lib/types.ts`, plus a repeatable verification of the seed. There is no UI, no `lib/` query helper, no application consumer — the only "consumer" is a direct Supabase query proving success criterion #3.

Every structural element has an exact, copyable precedent in the existing repo. Table creation + RLS enable + public-SELECT policy comes verbatim from `20260515024609_create_plant_lists_table.sql`. The CHECK-enum idiom for `relationship_type`/`confidence` is identical to `forest_garden_layer`/`establishment_difficulty`/`maintenance_level` in the Phase 2 migrations. The string-union-as-type + `string | null` interface fields are the established `lib/types.ts` style (`Sun`, `ForestGardenLayer`).

The single genuinely non-trivial element is **D-05's fail-loud name-subquery seed**. A naive `INSERT ... SELECT ... WHERE common_name ILIKE '%tomato%'` silently inserts zero rows if the plant is absent — the exact false-positive the honest-gates principle forbids. The robust, idiomatic Postgres pattern is a **PL/pgSQL `DO` block (or `SET LOCAL`-scoped helper function) that resolves each plant name with `SELECT id INTO STRICT`**, which raises `NO_DATA_FOUND` (zero rows) or `TOO_MANY_ROWS` (ambiguous name) and aborts the whole migration transaction. This is preferable to post-insert row-count assertions because it pinpoints *which* plant failed and rejects ambiguous matches too.

**Primary recommendation:** Two migrations. Migration A: `CREATE TABLE plant_relationships` + indexes + RLS (copied from plant_lists shape, cascade per D-03). Migration B: a `DO $$` seed block that resolves each plant name via `SELECT id INTO STRICT v_id FROM plants WHERE common_name ILIKE ... OR latin_name ILIKE ...` and `INSERT`s the curated pairs, raising on any unresolved or ambiguous name. Verify with a one-off `tsx` script using the service-role key (mirrors `scripts/backfill-usda-zones.ts`), not Playwright.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Relationship storage + integrity (FK, UNIQUE, CHECK, cascade) | Database / Storage | — | Constraints are the schema contract; PostgreSQL enforces them, not app code |
| Seed data + fail-loud guard | Database / Storage | — | Migration-time concern; the RAISE happens inside the Postgres transaction |
| `PlantRelationship` / `RelationshipType` / `RelationshipConfidence` types | API / Backend (shared types) | — | `lib/types.ts` is the shared domain-type module consumed by future RSC/server queries |
| Success-criterion-3 verification query | Tooling (tsx script, service-role) | — | No UI surface this phase; Playwright targets production and cannot reach an undeployed local migration |

**Key correctness note:** No browser/frontend tier is involved in Phase 3. Any plan task that proposes UI, a React component, a `lib/` query helper, or a Playwright test for this phase is mis-tiered and contradicts locked scope (COMP-03/COMP-04 are v2).

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL (Supabase hosted) | 17 (`config.toml` `major_version = 17`) | `plant_relationships` table, constraints, PL/pgSQL seed guard | Already the project DB; `gen_random_uuid()` is built-in in PG13+ (no `pgcrypto` extension needed) [VERIFIED: config.toml] |
| Supabase CLI | (repo uses `supabase db push`) | Apply timestamped migrations | Established workflow per CLAUDE.md [CITED: CLAUDE.md] |
| `@supabase/supabase-js` | 2.105.4 | Verification query via service-role client in a tsx script | Already a dependency; identical usage in `scripts/backfill-usda-zones.ts` [VERIFIED: package.json] |
| `tsx` | 4.22.0 | Run the one-off verification script (TS, no build) | Established `scripts/` runner; excluded from Next.js TS build [VERIFIED: package.json] |
| `dotenv` | 17.4.2 | Load `.env.local` (service-role key) inside the script | Same pattern as every `scripts/*.ts` file [VERIFIED: package.json] |
| TypeScript | 5.x (strict) | `lib/types.ts` additions | Project standard; no `any` per CLAUDE.md [CITED: CLAUDE.md] |

**No new packages required.** This phase adds zero dependencies — the Package Legitimacy Audit is therefore N/A (see below).

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Two migrations (schema + seed) | Single migration (schema + seed in one file) | Single file is acceptable per D's discretion. Two files is recommended: keeps the structural DDL reviewable independently of the long seed `DO` block, and matches the repo's existing split (`..._create_plants_table.sql` vs `..._seed_sample_plants.sql`). |
| `SELECT INTO STRICT` per-plant helper | `INSERT ... SELECT` + post-insert `GET DIAGNOSTICS rowcount` assertion | Row-count assertion catches "zero inserted" but does NOT tell you *which* plant failed and does NOT catch an ambiguous multi-row name match. `INTO STRICT` catches both `NO_DATA_FOUND` and `TOO_MANY_ROWS` and names the failing plant in the RAISE message. Strongly prefer `INTO STRICT`. |
| tsx verification script | Raw `psql`/SQL run in Supabase dashboard | A committed tsx script (`npm run verify-relationships`) is repeatable, reviewable, and CI-able; an ad-hoc dashboard query is not reproducible. Recommend the script. |
| tsx verification script | Playwright E2E test | Playwright targets the **production** URL and there is no UI surface. It cannot verify an undeployed local migration. Wrong tool — do not use. |

## Package Legitimacy Audit

**N/A — this phase installs zero external packages.** All tooling (`@supabase/supabase-js`, `tsx`, `dotenv`, Supabase CLI) is already present in `package.json` / the dev environment. No `npm install` step. No slopcheck run required.

## Architecture Patterns

### System Architecture Diagram

```
                       supabase db push
                              │
        ┌─────────────────────┴─────────────────────┐
        ▼                                             ▼
  Migration A (DDL)                          Migration B (seed, DO block)
  ┌──────────────────┐                       ┌────────────────────────────┐
  │ CREATE TABLE      │                       │ FOR each curated pair:      │
  │  plant_relationships                      │   resolve subject name      │
  │  - id PK uuid     │   FK ON DELETE        │     SELECT id INTO STRICT ──┼──► zero rows? RAISE
  │  - subject_plant_id ──── CASCADE ──┐      │   resolve object name       │    (NO_DATA_FOUND)
  │  - object_plant_id  ──── CASCADE ──┤      │     SELECT id INTO STRICT ──┼──► >1 row? RAISE
  │  - relationship_type CHECK         │      │   INSERT row                │    (TOO_MANY_ROWS)
  │  - confidence CHECK                ▼      │ END LOOP                     │
  │  - mechanism (nullable)      plants(id)   │ (whole tx rolls back on any  │
  │  - created_at     │                       │  RAISE → migration FAILS)    │
  │  UNIQUE(subj,obj,type)                    └──────────────┬─────────────┘
  │  CHECK(subj<>obj) │                                       │
  │  RLS: public SELECT                                       ▼
  └──────────────────┘                          rows in plant_relationships
                                                              │
                                                              ▼
                                          verify-relationships.ts (service-role)
                                          query "tomato" → assert N rows,
                                          every field populated → exit 0/1
```

### Recommended Migration File Layout

```
supabase/migrations/
├── 20260519XXXXXX_create_plant_relationships_table.sql   # DDL + indexes + RLS
└── 20260519XXXXXX_seed_plant_relationships.sql            # DO block fail-loud seed
```

Timestamp must sort **after** `20260518192238_add_functional_data_fields.sql` (the latest). Use a `2026051 9` (or later) prefix. Supabase applies migrations in **filename lexicographic order** — the create migration must lexically precede the seed migration. [VERIFIED: repo migration ordering — every file is `YYYYMMDDHHMMSS_name.sql` and applied in that order]

### Pattern 1: Table creation + RLS (copy from plant_lists)

**What:** Table DDL, then `ENABLE ROW LEVEL SECURITY`, then a public-SELECT policy. No public write policy (writes are service-role only).
**When to use:** The `plant_relationships` DDL migration.
**Example (grounded in repo conventions, cascade per D-03):**
```sql
-- Source: supabase/migrations/20260515024609_create_plant_lists_table.sql (shape)
--         + 20260515024608_create_plants_table.sql (public-read RLS)
CREATE TABLE plant_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_plant_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  object_plant_id  UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('HELPS', 'AVOIDS')),
  confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'traditional', 'anecdotal')),
  mechanism TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT plant_relationships_unique_triple
    UNIQUE (subject_plant_id, object_plant_id, relationship_type),
  CONSTRAINT plant_relationships_no_self_ref
    CHECK (subject_plant_id <> object_plant_id)
);

-- Lookup indexes: both directions are queried (success criterion #3 hits
-- subject_plant_id AND object_plant_id for "tomato"). The UNIQUE constraint
-- already indexes subject_plant_id as a leading column; add object_plant_id.
CREATE INDEX plant_relationships_object_plant_id_idx
  ON plant_relationships (object_plant_id);

ALTER TABLE plant_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Relationships are publicly readable"
  ON plant_relationships FOR SELECT
  USING (true);
```
Notes:
- `confidence` is `NOT NULL` with **no `DEFAULT`** (D-08) — every row must explicitly classify evidence. `mechanism` has no `NOT NULL` (D-08, nullable honest "no documented mechanism").
- `gen_random_uuid()` and `now()` need no extension on PG17 (`gen_random_uuid` is core since PG13). The existing `plants`/`plant_lists` tables already use `gen_random_uuid()` successfully — confirmed precedent. [VERIFIED: 20260515024608/9 migrations use it]
- Named constraints (`CONSTRAINT name ...`) make the UNIQUE/CHECK violations self-describing in error messages and in the v2 AI-backfill failure path.

### Pattern 2: Fail-loud name-subquery seed (D-05) — the critical pattern

**What:** A PL/pgSQL `DO` block. For each curated pair, resolve subject and object plant IDs by name with `SELECT ... INTO STRICT`. `INTO STRICT` raises `NO_DATA_FOUND` if zero rows match and `TOO_MANY_ROWS` if more than one matches — either aborts the migration transaction and rolls back the whole seed.
**When to use:** The seed migration. This is the honest-gate enforcement that D-05 mandates.
**Why `INTO STRICT` over `INSERT...SELECT...WHERE ILIKE`:** A bare `INSERT ... SELECT ... WHERE common_name ILIKE '%X%'` inserts **zero rows silently** when X is absent — the exact false-positive empty-table outcome the honest-gates principle (D-20 / `feedback_honest_gates_no_fabrication`) forbids. `INTO STRICT` converts "plant not found" and "plant name ambiguous" into a hard migration failure that names the offending plant.

**Example (canonical robust pattern):**
```sql
-- Source pattern: PostgreSQL docs §41.5.3 SELECT INTO STRICT (NO_DATA_FOUND /
-- TOO_MANY_ROWS) [CITED: postgresql.org/docs/current/plpgsql-statements.html]
-- Grounded in repo: scripts resolve plants by common_name/latin_name ILIKE.
DO $$
DECLARE
  v_subject UUID;
  v_object  UUID;

  -- Helper: resolve one plant by name or RAISE with the offending name.
  -- (Inlined per-call below; shown here as the logical contract.)
BEGIN
  -- ── Pair 1: Tomato → Basil : HELPS (verified) ──────────────────────────
  BEGIN
    SELECT id INTO STRICT v_subject FROM plants
      WHERE common_name ILIKE 'tomato' OR latin_name ILIKE 'Solanum lycopersicum';
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE EXCEPTION 'Seed aborted: plant "tomato" not found in plants table';
    WHEN TOO_MANY_ROWS THEN
      RAISE EXCEPTION 'Seed aborted: plant name "tomato" matched multiple rows — disambiguate';
  END;
  BEGIN
    SELECT id INTO STRICT v_object FROM plants
      WHERE common_name ILIKE 'basil' OR latin_name ILIKE 'Ocimum basilicum';
  EXCEPTION
    WHEN NO_DATA_FOUND THEN
      RAISE EXCEPTION 'Seed aborted: plant "basil" not found in plants table';
    WHEN TOO_MANY_ROWS THEN
      RAISE EXCEPTION 'Seed aborted: plant name "basil" matched multiple rows — disambiguate';
  END;
  INSERT INTO plant_relationships
    (subject_plant_id, object_plant_id, relationship_type, confidence, mechanism)
  VALUES
    (v_subject, v_object, 'HELPS', 'traditional',
     'Basil is widely reported to repel thrips and tomato hornworm moths and is a classic interplanting companion for tomato.');

  -- ── Pair 2: Black Walnut → Tomato : AVOIDS (verified) ──────────────────
  -- ...repeat the resolve-or-RAISE + INSERT block per curated pair...
END $$;
```

**Recommended refactor to cut repetition (still 100% fail-loud):** define a transient PL/pgSQL helper function inside the migration so each pair is one line. This keeps the seed readable at ~15 pairs:
```sql
CREATE OR REPLACE FUNCTION pg_temp.resolve_plant(p_name TEXT, p_latin TEXT)
RETURNS UUID LANGUAGE plpgsql AS $$
DECLARE v UUID;
BEGIN
  SELECT id INTO STRICT v FROM plants
    WHERE common_name ILIKE p_name OR latin_name ILIKE p_latin;
  RETURN v;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'Seed aborted: plant "%" (%) not found in plants table', p_name, p_latin;
  WHEN TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'Seed aborted: plant "%" (%) matched multiple rows — disambiguate', p_name, p_latin;
END $$;

DO $$
BEGIN
  INSERT INTO plant_relationships
    (subject_plant_id, object_plant_id, relationship_type, confidence, mechanism)
  VALUES
    (pg_temp.resolve_plant('tomato','Solanum lycopersicum'),
     pg_temp.resolve_plant('basil','Ocimum basilicum'),
     'HELPS','traditional','Basil repels thrips and tomato hornworm moths...'),
    (pg_temp.resolve_plant('black walnut','Juglans nigra'),
     pg_temp.resolve_plant('tomato','Solanum lycopersicum'),
     'AVOIDS','verified','Juglans nigra exudes juglone, an allelopathic compound that causes wilt and death in solanaceous plants including tomato.');
  -- ...remaining curated pairs...
END $$;
```
Notes:
- `pg_temp.` schema makes the helper **session-local** and auto-dropped — no cleanup migration, no permanent function pollution. This is the idiomatic "scratch function for one migration" Postgres pattern.
- If any `resolve_plant` call raises, the entire `DO` block and its `INSERT` are rolled back — partial seeds are impossible. Honest gate satisfied.
- Use exact-match `ILIKE 'tomato'` (no `%` wildcards) where possible to avoid `TOO_MANY_ROWS` against a 1455-row catalog with many cultivars; fall back to a more specific latin name if a common name is ambiguous.

### Pattern 3: `lib/types.ts` additions (mirror existing style)

**What:** Two string-union `type` aliases + one `interface`, appended to `lib/types.ts` in the existing style (`Sun`, `ForestGardenLayer` are the precedent).
**Example:**
```typescript
// Source: lib/types.ts existing conventions (Sun, ForestGardenLayer, PlantListItem)
export type RelationshipType = 'HELPS' | 'AVOIDS'
export type RelationshipConfidence = 'verified' | 'traditional' | 'anecdotal'

export interface PlantRelationship {
  id: string
  subject_plant_id: string
  object_plant_id: string
  relationship_type: RelationshipType
  confidence: RelationshipConfidence
  mechanism: string | null   // D-08: nullable honest "no documented mechanism"
  created_at: string
  // optional joined plant rows (mirrors PlantListItem.plant?: Plant) —
  // include only if a verification query selects joined plant data:
  subject_plant?: Plant
  object_plant?: Plant
}
```
Notes:
- `created_at: string` not `Date` — Supabase returns ISO timestamp strings; matches existing `Plant.created_at` / `PlantList.created_at`.
- Existing scalar enums (`establishment_difficulty`, `maintenance_level`) are typed as bare `string | null` in the `Plant` interface, NOT as their union — but the *new* code should use the stricter union type for `relationship_type`/`confidence` since these are new fields with no legacy untyped data. This is consistent with `Sun`/`Water` which ARE typed as unions in `Plant`.
- The optional `subject_plant?`/`object_plant?` fields mirror `PlantListItem.plant?: Plant`. Include them only if the verification query uses a PostgREST embedded join; otherwise omit to keep the type minimal (Phase 3 has no UI consumer).

### Anti-Patterns to Avoid

- **Bare `INSERT ... SELECT ... WHERE ILIKE` for the seed:** silently inserts 0 rows on a missing plant → false-positive empty table. Violates D-05 and the honest-gates principle. Use `INTO STRICT` or the `pg_temp` helper.
- **`is_reciprocal` / symmetric pair ordering:** explicitly rejected (D-01). Two directed rows, no flag.
- **Adding a `lib/` query helper or any UI:** out of scope (COMP-03/04 are v2). Type-only export per D's discretion.
- **`%wildcard%` ILIKE against the 1455-row catalog:** risks `TOO_MANY_ROWS` (e.g. `%tomato%` matches "tomato", "husk tomato", "tree tomato"). Use exact `ILIKE 'tomato'` + a specific latin name; `INTO STRICT` will catch ambiguity loudly, which is good but means you must pick discriminating names up front.
- **Playwright test for verification:** Playwright targets production; migration is local/undeployed. Wrong tier.
- **`DEFAULT` on `confidence`:** D-08 forbids a default — a default could silently mislabel evidence strength.
- **Unnamed UNIQUE/CHECK constraints:** harder-to-read violation messages for the v2 AI backfill. Name them.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Plant not found" detection in seed | Custom row-count comparison logic | PG `SELECT INTO STRICT` (`NO_DATA_FOUND`/`TOO_MANY_ROWS`) | Built-in, atomic with the transaction, names the failing plant, also catches ambiguity for free |
| Transactional rollback on partial seed | Manual cleanup migration | A single `DO $$ ... $$` block | Postgres wraps the block in the migration transaction; any RAISE rolls back everything automatically |
| UUID generation | App-side uuid lib | `gen_random_uuid()` | Core PG13+ function, already used by `plants`/`plant_lists` — no extension |
| Enum vocabulary enforcement | App-layer validation | `CHECK (col IN (...))` | Established Phase 2 precedent; DB rejects out-of-vocab values, protecting the v2 backfill |
| Scratch function lifecycle | Permanent helper + drop migration | `pg_temp.fn_name` | Session-local, auto-dropped, zero cleanup |

**Key insight:** Every hard part of this phase has a built-in Postgres mechanism that is *both* less code *and* more correct than an app-layer equivalent. The fail-loud requirement (D-05) is satisfied by `INTO STRICT` semantics, not by anything you write.

## Runtime State Inventory

> This phase **creates** a new table and seeds it; it does not rename or migrate existing runtime state. Inventory included because D-03's `ON DELETE CASCADE` interacts with existing data and `supabase db push` is a live-DB operation.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | New `plant_relationships` table only. No existing rows are modified. `plants` is read (by name) but not written. | None beyond the seed insert. |
| Live service config | `supabase db push` applies migrations to the hosted Supabase project (production DB — same instance Playwright/dev read). No Supabase dashboard-only config involved. | Migration must be reviewed before push; it touches the live catalog by reference. |
| OS-registered state | None. No cron, no scheduler, no pm2. | None — verified: no scheduler references this phase. |
| Secrets/env vars | Verification script reads `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_SECRET_KEY` + `NEXT_PUBLIC_SUPABASE_URL` from `.env.local` (same vars `scripts/backfill-usda-zones.ts` uses). No new secret. | None — existing vars suffice. |
| Build artifacts | `lib/types.ts` change is consumed by the Next.js TS build (`tsc`/`next build`). New types must compile under strict mode. The verification tsx script is excluded from the Next build (lives in `scripts/`). | Run `npm run build` (or `tsc --noEmit`) after the type edit to confirm strict compilation (COMP-02 success criterion #2). |

**ON DELETE CASCADE interaction with existing data (landmine check):** `plant_relationships` FKs cascade-delete *from* `plants`. This is one-directional: deleting a `plants` row deletes its relationship rows. It does **not** touch `plant_list_items` (which has a bare `REFERENCES plants(id)` with no cascade — divergence is intentional per D-03). There is no cascade path from `plant_relationships` into `plant_list_items` or vice versa. The recent dedupe quick-task (1716→1455 plants, 261 rows deleted) already completed *before* this table exists, so no orphan relationship rows can pre-exist. Safe.

## Common Pitfalls

### Pitfall 1: Silent empty seed (the headline risk)
**What goes wrong:** `INSERT ... SELECT ... WHERE common_name ILIKE '%tomato%'` runs successfully and inserts 0 rows because the catalog has no "tomato" (the catalog is Mediterranean-ornamental-heavy — see `20260515024610_seed_sample_plants.sql`: Ceanothus, Salvia, Lavender... **no vegetables**). Migration "succeeds", table is empty, success criterion #3 silently fails later.
**Why it happens:** `ILIKE` matching zero rows is not an error in plain SQL.
**How to avoid:** `SELECT INTO STRICT` / `pg_temp.resolve_plant` per D-05. **Before planning the curated list, the plan MUST include a task to verify the chosen seed plant names actually exist in the production catalog** — query `plants` for each intended common/latin name first. The sample seed migration contains zero food/vegetable plants; production has ~1455 rows from iNaturalist imports which *may or may not* include "Tomato"/"Basil"/"Black Walnut". This is the single biggest schedule risk: the curated list must be drawn from plants that are actually present, or the migration will (correctly, per D-05) hard-fail.
**Warning signs:** Curated pair list written before confirming the names resolve against the live `plants` table.

### Pitfall 2: `TOO_MANY_ROWS` from ambiguous names
**What goes wrong:** `ILIKE 'corn'` or `%walnut%` matches multiple catalog rows (cultivars, subspecies, common-name collisions across 1455 rows) → `INTO STRICT` raises `TOO_MANY_ROWS` and the migration fails.
**Why it happens:** Common names are not unique in `plants` (no UNIQUE on `common_name`; the dedupe task collapsed exact dupes but near-dupes/cultivars remain).
**How to avoid:** Use the most specific discriminator available — exact `common_name ILIKE 'tomato'` plus a precise `latin_name ILIKE 'Solanum lycopersicum'`. Resolve ambiguity at curation time by querying the catalog and picking exact strings. The `RAISE` message must echo the plant name so the failure is actionable.
**Warning signs:** Wildcard `%...%` patterns in the seed; common names that are genus-level (e.g. "Walnut", "Corn").

### Pitfall 3: Migration filename sorts before the create migration
**What goes wrong:** Seed migration timestamped earlier than the create migration → Supabase runs the seed first → "relation plant_relationships does not exist".
**Why it happens:** Supabase applies migrations in lexicographic filename order.
**How to avoid:** Generate both timestamps in order; create-table file must lexically precede the seed file. Both must sort after `20260518192238`. Easiest: `supabase migration new create_plant_relationships_table` then `supabase migration new seed_plant_relationships` (CLI assigns monotonic timestamps).
**Warning signs:** Hand-edited timestamps.

### Pitfall 4: TS strict — union vs. `string | null` inconsistency
**What goes wrong:** A verification query selects rows and assigns `relationship_type` (typed `string` by `supabase-js` generic inference) into a `RelationshipType`-typed field → TS strict error, or developer reaches for `any` (forbidden by CLAUDE.md).
**Why it happens:** `supabase-js` without generated DB types returns `any`/loose types; narrowing to the union needs an explicit cast or a typed `.returns<PlantRelationship[]>()`.
**How to avoid:** In the verification script, type the result explicitly: `const { data } = await supabase.from('plant_relationships').select('*').returns<PlantRelationship[]>()`. This is exactly how `scripts/backfill-usda-zones.ts` does it (`const plants = (data ?? []) as PlantRow[]`). No `any`.
**Warning signs:** `as any`, untyped `data` destructuring in the script.

### Pitfall 5: `supabase db push` against production
**What goes wrong:** `supabase db push` applies to the **hosted** project (the live production DB Playwright and dev both read). A broken seed migration that partially applies, or an over-broad cascade, affects production.
**Why it happens:** This project has no separate staging DB; local dev reads live Supabase (per CLAUDE.md testing notes).
**How to avoid:** The `DO $$` block is fully transactional — a RAISE rolls back the whole seed, so a *failed* seed leaves no partial rows (safe). The structural migration only `CREATE`s a new table (additive, non-destructive — cannot harm existing `plants`/`lists` data). Recommend: review the SQL, confirm seed names resolve against the live catalog first (Pitfall 1), then push. The cascade only deletes relationship rows when a plant is deleted — it never deletes plants or list items.
**Warning signs:** Pushing the seed without first confirming the curated plant names exist in production `plants`.

## Code Examples

### Verification script (success criterion #3) — recommended concrete approach

```typescript
// scripts/verify-relationships.ts  — run via: npx tsx scripts/verify-relationships.ts
// Pattern source: scripts/backfill-usda-zones.ts (service-role client + dotenv)
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import type { PlantRelationship } from '../lib/types'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  // 1. Resolve the well-known probe plant (tomato) by name.
  const { data: tomato, error: tErr } = await supabase
    .from('plants')
    .select('id, common_name')
    .ilike('common_name', 'tomato')
    .single()
  if (tErr || !tomato) throw new Error(`Probe plant "tomato" not found: ${tErr?.message}`)

  // 2. Fetch every relationship where tomato is subject OR object.
  const { data, error } = await supabase
    .from('plant_relationships')
    .select('*')
    .or(`subject_plant_id.eq.${tomato.id},object_plant_id.eq.${tomato.id}`)
    .returns<PlantRelationship[]>()
  if (error) throw new Error(`Query failed: ${error.message}`)

  const rows = data ?? []
  // 3. Honest-gate assertions (mirror D-06 coverage requirements).
  const fails: string[] = []
  if (rows.length < 2) fails.push(`expected ≥2 tomato relationships, got ${rows.length}`)
  if (!rows.some(r => r.relationship_type === 'HELPS')) fails.push('no HELPS row for tomato')
  if (!rows.some(r => r.relationship_type === 'AVOIDS')) fails.push('no AVOIDS row for tomato')
  for (const r of rows) {
    if (!r.subject_plant_id || !r.object_plant_id) fails.push(`row ${r.id}: missing plant id`)
    if (!r.relationship_type) fails.push(`row ${r.id}: missing relationship_type`)
    if (!r.confidence) fails.push(`row ${r.id}: missing confidence`)
    if (r.mechanism !== null && r.mechanism.trim() === '')
      fails.push(`row ${r.id}: empty (non-null) mechanism`)
  }
  // D-06: all three confidence levels appear somewhere in the full seed (global check)
  const { data: allConf } = await supabase
    .from('plant_relationships').select('confidence').returns<{ confidence: string }[]>()
  const levels = new Set((allConf ?? []).map(r => r.confidence))
  for (const lvl of ['verified', 'traditional', 'anecdotal'])
    if (!levels.has(lvl)) fails.push(`confidence level "${lvl}" never used in seed`)

  if (fails.length) {
    console.error('VERIFICATION FAILED:')
    fails.forEach(f => console.error('  ✗ ' + f))
    process.exit(1)
  }
  console.log(`✓ ${rows.length} tomato relationships, all fields populated, D-06 coverage met.`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
```
Add an optional `package.json` script: `"verify-relationships": "tsx scripts/verify-relationships.ts"` (mirrors the existing backfill/dedupe script entries). Note: `.or()` here returns a small filtered set well under the 1000-row PostgREST cap (~15-pair seed), so no `.range()` pagination is needed for this query — but the script's global `confidence`-coverage `select` is also tiny. No pagination concern at seed scale; document the cap awareness anyway.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pgcrypto` extension for `gen_random_uuid()` | Core function (no extension) | PostgreSQL 13+ | PG17 here — no `CREATE EXTENSION` needed; existing tables confirm this works |
| Many-row symmetric pair tables with ordering tricks | Directed rows, two rows for reciprocal | D-01 decision | Simpler schema, honest asymmetry; no canonicalization logic |

**Deprecated/outdated:** None relevant. No deprecated APIs in scope.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The production `plants` catalog contains rows resolvable as "Tomato", "Basil", "Black Walnut", "Corn", "Beans", "Squash" (the classic companion species) | Pitfalls 1/2, seed design | **HIGH.** The sample seed migration has zero vegetables/food crops; production is iNaturalist-imported and may lack common vegetable garden species. If absent, D-05's fail-loud guard will (correctly) abort the migration. The plan **must** include an early task that queries the live `plants` table for each intended seed species and selects the curated list from confirmed-present plants only. This is the top planning risk and is unverifiable from the repo alone — requires a live DB query at plan/execution time. |
| A2 | `supabase db push` wraps each migration file in a transaction such that a `RAISE` inside a `DO` block rolls back the entire seed file | Pitfall 5, Don't Hand-Roll | LOW. Standard Supabase/Postgres migration behavior; a `DO` block + RAISE aborts the statement and, within a single migration's transaction, the file. If a plan wants belt-and-suspenders, wrap the seed body explicitly — but default Supabase behavior is per-file transactional. |
| A3 | `npm run build` / `tsc --noEmit` is the right gate for "types compile under strict" (success criterion #2) since there is no jest/unit layer | Runtime State Inventory, Validation Architecture | LOW. CLAUDE.md confirms Playwright-only, TS strict, `next lint`. `next build` runs `tsc`. |

**If a curated species turns out to be absent (A1):** substitute with a companion pair whose species ARE present, or (out-of-scope-adjacent) the plan may need a tiny preliminary `INSERT` of the missing companion plants into `plants` — flag this as a decision for the planner; do NOT silently weaken D-05.

## Open Questions

1. **Does the production `plants` catalog contain the classic companion species (tomato/basil/walnut/corn/beans/squash)?**
   - What we know: the *sample* seed migration (`20260515024610`) has only Mediterranean ornamentals — no vegetables. Production has ~1455 iNaturalist-imported rows.
   - What's unclear: whether common garden/food companions are present under resolvable names.
   - Recommendation: Plan's first task = query live `plants` for each candidate species; build the curated D-04 list exclusively from confirmed-present plants. If key species are missing, surface as an explicit planner decision (substitute pairs vs. add plants) — never weaken the D-05 fail-loud guard.

2. **One migration or two?**
   - What we know: D's discretion; repo precedent splits create (`...024608`) from seed (`...024610`).
   - Recommendation: Two files (DDL, then seed). Cleaner review of the ~15-pair `DO` block separate from the table contract. Either is acceptable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI (`supabase db push`) | Applying migrations | Assumed (project uses it per CLAUDE.md) | — | Apply SQL via Supabase dashboard SQL editor |
| `tsx` | Verification script | ✓ (devDependency) | 4.22.0 | `ts-node` (not installed — don't) |
| `@supabase/supabase-js` | Verification script | ✓ (dependency) | 2.105.4 | — |
| `.env.local` with service-role key | Verification script | Assumed present (every `scripts/*.ts` relies on it) | — | None — script cannot run without it |
| Live Supabase project | `db push` + verification | Assumed (production project) | PG17 | None — this IS the target |

**Missing dependencies with no fallback:** None confirmed missing. Service-role key presence is assumed (used by all existing scripts).

## Validation Architecture

> `workflow.nyquist_validation` — `.planning/config.json` not inspected for an explicit `false`; section included by default. Note: this project has **no jest/unit test layer** (Playwright E2E only, targets production). The "test" for this data-only phase is a service-role tsx verification script + `tsc` compile + SQL constraint existence — there is no UI to E2E.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None for this phase (no jest; Playwright targets production UI, irrelevant here). Verification = tsx script + `tsc`/`next build` + SQL introspection |
| Config file | none — see Wave 0 |
| Quick run command | `npx tsx scripts/verify-relationships.ts` |
| Full suite command | `npm run build && npx tsx scripts/verify-relationships.ts` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMP-01 (criterion 1) | `plant_relationships` table exists with pair IDs, type (HELPS/AVOIDS), mechanism, confidence; UNIQUE + self-ref CHECK + cascade | schema introspection | SQL: `SELECT ... FROM information_schema.columns WHERE table_name='plant_relationships'` + `\d plant_relationships` (or a tsx introspection query) | ❌ Wave 0 (verify script) |
| COMP-02 (criterion 2) | `lib/types.ts` exports `PlantRelationship` (+ unions); Supabase queries compile under TS strict | compile | `npm run build` (runs `tsc`) — must pass with zero errors, no `any` | ✅ (build already configured) |
| COMP-01/02 (criterion 3) | Direct Supabase query for a known plant returns correct rows, all fields populated, D-06 coverage met | integration (service-role) | `npx tsx scripts/verify-relationships.ts` (exit 0 = pass, 1 = fail; honest-gate assertions inline) | ❌ Wave 0 |
| D-05 enforcement | A missing/ambiguous referenced plant aborts the seed migration | negative / migration | Apply seed against a DB missing a referenced plant → migration must error (manually reasoned; the `INTO STRICT` RAISE is the mechanism). Plan may add a comment-documented manual check rather than an automated negative test. | n/a (design-enforced) |

### Sampling Rate
- **Per task commit:** `npm run build` (type compile) after `lib/types.ts` edit; SQL syntax sanity on the migration.
- **Per wave merge:** `npx tsx scripts/verify-relationships.ts` after `supabase db push`.
- **Phase gate:** Migration applied cleanly + `verify-relationships.ts` exits 0 + `npm run build` green, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `scripts/verify-relationships.ts` — automates success criterion #3 + D-06 coverage assertions (does not exist; create it)
- [ ] (optional) `package.json` script entry `verify-relationships` — mirrors existing backfill/dedupe entries
- [ ] No test framework install needed — verification is a tsx script (tsx already present)
- [ ] Pre-seed task: query live `plants` for each candidate companion species (resolves A1 / Pitfall 1 before the seed is written)

## Security Domain

> `security_enforcement` not explicitly `false` in inspected config; section included. This phase adds reference data with public-read RLS — low security surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface; relationship data is public reference data |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | RLS: `ENABLE ROW LEVEL SECURITY` + public `SELECT USING (true)`; **no** public INSERT/UPDATE/DELETE policy — writes are service-role migrations only (mirrors `plants`). Matches D's discretion exactly. |
| V5 Input Validation | yes | `CHECK (relationship_type IN (...))` / `CHECK (confidence IN (...))` + FK constraints + UNIQUE + self-ref CHECK enforce data validity at the DB layer (the trust boundary) |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for Supabase/Postgres reference data

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anonymous write to reference table | Tampering | RLS enabled, **no** public write policy — writes only via service-role key (never client-exposed; CLAUDE.md confirms service-role is scripts-only) |
| RLS not enabled (table world-writable by default) | Tampering / Elevation | Explicit `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (copied from `plants`/`plant_lists` precedent) — must not be omitted |
| Out-of-vocabulary enum poisoning the v2 AI backfill | Tampering | `CHECK` constraints reject invalid `relationship_type`/`confidence` at write time |
| Orphan relationship rows after a plant delete | Integrity | `ON DELETE CASCADE` (D-03) — table self-cleans; no app-layer cleanup needed |
| Service-role key leakage | Information Disclosure | Existing convention: service-role key in `.env.local` only, never client-side, scripts excluded from Next build (CLAUDE.md) — no change introduced |

## Sources

### Primary (HIGH confidence)
- Repo migrations — `20260515024608_create_plants_table.sql`, `20260515024609_create_plant_lists_table.sql`, `20260515024610_seed_sample_plants.sql`, `20260515024612_add_permaculture_fields.sql`, `20260518192238_add_functional_data_fields.sql` (FK/RLS/CHECK/seed conventions, migration ordering)
- Repo — `lib/types.ts` (string-union + interface conventions), `scripts/backfill-usda-zones.ts` (service-role client + dotenv + typed-cast pattern), `supabase/config.toml` (PG17, `max_rows = 1000`), `package.json` (deps/scripts), `CLAUDE.md` (RLS expectations, TS strict, Playwright-only, service-role discipline, 1000-row cap)
- `.planning/phases/03-companion-planting-schema/03-CONTEXT.md` (locked decisions D-01–D-08), `.planning/REQUIREMENTS.md` (COMP-01/02 scope, COMP-03/04 v2)

### Secondary (MEDIUM confidence)
- PostgreSQL official docs — PL/pgSQL `SELECT INTO STRICT` semantics (`NO_DATA_FOUND` / `TOO_MANY_ROWS`): https://www.postgresql.org/docs/current/plpgsql-statements.html (canonical fail-loud pattern for D-05)

### Tertiary (LOW confidence)
- None — all structural claims grounded in repo precedent; the one external pattern (`INTO STRICT`) is from official Postgres docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new deps; all tooling verified in `package.json` and existing scripts
- Architecture: HIGH — every structural element has an exact in-repo precedent
- Pitfalls: HIGH — grounded in repo facts (no vegetables in sample seed, 1455-row catalog, lexicographic migration order, production-targeting Playwright)
- Seed-species availability (A1): LOW — unverifiable without a live DB query; flagged as the top planning risk

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (stable — schema/migration conventions are slow-moving; the only volatile fact is live-catalog species presence, which the plan must check at execution time)
