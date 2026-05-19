# Phase 3: Companion Planting Schema - Pattern Map

**Mapped:** 2026-05-19
**Files analyzed:** 4 (2 new migrations, 1 modified type file, 1 new script)
**Analogs found:** 4 / 4 (all exact in-repo precedents)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `supabase/migrations/2026051X..._create_plant_relationships_table.sql` (NEW) | migration (DDL) | schema / transform | `supabase/migrations/20260515024609_create_plant_lists_table.sql` (table+FK+RLS shape) + `20260515024612_add_permaculture_fields.sql` (CHECK-enum) | exact (composite) |
| `supabase/migrations/2026051X..._seed_plant_relationships.sql` (NEW) | migration (seed) | batch insert / fail-loud transform | `supabase/migrations/20260515024610_seed_sample_plants.sql` (seed-migration split precedent) + RESEARCH.md `INTO STRICT` pattern | role-match (no in-repo PL/pgSQL fail-loud analog) |
| `lib/types.ts` (MODIFIED — append) | model (shared domain types) | n/a (type decl) | `lib/types.ts` existing `Sun` / `ForestGardenLayer` / `PlantListItem` | exact (same file) |
| `scripts/verify-relationships.ts` (NEW) | utility (verification tooling) | request-response (read query) | `scripts/backfill-usda-zones.ts` | role-match (read-only vs. backfill, same scaffolding) |

## Pattern Assignments

### `..._create_plant_relationships_table.sql` (migration, DDL)

**Analog A — table + FK + RLS shape:** `supabase/migrations/20260515024609_create_plant_lists_table.sql`

**UUID PK + FK ON DELETE CASCADE + RLS enable + public-SELECT policy** (lines 1-24, 38-43):
```sql
CREATE TABLE plant_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  share_id TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 13),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS for plant_lists
ALTER TABLE plant_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lists are readable by share_id (public)"
  ON plant_lists FOR SELECT
  USING (true);
```
Copy verbatim: `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at TIMESTAMPTZ DEFAULT now()`, the `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY "..." FOR SELECT USING (true)` block. **Diverge per D-03:** both plant FKs use `... NOT NULL REFERENCES plants(id) ON DELETE CASCADE` (note `plant_list_items` line 13 uses a *bare* `REFERENCES plants(id)` with no cascade — deliberately NOT the model for relationship rows). **Do NOT copy** the owner-scoped INSERT/UPDATE/DELETE policies (lines 26-36) — Phase 3 has no public write policy (service-role writes only).

**Analog B — CHECK-enum single-value column:** `supabase/migrations/20260515024612_add_permaculture_fields.sql`

**Single-value vocab enforcement** (lines 5-7):
```sql
ALTER TABLE plants
  ADD COLUMN forest_garden_layer TEXT
    CHECK (forest_garden_layer IN ('canopy', 'sub-canopy', 'shrub', 'herb', 'ground cover', 'rhizosphere', 'climber')),
```
Apply this exact `TEXT ... CHECK (col IN (...))` idiom to `relationship_type` (`'HELPS', 'AVOIDS'`) and `confidence` (`'verified', 'traditional', 'anecdotal'`). Reinforced by `20260518192238_add_functional_data_fields.sql` lines 15-18 (`establishment_difficulty` / `maintenance_level` use the identical pattern — the Phase 2 D-08/D-10/D-11 precedent D-07 cites). Per D-08: both columns `NOT NULL`, `confidence` with **no `DEFAULT`**; `mechanism TEXT` (nullable, no `NOT NULL`).

**Constraint naming (RESEARCH.md guidance, no exact repo analog — repo constraints are unnamed):** name the UNIQUE + self-ref CHECK so the v2 backfill gets self-describing violation messages:
```sql
CONSTRAINT plant_relationships_unique_triple
  UNIQUE (subject_plant_id, object_plant_id, relationship_type),
CONSTRAINT plant_relationships_no_self_ref
  CHECK (subject_plant_id <> object_plant_id)
```

**Migration filename ordering:** must sort lexically *after* the latest migration `20260518192238_add_functional_data_fields.sql`, and the create-table file must sort *before* the seed file. Prefer `supabase migration new ...` (CLI assigns monotonic timestamps) over hand-edited timestamps.

