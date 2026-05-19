---
phase: 03-companion-planting-schema
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - lib/types.ts
  - scripts/verify-relationships.ts
  - supabase/migrations/20260519084146_create_plant_relationships_table.sql
  - supabase/migrations/20260519084147_seed_plant_relationships.sql
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the `plant_relationships` companion-planting schema: the TypeScript type
contract (`lib/types.ts`), the service-role verification harness
(`scripts/verify-relationships.ts`), the DDL migration, and the curated fail-loud
seed migration.

The type contract is clean and matches conventions. The DDL is sound (good CHECK
constraints, self-ref guard, unique triple, RLS enabled). The main correctness
risk lives in the seed resolver's `OR` matching logic and the verify script's
brittle probe query and silent error swallowing. One Critical finding concerns
the resolver semantics that can bind a relationship row to the *wrong* plant
without failing loud — directly undermining the D-05 fail-loud guarantee the
phase is built around.

## Critical Issues

### CR-01: `resolve_plant` OR-matching can silently bind a row to the wrong plant

**File:** `supabase/migrations/20260519084147_seed_plant_relationships.sql:11-12`

**Issue:** The resolver is:

```sql
SELECT id INTO STRICT v FROM plants
  WHERE common_name ILIKE p_name OR latin_name ILIKE p_latin;
```

The `STRICT` clause only guarantees *exactly one row* is returned across the
**disjunction**. It does NOT guarantee that the matched row is the plant whose
common_name is `p_name` AND latin_name is `p_latin`. Concretely:

- If no plant has `common_name ILIKE 'tomato'` but some *unrelated* plant has
  `latin_name ILIKE 'Solanum lycopersicum'` (or a near-collision), `STRICT`
  returns that single row and succeeds — silently seeding a relationship against
  a plant that does not match the intended common name.
- More dangerously, if the catalog later drifts so that `common_name ILIKE
  p_name` matches plant A and `latin_name ILIKE p_latin` matches a *different*
  plant B, the query returns 2 rows and raises `TOO_MANY_ROWS` — which here is
  the *correct* failure, but the OR semantics mean the migration's pass/fail is
  governed by accidental cross-name collisions rather than identity. The
  manifest's "verified against live catalog (1455 rows)" claim is a point-in-time
  snapshot; the resolver does not enforce the (common_name, latin_name) pair
  identity it documents.

This defeats the entire premise of D-05 ("fail-loud, no partial/incorrect
inserts"): a row can resolve to the wrong plant and the seed still "succeeds."

**Fix:** Require both name components to identify the same row, and keep STRICT
for fail-loud cardinality:

```sql
SELECT id INTO STRICT v FROM plants
  WHERE common_name ILIKE p_name AND latin_name ILIKE p_latin;
```

If the catalog has rows where only one of the two is reliably populated, instead
pass a single canonical identifier (prefer exact `latin_name`) and match one
column only — but do not OR two independent predicates. Additionally, escape
LIKE metacharacters (see WR-04) or switch to `=` / `lower()` equality since no
manifest string actually needs wildcard semantics.

## Warnings

### WR-01: Verify script swallows the global confidence-query error

**File:** `scripts/verify-relationships.ts:62-66`

**Issue:** The D-06 global coverage check destructures only `data`:

```ts
const { data: allConf } = await supabase
  .from('plant_relationships')
  .select('confidence')
  .returns<{ confidence: string }[]>()
const levels = new Set((allConf ?? []).map(r => r.confidence))
```

The `error` is discarded. If this query fails (RLS change, transient network
error, permission drift), `allConf` is `null`, `levels` is empty, and the
honest-gate will report "confidence level X never used in seed" — a misleading
failure that masks the real cause. Worse, in a different failure mode an empty
result set could be misread as a coverage gap rather than a query fault. Every
other query in this file checks `error` and throws; this one is inconsistent and
breaks the honest-gate contract (T-03-03).

**Fix:**

```ts
const { data: allConf, error: confErr } = await supabase
  .from('plant_relationships')
  .select('confidence')
  .returns<{ confidence: string }[]>()
if (confErr) throw new Error(`Confidence query failed: ${confErr.message}`)
```

### WR-02: `.ilike('common_name', 'tomato').single()` is a brittle probe

**File:** `scripts/verify-relationships.ts:31-36`

**Issue:** `.ilike('common_name', 'tomato')` performs a case-insensitive pattern
match (no wildcards, so effectively case-insensitive equality), then `.single()`
throws if zero or >1 rows match. The seed manifest documents that exactly one
catalog row matches today, but the probe will hard-fail the entire verification
the moment any second tomato cultivar/variant is imported (e.g. "Tomato
'Cherry'") even though the seed itself is perfectly valid. The verification
gate's stability is coupled to unrelated catalog growth.

**Fix:** Resolve by the same canonical key the seed uses (exact latin name) for
stability, or use `.limit(1)` with explicit handling:

```ts
const { data: tomato, error: tErr } = await supabase
  .from('plants')
  .select('id, common_name')
  .ilike('latin_name', 'Solanum lycopersicum')
  .single()
```

At minimum, add a comment explaining the probe is intentionally exact-match and
will fail-loud (which is acceptable for a gate, but should be a documented
decision, not an accident).

### WR-03: Seed migration leaves `pg_temp.resolve_plant` defined for the session

**File:** `supabase/migrations/20260519084147_seed_plant_relationships.sql:7-19`

**Issue:** `CREATE OR REPLACE FUNCTION pg_temp.resolve_plant(...)` creates a
temporary function but never drops it. In a `supabase db push` / migration runner
that executes multiple migration files in a single session/connection, a
leftover `pg_temp` helper named `resolve_plant` can shadow or collide with a
similarly named helper in a later migration, and leaks an implementation detail
into the session namespace. It also makes the migration non-self-contained.

**Fix:** Drop it at the end of the migration:

```sql
DROP FUNCTION pg_temp.resolve_plant(TEXT, TEXT);
```

Place after the `DO $$ ... END $$;` block.

### WR-04: `ILIKE` treats `_` and `%` in plant names as wildcards

**File:** `supabase/migrations/20260519084147_seed_plant_relationships.sql:11-12`

**Issue:** `common_name ILIKE p_name` interprets `%` and `_` in `p_name` /
`p_latin` as LIKE metacharacters. None of the 15 manifest names currently
contain them, so this is latent — but the resolver is a reusable helper and any
future seed row with a name like `Allium x proliferum` (no metachar) is fine,
while something containing `_` (rare in latin names but possible in cultivar
common names) would silently broaden the match and risk `TOO_MANY_ROWS` or a
wrong bind. This compounds CR-01.

**Fix:** Use equality with case folding instead of pattern matching:

```sql
WHERE lower(common_name) = lower(p_name) AND lower(latin_name) = lower(p_latin)
```

(Combine with the CR-01 `AND` fix.)

### WR-05: DDL migration is not re-runnable; no `created_at NOT NULL`

**File:** `supabase/migrations/20260519084146_create_plant_relationships_table.sql:1-8`

**Issue:** Two related robustness gaps:
1. `CREATE TABLE plant_relationships` (no `IF NOT EXISTS`) and the bare
   `CREATE POLICY` / `CREATE INDEX` will error on any re-run or partial-apply
   recovery. The existing project migrations share this style, so this is a
   consistency observation rather than a regression — but the seed migration's
   whole design goal is fail-loud re-run safety, and the paired DDL does not
   match that bar.
2. `created_at TIMESTAMPTZ DEFAULT now()` is nullable. The `PlantRelationship`
   TS interface declares `created_at: string` (non-null, non-optional). A direct
   `INSERT ... (created_at) VALUES (NULL)` would violate the type contract at the
   API boundary with no DB guard.

**Fix:** Add `NOT NULL` to `created_at` (`TIMESTAMPTZ NOT NULL DEFAULT now()`)
to match the non-nullable type. Optionally adopt `CREATE TABLE IF NOT EXISTS` /
`CREATE INDEX IF NOT EXISTS` and guarded policy creation if the project decides
to standardize re-runnable migrations.

## Info

### IN-01: Probe-string coupling between manifest, seed, and verify script is unenforced

**File:** `scripts/verify-relationships.ts:34`

**Issue:** The probe string `'tomato'` is hard-coded in three places (manifest,
seed rows, verify script) with only prose ("MUST match") binding them. A future
manifest edit that changes the probe plant will silently desync the gate.

**Fix:** Add a short comment referencing `03-SEED-MANIFEST.md` as the source of
truth for the probe string, or derive the probe from a shared constant.

### IN-02: Non-ASCII glyphs in console output and SQL prose

**File:** `scripts/verify-relationships.ts:73,76`; `seed ...:30,114`

**Issue:** `✗`, `✓`, `≥`, en-dashes (`–`), and `—` are used in console output
and mechanism prose. These render fine on modern terminals/Postgres but can
mojibake in CI logs with a non-UTF-8 locale. Low risk, cosmetic.

**Fix:** Optional — substitute ASCII (`x`, `OK`, `>=`, `-`) in the script's
console output if CI portability is a concern. Mechanism prose is content and
can stay.

### IN-03: `rows.length < 2` magic number duplicates a D-06 rule

**File:** `scripts/verify-relationships.ts:50`

**Issue:** The `2` encodes the D-06 "probe appears in >=2 rows" requirement as a
bare literal. Acceptable for a small script, but a named constant
(`MIN_PROBE_ROWS = 2`) with a comment citing D-06 would make the gate
self-documenting.

**Fix:** Extract to a named constant referencing the D-06 requirement.

### IN-04: `SUPABASE_URL` non-null assertion without validation

**File:** `scripts/verify-relationships.ts:22`

**Issue:** `process.env.NEXT_PUBLIC_SUPABASE_URL!` is asserted non-null but,
unlike `SERVICE_ROLE_KEY`, is not guarded with an explicit `if (!...) throw`. A
missing URL yields a less actionable failure deep inside `createClient` /
network layer instead of a clear "env var missing" message. The service-role key
gets a clear guard; the URL should too for symmetry.

**Fix:**

```ts
if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing from .env.local')
```

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