---

### `..._seed_plant_relationships.sql` (migration, fail-loud seed)

**Split precedent:** `supabase/migrations/20260515024610_seed_sample_plants.sql` exists as a separate seed migration after `..._24608_create_plants_table.sql` — repo precedent for the two-file (DDL then seed) split RESEARCH.md recommends. (Not read for code; cited only as the structural-split justification — its body is plain `INSERT VALUES`, which is the anti-pattern here.)

**No in-repo PL/pgSQL fail-loud analog exists.** Use the RESEARCH.md `pg_temp.resolve_plant` + `SELECT ... INTO STRICT` pattern (RESEARCH.md lines 224-256). Key contract: `INTO STRICT` raises `NO_DATA_FOUND` (zero match) / `TOO_MANY_ROWS` (ambiguous) → whole `DO $$` block rolls back inside the migration transaction → migration hard-fails (satisfies D-05 + the honest-gates principle from `feedback_honest_gates_no_fabrication`). Use `pg_temp.` schema for the auto-dropped scratch helper. **Anti-pattern to reject:** bare `INSERT ... SELECT ... WHERE common_name ILIKE '%X%'` (silently inserts 0 rows). **Mandatory pre-seed task:** query the live `plants` catalog for each candidate species before finalizing the curated list (RESEARCH.md A1 / Pitfall 1 — the sample seed has zero vegetables; production is iNaturalist-imported and may lack tomato/basil/walnut).

---

### `lib/types.ts` (model — append only)

**Analog:** `lib/types.ts` itself (same-file conventions)

**String-union scalar type aliases** (lines 1-4):
```typescript
export type Sun = 'full sun' | 'part shade' | 'full shade'
export type Water = 'low' | 'moderate' | 'high'
export type PlantType = 'shrub' | 'tree' | 'perennial' | 'groundcover' | 'vine' | 'grass'
export type ForestGardenLayer = 'canopy' | 'sub-canopy' | 'shrub' | 'herb' | 'ground cover' | 'rhizosphere' | 'climber'
```
Mirror exactly for `RelationshipType = 'HELPS' | 'AVOIDS'` and `RelationshipConfidence = 'verified' | 'traditional' | 'anecdotal'`. Note: no trailing semicolons, `export type` prefix, single-line union.

**Interface conventions + nullable + optional joined row** (lines 6-11, 53-61):
```typescript
export interface Plant {
  id: string
  common_name: string
  latin_name: string | null
  ...
  created_at: string
}

export interface PlantListItem {
  id: string
  list_id: string
  plant_id: string
  sort_order: number
  notes: string | null
  created_at: string
  plant?: Plant
}
```
Apply to `PlantRelationship`: `id: string`, FK columns `subject_plant_id: string` / `object_plant_id: string`, the two unions for `relationship_type` / `confidence`, `mechanism: string | null` (D-08 — mirrors `notes: string | null` / `latin_name: string | null`), `created_at: string` (string not `Date` — Supabase returns ISO strings, matches every existing interface). Optional joined `subject_plant?: Plant` / `object_plant?: Plant` ONLY mirror `PlantListItem.plant?: Plant` (line 60) — include only if the verification query embeds a PostgREST join; otherwise omit (Phase 3 has no UI consumer). Append after `PlantListItem`; no semicolons; 2-space indent.

---

### `scripts/verify-relationships.ts` (utility — verification tooling)

**Analog:** `scripts/backfill-usda-zones.ts`

**Script scaffolding — shebang, dotenv, service-role key fallback, client** (lines 1-23, 65-72):
```typescript
#!/usr/bin/env tsx
/**
 * <one-line purpose>
 *
 * Usage:
 *   npx tsx scripts/verify-relationships.ts
 *
 * Requires in .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=... (or SUPABASE_SECRET_KEY=...)
 */
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
...
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
```
Copy verbatim: shebang, JSDoc header block with Usage + `.env.local` requirements, the `SUPABASE_SECRET_KEY ?? SUPABASE_SERVICE_ROLE_KEY!` fallback (this exact ordering), `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)`. Drop the Anthropic import/client (no Claude calls in this verify script).

**Typed result, no `any`** (lines 74-79, 116-127):
```typescript
interface PlantRow {
  id: string
  common_name: string
  latin_name: string
  usda_zones: string
}
...
if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing from .env.local')

const { data, error } = await supabase.from('plants').select('id, ...').order('common_name')
if (error) throw new Error(`Could not fetch plants: ${error.message}`)
const plants = (data ?? []) as PlantRow[]
```
For the verify script, prefer the RESEARCH.md typed-query form `.returns<PlantRelationship[]>()` over the `as PlantRow[]` cast (new code, stricter union types available) — import `type { PlantRelationship } from '../lib/types'`. Keep the `if (!SERVICE_ROLE_KEY) throw` guard and `if (error) throw new Error(...)` checks. No `as any`, no untyped destructuring (CLAUDE.md TS strict).

**Top-level error handling + exit code** (line 197):
```typescript
main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
```
Copy this exact `main().catch(...)` tail. For honest-gate failures, accumulate a `fails: string[]` and `process.exit(1)` with the messages (RESEARCH.md verification-script example lines 410-414) — a passing run logs `✓ ...` and exits 0.

**Optional `package.json` script entry:** add `"verify-relationships": "tsx scripts/verify-relationships.ts"` mirroring existing `backfill-zones` / `dedupe-plants` entries (RESEARCH.md / CLAUDE.md script-list convention).

## Shared Patterns

### Public-read RLS (reference data)
**Source:** `supabase/migrations/20260515024609_create_plant_lists_table.sql` lines 20-24 (and `..._24608_create_plants_table.sql` per RESEARCH.md)
**Apply to:** the create-table migration
```sql
ALTER TABLE plant_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Relationships are publicly readable"
  ON plant_relationships FOR SELECT
  USING (true);
```
No public INSERT/UPDATE/DELETE policy — writes are service-role migrations/scripts only (V4 access control; mirrors `plants`).

### CHECK-enum vocabulary enforcement
**Source:** `supabase/migrations/20260515024612_add_permaculture_fields.sql` line 7; `20260518192238_add_functional_data_fields.sql` lines 15-18
**Apply to:** `relationship_type`, `confidence` columns in the create-table migration
```sql
relationship_type TEXT NOT NULL CHECK (relationship_type IN ('HELPS', 'AVOIDS')),
confidence TEXT NOT NULL CHECK (confidence IN ('verified', 'traditional', 'anecdotal')),
```

### Honest-gate fail-loud (no in-repo SQL analog; behavioral precedent)
**Source (behavioral):** `scripts/backfill-usda-zones.ts` line 116 `if (!SERVICE_ROLE_KEY) throw ...` + `feedback_honest_gates_no_fabrication` memory + Phase 2 D-20
**Apply to:** seed migration (`SELECT INTO STRICT` RAISE) AND `verify-relationships.ts` (`process.exit(1)` on any unmet D-06 assertion)
The verify script and the seed must BOTH fail loudly — never a silent empty table or a green run over zero rows.

### Service-role tsx script scaffolding
**Source:** `scripts/backfill-usda-zones.ts` lines 1-23, 65-72, 197
**Apply to:** `scripts/verify-relationships.ts` (full scaffold reuse — see Pattern Assignment above)

## No Analog Found

No file has *zero* analog, but one pattern has no exact in-repo SQL precedent:

| File | Pattern | Reason | Fallback |
|------|---------|--------|----------|
| `..._seed_plant_relationships.sql` | PL/pgSQL `DO $$` + `pg_temp.resolve_plant` + `SELECT INTO STRICT` fail-loud seed | Repo's only seed migration (`20260515024610_seed_sample_plants.sql`) uses plain `INSERT VALUES` with no fail-loud guard — the exact anti-pattern D-05 forbids | Use RESEARCH.md Pattern 2 (lines 224-256); split-migration *structure* still follows the repo's create-then-seed precedent |

## Metadata

**Analog search scope:** `supabase/migrations/` (12 migration files listed), `scripts/` (10 scripts listed), `lib/types.ts`
**Files scanned (read in full):** 4 analogs — `20260515024609_create_plant_lists_table.sql`, `20260515024612_add_permaculture_fields.sql`, `20260518192238_add_functional_data_fields.sql`, `lib/types.ts`, `scripts/backfill-usda-zones.ts`
**Pattern extraction date:** 2026-05-19
