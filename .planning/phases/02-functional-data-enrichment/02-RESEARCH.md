# Phase 2: Functional Data Enrichment - Research

**Researched:** 2026-05-18
**Domain:** Claude Haiku structured-output enrichment pipeline + Supabase schema migration + Next.js RSC detail-page display
**Confidence:** HIGH (every claim verified against in-repo source; no external dependencies introduced)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Reuse and normalize the existing `permaculture_uses TEXT[]` column to a controlled vocabulary — do **not** add a new `functional_roles` column. Existing ~250 rows are re-enriched to conform (free-form legacy values normalized/replaced).
- **D-02:** Controlled vocabulary (16 tags), validated against Claude output the same way `VALID_SUN`/`VALID_WATER` are enforced in `update-existing-plants.ts`: `nitrogen fixer`, `dynamic accumulator`, `insectary plant`, `chop-and-drop`, `wildlife benefit`, `medicinal`, `fiber`, `groundcover`, `windbreak`, `pollinator nectary`, `bee forage`, `living mulch`, `biomass producer`, `erosion control`, `hedgerow`, `edible`.
- **D-03:** A plant may carry multiple role tags (array). Unknown/invalid tags from Claude are dropped (not stored).
- **D-04:** Phase 2 ships **schema + detail-page display + enrichment pipeline only**. No new filter controls. Filter UI deferred to SRCH-02 (v2).
- **D-05:** Add **dedicated sections** to `app/(app)/plants/[id]/page.tsx`: `Functional Roles`, `Forest Layer & Succession`, `Establishment & Care`, `Harvest`. The generic "Permaculture" section is retired/absorbed.
- **D-06:** Array/tag fields render as `rounded-full` pills (existing `permaculture_uses` chip markup). Scalar fields render as `InfoCell` rows.
- **D-07:** Section header styling `text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em]`. New sections slot after Landscaping, before Notable Cultivars; empty/null fields conditionally hidden via `&&` guard.
- **D-08:** `forest_garden_layer` — unchanged (existing enum).
- **D-09:** `succession_role` → `TEXT[]`. Vocabulary: `pioneer | early successional | mid successional | climax`.
- **D-10:** `establishment_difficulty` → single enum: `easy | moderate | challenging`.
- **D-11:** `maintenance_level` → single enum: `low | moderate | high`.
- **D-12:** `years_to_bearing` → `INTEGER | null` (null for non-food plants).
- **D-13:** `propagation_methods` → `TEXT[]`: `seed | cutting | division | layering | grafting | root cutting | tuber | sucker`.
- **D-14:** `edible_parts` → `TEXT[]`: `leaf | fruit | nut | seed | root | flower | bark | sap | shoot | pod`. Empty array = not edible.
- **D-15:** `harvest_months` → `TEXT[]` using the **same month-name format as `bloom_months`** (reuse month display/ordering helpers, i.e. `MONTH_OPTIONS`).
- **D-16:** Create a **new dedicated script** `scripts/enrich-functional-data.ts` + npm script entry. Reuse batch size (10), 15s batch delay, structured-output interface, enum-validation from `update-existing-plants.ts`. Do **not** extend `update-existing-plants.ts`.
- **D-17:** **Per-field** skip-if-populated guard: per row, enrich only Phase-2 fields currently null/empty; leave populated fields untouched. Supports safe reruns.
- **D-18:** DATA-05 verification is a `--verify` subcommand (or companion script) producing an independent pass/fail coverage report; per-field non-null counts; exits non-zero if any required field is null for the enriched set; re-runnable.
- **D-19:** "Enriched set" = all plant rows the pipeline targets (~250). `years_to_bearing` exempt from non-null assertion. `edible_parts`/`harvest_months` may be empty arrays — verification asserts column present/typed, not non-empty.

### Claude's Discretion

- Exact migration file name and column ordering (follow timestamped convention; mirror `add_permaculture_fields` style with `CHECK` for single-value enums where practical).
- Exact pill/InfoCell component reuse and shared display constants — extend `lib/plant-labels.ts` rather than inlining.
- Claude Haiku prompt wording and structured-output schema details, provided outputs are validated against D-02/D-09..D-15 vocabularies.
- Whether succession-role/edible-parts use plain `TEXT[]` vs. `CHECK`-constrained — array CHECK is awkward; app/script-layer validation acceptable (matches existing `permaculture_uses` which has no DB CHECK).

### Deferred Ideas (OUT OF SCOPE)

- Filter sidebar controls for role/layer/succession/edible — SRCH-02 (v2).
- Personalized relevance ranking / climate-weighted prominence (PERS-01/02) — v2.
- Companion planting tables (COMP-01/02) — Phase 3.
- Range-valued `years_to_bearing` — single int for v1.
- Sub-month harvest granularity — month-level only for v1.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Functional role tags as structured array, query-ready | Normalize existing `permaculture_uses TEXT[]` to 16-tag vocab (D-01/02). Validate via `normalizeEnum`-style filter (`update-existing-plants.ts:91`). **Vocabulary conflict found** — see Pitfall 1. |
| DATA-02 | Forest layer + succession role | `forest_garden_layer` already exists (`lib/types.ts:30`, migration `...612`). Add `succession_role TEXT[]` (D-09). |
| DATA-03 | Establishment & care: propagation, difficulty, years to bearing, maintenance | New columns `propagation_methods TEXT[]`, `establishment_difficulty TEXT CHECK`, `years_to_bearing INTEGER`, `maintenance_level TEXT CHECK` (D-10..13). |
| DATA-04 | Edible parts + harvest months | New columns `edible_parts TEXT[]`, `harvest_months TEXT[]` (D-14/15). `harvest_months` reuses `MONTH_OPTIONS` (`lib/plant-labels.ts:4`). |
| DATA-05 | Enrichment pipeline + skip-if-populated + post-run verification | New `scripts/enrich-functional-data.ts` mirroring `update-existing-plants.ts`; per-field guard (D-17); `--verify` subcommand (D-18/19). No verify precedent in repo — new pattern. |
</phase_requirements>

## Summary

This phase is entirely **in-repo pattern reuse** — no new libraries, no external research required. Every primitive needed already exists and was read in full: the enrichment script scaffold (`scripts/update-existing-plants.ts`), idempotent skip-if-populated query patterns (`scripts/backfill-native-states.ts`, `scripts/backfill-usda-zones.ts`), the detail-page section/InfoCell/pill markup (`app/(app)/plants/[id]/page.tsx`), the `Plant` interface (`lib/types.ts`), the label/constant module (`lib/plant-labels.ts`), and the two migration-style precedents.

The single most important finding is a **data hazard**: `lib/plant-labels.ts:9` already exports `PERM_USE_OPTIONS` with a *different, smaller 10-tag vocabulary* (`'nitrogen fixer', 'dynamic accumulator', 'edible', 'medicinal', 'pollinator', 'biomass', 'windbreak', 'wildlife habitat', 'pioneer', 'insectary'`) than the 16-tag D-02 vocabulary. D-01 mandates re-enriching all ~250 existing rows to the new vocab — this is a **lossy normalization** of existing free-form `permaculture_uses` data. The plan must explicitly reconcile `PERM_USE_OPTIONS` with the D-02 list and decide the existing-data overwrite policy (D-01 says replace).

The second key finding: the reference scripts use **JSON-in-text extraction** (`response.content[0].text` → regex `/\{[\s\S]*\}/` → `JSON.parse`), **not** the SDK's tool-use structured-output API. `@anthropic-ai/sdk@0.96.0` is verified installed. The new script must match the existing JSON-in-text approach (D-16 says reuse the "structured-output interface" — in this codebase that *means* the typed `interface` + JSON-prompt + regex-extract + per-field validate pattern, not Anthropic tool calls).

**Primary recommendation:** Build one new script `scripts/enrich-functional-data.ts` copied from `update-existing-plants.ts`, with (a) a per-field OR-of-nulls targeting query, (b) per-field conditional UPDATE payload, and (c) a `--verify` flag branch that runs a read-only coverage report. One new migration mirroring `20260515024612_add_permaculture_fields.sql`. Detail-page edit replaces the single "Permaculture" `<section>` (lines 150–169) with four new sections using identical InfoCell/pill markup. Extend `lib/plant-labels.ts` with the new vocab/label constants.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| New columns + enum constraints | Database / Storage | — | Schema is the query-ready foundation; CHECK enforces single-value enums |
| AI field generation + validation | Data scripts (tsx, service-role) | Claude API | Mirrors all existing `scripts/` enrichment; service-role bypasses RLS for writes |
| Per-field skip & verification | Data scripts | Database | Targeting/verification are Supabase queries run from the script |
| Field display | Frontend Server (RSC) | — | Detail page is already an async RSC (`page.tsx:18`); single `.select('*')` already returns new columns automatically |
| Type contract | Shared lib | — | `lib/types.ts` `Plant` interface consumed by RSC; must match migration column names |
| Display labels/vocab constants | Shared lib | — | `lib/plant-labels.ts` is the established home (Phase 1 D-09) |

## Standard Stack

### Core

No new packages. Verified installed:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@anthropic-ai/sdk` | 0.96.0 `[VERIFIED: npm ls]` | Claude Haiku enrichment client | Already used by all 4 enrichment scripts |
| `@supabase/supabase-js` | 2.105.4 `[VERIFIED: package.json:21]` | Service-role DB client in scripts | Established `createClient(URL, SERVICE_ROLE_KEY)` pattern |
| `tsx` | 4.22.0 `[VERIFIED: package.json:36]` | Runs `scripts/*.ts` directly | All scripts run via `tsx`, excluded from TS build |
| `dotenv` | 17.4.2 `[VERIFIED: package.json:33]` | `.env.local` loading in scripts | `dotenv.config({ path: '.env.local' })` in every script |

**Claude model string:** `'claude-haiku-4-5-20251001'` — `[VERIFIED: in-repo usage]` identical literal in `update-existing-plants.ts:99`, `backfill-native-states.ts:60`, `backfill-usda-zones.ts:87`. Use this exact string; do not "upgrade" the model.

### Installation

None. `npm install` not required. Only add a `package.json` script entry (see below).

## Package Legitimacy Audit

Not applicable — this phase installs **zero** external packages. All dependencies already present and version-pinned in `package-lock.json` (lockfile v3). slopcheck N/A.

## Architecture Patterns

### System Architecture Diagram

```
                       ┌─────────────────────────────────────────┐
  npm run enrich-      │  scripts/enrich-functional-data.ts       │
  functional-data ───► │  (tsx, service-role, NOT in TS build)    │
                       │                                          │
                       │  1. SELECT plants WHERE                   │
                       │     succession_role IS NULL OR            │
                       │     establishment_difficulty IS NULL OR   │ ──► Supabase
                       │     ... (per-field OR, D-17)              │ ◄── (plants rows:
                       │  2. batch(10) → Claude Haiku JSON prompt  │      id, common_name,
                       │     └─ regex extract → JSON.parse         │ ──► Claude    latin_name,
                       │     └─ per-field validate vs vocab        │ ◄── Haiku     + current
                       │     └─ DROP invalid (D-03)               │      null-field state)
                       │  3. UPDATE only the fields that were      │
                       │     null AND validated (per-field merge)  │ ──► Supabase UPDATE
                       │  4. sleep 15s between batches             │
                       └─────────────────────────────────────────┘

  npm run enrich-      ┌─────────────────────────────────────────┐
  functional-data      │  same script, --verify branch (D-18)     │
  -- --verify     ───► │  read-only: COUNT non-null per field      │ ──► Supabase
                       │  print "succession_role: 248/248 ✓"       │ ◄── (aggregate
                       │  exit(1) + list offending ids if any      │      counts / id list)
                       │  required field null (years_to_bearing,   │
                       │  edible/harvest exempt per D-19)          │
                       └─────────────────────────────────────────┘

  Detail page (unchanged data flow):
  /plants/[id] ──► RSC page.tsx ──► supabase.from('plants').select('*') ──► renders
                   (line 22-26; '*' already pulls new columns — no query change needed)
```

### Recommended File Structure

```
scripts/
└── enrich-functional-data.ts   # NEW — copy of update-existing-plants.ts + per-field guard + --verify
supabase/migrations/
└── 2026XXXXXXXXXX_add_functional_data_fields.sql   # NEW — mirror ...612 style
lib/
├── types.ts          # EDIT — add 6 fields to Plant interface
└── plant-labels.ts   # EDIT — reconcile PERM_USE_OPTIONS; add new vocab/label constants
app/(app)/plants/[id]/
└── page.tsx           # EDIT — replace lines 150-169 (Permaculture section) with 4 sections
package.json            # EDIT — add "enrich-functional-data" script
```

### Pattern 1: Per-field skip-if-populated targeting (D-17)

**What:** Existing scripts target whole-row nulls with chained `.is(col, null)` (AND semantics — *all* must be null; `update-existing-plants.ts:153-161`). D-17 requires the inverse: select a row if **any** Phase-2 field is null, then per-row only write the null fields.

**Existing precedents:**
- AND-of-nulls (all null): `update-existing-plants.ts:156-160` (`.is('native_range', null).is('usda_zones', null)...`)
- Mixed not-null + null: `backfill-usda-zones.ts:121-123` (`.not('usda_zones','is',null).is('usda_zone_min',null)`)
- Single-field null: `backfill-native-states.ts:93` (`.is('native_states', null)`)

**Recommended:** Supabase `.or()` for OR-of-nulls targeting, then in-memory per-field merge:

```typescript
// Source: pattern derived from @supabase/supabase-js .or() + update-existing-plants.ts:153
const TARGET_FIELDS = [
  'succession_role', 'establishment_difficulty', 'maintenance_level',
  'years_to_bearing', 'propagation_methods', 'edible_parts', 'harvest_months',
] as const
// permaculture_uses handled separately — D-01 says RE-ENRICH all rows (overwrite),
// so it is NOT part of the skip-if-populated OR clause.

const { data } = await supabase
  .from('plants')
  .select('id, common_name, latin_name, permaculture_uses, succession_role, establishment_difficulty, maintenance_level, years_to_bearing, propagation_methods, edible_parts, harvest_months')
  .or(TARGET_FIELDS.map(f => `${f}.is.null`).join(','))
  .order('common_name')

// per-row: build UPDATE payload containing ONLY fields that are currently null/empty
const update: Record<string, unknown> = {}
if (row.succession_role == null || row.succession_role.length === 0) update.succession_role = validatedSuccession
if (row.establishment_difficulty == null) update.establishment_difficulty = validatedDifficulty
// ...one guard per field. permaculture_uses ALWAYS written (D-01 re-enrich).
if (Object.keys(update).length > 0) await supabase.from('plants').update(update).eq('id', row.id)
```

**Empty-array nuance (D-19):** `TEXT[]` columns are never SQL-`NULL` once set (they become `{}`). To make non-edible plants re-runnable like `backfill-native-states.ts` does (writes `[]` not null so rows aren't re-queried — see its lines 8-9, 114), treat the initial column default as `NULL` and only write `[]` after a successful enrichment pass. A column still `NULL` ⇒ never enriched ⇒ include in `.or()`. A column `{}` ⇒ enriched, plant legitimately non-edible ⇒ skip. This is exactly the established native_states convention.

### Pattern 2: JSON-in-text structured output (NOT tool use)

**What:** All repo scripts prompt for a single JSON object/array, extract with regex, `JSON.parse`. D-16's "structured-output interface" refers to this in-repo idiom, not the SDK tool-calling API.

```typescript
// Source: update-existing-plants.ts:96-141 (verbatim pattern to copy)
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',
  max_tokens: 600,                         // raise for ~10 fields; 800 suggested
  messages: [{ role: 'user', content: `...return a single JSON object...\n{ "succession_role": [...] | null, ... }` }],
})
const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
const match = text.match(/\{[\s\S]*\}/)
if (!match) return null
return JSON.parse(match[0]) as FunctionalData
```

**Per-field validation (D-03 drop-invalid):** reuse `normalizeEnum` (`update-existing-plants.ts:91-94`) for single enums; use array `.filter()` against a `Set`/const for array vocabs — exactly `backfill-native-states.ts:77` (`parsed.filter(s => typeof s === 'string' && VALID_SET.has(...))`).

```typescript
// single enum (difficulty/maintenance): update-existing-plants.ts:91
establishment_difficulty: normalizeEnum(raw.establishment_difficulty, VALID_DIFFICULTY)
// array vocab (roles/succession/propagation/edible): backfill-native-states.ts:77
const valid = (arr: unknown, allow: Set<string>) =>
  Array.isArray(arr) ? arr.filter((s): s is string => typeof s === 'string' && allow.has(s.toLowerCase())) : []
// years_to_bearing: coerce to int or null
years_to_bearing: Number.isInteger(raw.years_to_bearing) ? raw.years_to_bearing : null
// harvest_months: validate against MONTH_OPTIONS (lib/plant-labels.ts:4) — case/format match bloom_months
```

### Pattern 3: `--verify` subcommand (D-18) — NEW pattern, no repo precedent

`grep -rl verify scripts/` returned nothing — this is a net-new pattern. Branch in `main()` on `process.argv.includes('--verify')`. npm passes flags after `--`: `npm run enrich-functional-data -- --verify`.

```typescript
// Read-only coverage report. No external libs. Exit codes per D-18.
async function verify() {
  const REQUIRED = ['permaculture_uses','succession_role','establishment_difficulty','maintenance_level','propagation_methods'] as const
  // years_to_bearing EXEMPT (D-19). edible_parts/harvest_months: assert typed, not non-empty (D-19).
  const { count: total } = await supabase.from('plants').select('id', { count: 'exact', head: true })
  let failed = false
  for (const f of REQUIRED) {
    const { count: ok } = await supabase.from('plants').select('id', { count: 'exact', head: true }).not(f, 'is', null)
    const mark = ok === total ? '✓' : '✗'
    console.log(`  ${f}: ${ok}/${total} ${mark}`)
    if (ok !== total) {
      failed = true
      const { data: bad } = await supabase.from('plants').select('id, common_name').is(f, null)
      bad?.forEach(p => console.log(`     ✗ ${p.common_name} (${p.id})`))
    }
  }
  // typed-presence check for edible_parts / harvest_months (column exists ⇒ select succeeds; empty [] is valid)
  process.exit(failed ? 1 : 0)
}
if (process.argv.includes('--verify')) { await verify() } else { await main() }
```
Verification line format (from CONTEXT.md Specifics): `functional_roles (permaculture_uses): 248/250 ✓`. Match this label style.

### Pattern 4: Migration shape (mirror `20260515024612`)

`[CITED: supabase/migrations/20260515024612_add_permaculture_fields.sql]` — single-value enum uses `TEXT CHECK (col IN (...))`; array is plain `TEXT[]` (no CHECK; matches existing `permaculture_uses`). Filename = 14-digit timestamp + `_add_functional_data_fields.sql`. Apply via `supabase db push` (CLAUDE.md).

```sql
-- mirror of 20260515024612_add_permaculture_fields.sql style
ALTER TABLE plants
  ADD COLUMN succession_role TEXT[],
  ADD COLUMN propagation_methods TEXT[],
  ADD COLUMN edible_parts TEXT[],
  ADD COLUMN harvest_months TEXT[],
  ADD COLUMN establishment_difficulty TEXT
    CHECK (establishment_difficulty IN ('easy','moderate','challenging')),
  ADD COLUMN maintenance_level TEXT
    CHECK (maintenance_level IN ('low','moderate','high')),
  ADD COLUMN years_to_bearing INTEGER;
-- forest_garden_layer + permaculture_uses already exist (migration ...612). Do NOT re-add.
```
Array columns intentionally have **no** DB CHECK (D-discretion; awkward in Postgres; matches `permaculture_uses` precedent line 8). Validation lives in the script.

### Pattern 5: Detail-page section restructure

Current state `[CITED: app/(app)/plants/[id]/page.tsx]`:
- `InfoCell` component: lines 9-16. Reuse verbatim for scalars.
- Pill chip markup: lines 162-164 (`text-xs bg-terracotta/10 text-terracotta px-3 py-1.5 rounded-full border border-terracotta/20 capitalize`). Reuse verbatim for all arrays.
- Section wrapper: `<section className="mb-8">` + `<h2 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">` (lines 128-129, 140-141).
- Conditional guard idiom: `{(plant.a || plant.b?.length) && (<section>...)}` (line 151).
- InfoCell grid: `grid grid-cols-2 sm:grid-cols-3 gap-3` (line 130). Pill row: `flex flex-wrap gap-2` (line 160).
- **Permaculture section to DELETE: lines 150-169** (entire block). Notable Cultivars (170-176) stays after the four new sections.

**Replace lines 150-169 with four sections in this order** (per UI-SPEC + D-05):
1. **Functional Roles** — `permaculture_uses` pills only. Guard: `plant.permaculture_uses?.length`.
2. **Forest Layer & Succession** — `forest_garden_layer` InfoCell + `succession_role` pills. Guard: `plant.forest_garden_layer || plant.succession_role?.length`. Per-field omit inside.
3. **Establishment & Care** — `establishment_difficulty`/`maintenance_level`/`years_to_bearing` InfoCells (filter-Boolean array like `overviewCells` line 34-45) + `propagation_methods` pills. `years_to_bearing` value renders `${n} years` (UI-SPEC). Guard: any of the four present.
4. **Harvest** — `edible_parts` pills + `harvest_months` pills (months sorted by `MONTH_OPTIONS` calendar order — UI-SPEC pill-ordering contract; all other arrays render in stored order). Guard: `edible_parts?.length || harvest_months?.length`.

Full conditional matrix is in `02-UI-SPEC.md` lines 116-136 — planner should copy it as the executor's display spec. `lib/plant-labels.ts` gets the 4 InfoCell labels (`Forest Garden Layer`, `Establishment`, `Maintenance`, `Years to Bearing`) per UI-SPEC line 105-114, not inlined.

### Anti-Patterns to Avoid

- **Tool-use / response_format JSON schema:** Not used anywhere in this repo. D-16 mandates reusing the existing JSON-in-text idiom. Introducing SDK tool calls diverges from the canonical reference and is out of scope.
- **Adding a `functional_roles` column:** Explicitly forbidden by D-01. Reuse `permaculture_uses`.
- **Re-adding `forest_garden_layer`/`permaculture_uses` in the migration:** They already exist (migration `...612`, `types.ts:30-31`). Would error.
- **DB CHECK on `TEXT[]` columns:** D-discretion + repo precedent — keep arrays unconstrained at DB level.
- **Removing/shortening the 15s batch delay:** CLAUDE.md hard rule (10 calls/15s). Copy `CLAUDE_BATCH_DELAY_MS = 15000` verbatim.
- **Changing the detail-page Supabase query:** `.select('*')` (page.tsx:23) already returns new columns; no query edit needed, only JSX.
- **Touching the plant browser / filter sidebar:** D-04 — schema is query-ready only; SRCH-02 is v2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Batching + rate-limit | Custom queue | Copy `for (i; i+=BATCH) { Promise.all(...); sleep(15000) }` from `update-existing-plants.ts:177-230` | Proven, satisfies CLAUDE.md rule |
| Enum validation | New validator | `normalizeEnum` (`update-existing-plants.ts:91`) + Set-filter (`backfill-native-states.ts:77`) | Exactly the D-02/D-03 drop-invalid behavior |
| Service-role client | New auth | `createClient(SUPABASE_URL, SERVICE_ROLE_KEY)` (every script, e.g. `:65`) | Bypasses RLS for writes; established |
| Month ordering | New month array | `MONTH_OPTIONS` (`lib/plant-labels.ts:4`) | D-15 mandates `bloom_months` parity |
| Pill / InfoCell UI | New component | Verbatim markup `page.tsx:9-16, 162-164` | UI-SPEC is reuse-only; byte-identical classes required |
| JSON extraction | Strict parser | `text.match(/\{[\s\S]*\}/)` then `JSON.parse` (`:130-136`) | Handles Claude prose-wrapping; repo-wide idiom |

**Key insight:** This entire phase is composition of five existing patterns. The only genuinely new code is the `--verify` branch (no repo precedent) and the per-field merge logic; everything else is copy-adapt.

## Runtime State Inventory

> Refactor-adjacent: D-01 re-enriches/overwrites existing `permaculture_uses` data on ~250 rows.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `plants.permaculture_uses TEXT[]` — ~250 rows populated with the **legacy free-form vocab** (the old `PERM_USE_OPTIONS` 10-tag set + likely arbitrary AI strings from `import-permaculture-plants.ts`). D-01 mandates lossy re-normalization to the 16-tag D-02 vocab. | **Data migration** (re-enrich + overwrite, not skip — `permaculture_uses` is excluded from the per-field skip guard) + **code edit** (`PERM_USE_OPTIONS` constant) |
| Stored data | New `TEXT[]` columns: NULL on all existing rows post-migration. NULL ⇒ targeted; `{}` ⇒ skipped (empty-array-after-enrichment convention from `backfill-native-states.ts`). | Code: enrichment script writes `[]` for legitimately-empty so rows aren't re-queried |
| Live service config | None — no external service stores these strings. | None |
| OS-registered state | None. | None — verified: no schedulers/cron reference these scripts |
| Secrets/env vars | `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY` — names unchanged, reused from existing scripts (`:26-28`). | None |
| Build artifacts | Scripts excluded from TS build (CLAUDE.md); no compiled artifact. New `package.json` script entry only. | Add `"enrich-functional-data": "tsx scripts/enrich-functional-data.ts"` |

**Canonical question — after every file is updated, what runtime state still holds the old data?** The Supabase `plants.permaculture_uses` column on ~250 production rows. It is the only stateful carry-over, and D-01 deliberately overwrites it. The plan must include a discrete "re-enrich + normalize existing permaculture_uses" task, distinct from the "backfill new null fields" task, because they have opposite skip semantics.

## Common Pitfalls

### Pitfall 1: `PERM_USE_OPTIONS` vocabulary conflict (DATA HAZARD — HIGH)

**What goes wrong:** `lib/plant-labels.ts:9` currently is:
`['nitrogen fixer','dynamic accumulator','edible','medicinal','pollinator','biomass','windbreak','wildlife habitat','pioneer','insectary']` (10 tags).
D-02 mandates a **different** 16-tag vocab. Overlap is partial and names differ (`pollinator`→`pollinator nectary`/`bee forage`; `biomass`→`biomass producer`; `wildlife habitat`→`wildlife benefit`; `insectary`→`insectary plant`; `pioneer` is **dropped** from roles — it's a *succession_role* value under D-09).
**Why it happens:** Phase 1 (D-09) seeded `PERM_USE_OPTIONS` with a placeholder vocab anticipating Phase 2 but not matching the final D-02 list.
**How to avoid:** Plan a task to replace `PERM_USE_OPTIONS` with the exact 16-tag D-02 array and re-enrich (overwrite) all existing `permaculture_uses` values through Claude validated against the new vocab (D-01 explicitly accepts the lossy normalization). Existing values like `'pioneer'` map to `succession_role`, not roles — the prompt should request both fields so legacy semantics aren't simply discarded.
**Warning signs:** Existing detail pages showing stale tags (`pollinator`, `wildlife habitat`) post-deploy; `--verify` passing while UI shows old vocab.

### Pitfall 2: `permaculture_uses` wrongly included in skip-if-populated guard

**What goes wrong:** Treating `permaculture_uses` like the other new fields (skip if populated) means existing rows — *all* of which already have legacy values — get skipped and never normalized.
**Why it happens:** D-17 says "skip if populated" generically; D-01 carves `permaculture_uses` out (it must be re-enriched/overwritten).
**How to avoid:** Exclude `permaculture_uses` from the `.or()` targeting clause and from the per-field skip guard. It is always re-written. Two separate code paths.
**Warning signs:** `--verify` shows `permaculture_uses: 250/250 ✓` but the values are still the old 10-tag vocab.

### Pitfall 3: TEXT[] columns are never SQL NULL after first write

**What goes wrong:** Using `.is(col, null)` to detect "not yet enriched" fails once a `[]` is written — empty arrays are `{}`, not NULL, so the row is correctly skipped, but if you write `[]` for "Claude unsure" you can never retry.
**Why it happens:** Postgres array semantics; `[]` ≠ NULL.
**How to avoid:** Follow `backfill-native-states.ts` convention exactly — write `[]` **only** after a deliberate decision (plant is genuinely non-edible / no roles), keep NULL on Claude failure so partial-failure reruns re-attempt. D-19 verification treats `{}` as valid for edible/harvest (typed-present, not non-empty).
**Warning signs:** Plants permanently stuck with `[]` after a transient Claude error.

### Pitfall 4: Detail-page guard `0` falsy bug for `years_to_bearing`

**What goes wrong:** `{plant.years_to_bearing && <InfoCell .../>}` hides a legitimate value if it were `0`. Practically `years_to_bearing` is ≥1 or null, but the filter-Boolean array pattern (`page.tsx:34`) coerces — use `plant.years_to_bearing != null` not truthiness. UI-SPEC line 127: omit row only when null; never show empty/zero.
**How to avoid:** Explicit `!= null` checks for the integer scalar; arrays use `?.length`.

### Pitfall 5: Claude returns prose around JSON / wrong array shape

**What goes wrong:** With ~10 fields the response is larger; `max_tokens: 600` (current value) may truncate, breaking the `/\{[\s\S]*\}/` match.
**How to avoid:** Raise `max_tokens` (~800–1000) since the schema is bigger than the reference's. Keep the regex-extract + try/catch (`:131-139`) returning null on parse failure so the row stays NULL and is retried.

## Code Examples

### Per-field merge update (the core D-17 logic)
```typescript
// Source: composed from update-existing-plants.ts:190-212 + backfill-native-states.ts:77 validation
const update: Record<string, unknown> = {
  permaculture_uses: validRoles,           // D-01: ALWAYS overwrite (re-enrich)
}
if (row.succession_role == null)            update.succession_role = validSuccession
if (row.establishment_difficulty == null)   update.establishment_difficulty = normalizeEnum(raw.establishment_difficulty, VALID_DIFFICULTY)
if (row.maintenance_level == null)          update.maintenance_level = normalizeEnum(raw.maintenance_level, VALID_MAINT)
if (row.years_to_bearing == null)           update.years_to_bearing = Number.isInteger(raw.years_to_bearing) ? raw.years_to_bearing : null
if (row.propagation_methods == null)        update.propagation_methods = validProp
if (row.edible_parts == null)               update.edible_parts = validEdible       // [] if non-edible
if (row.harvest_months == null)             update.harvest_months = validMonths      // [] if none
await supabase.from('plants').update(update).eq('id', row.id)
```

### New constants for `lib/plant-labels.ts`
```typescript
// Source: extends existing lib/plant-labels.ts pattern (const string[] arrays)
export const FUNCTIONAL_ROLE_OPTIONS: string[] = ['nitrogen fixer','dynamic accumulator','insectary plant','chop-and-drop','wildlife benefit','medicinal','fiber','groundcover','windbreak','pollinator nectary','bee forage','living mulch','biomass producer','erosion control','hedgerow','edible'] // D-02
export const SUCCESSION_OPTIONS: string[] = ['pioneer','early successional','mid successional','climax'] // D-09
export const ESTABLISHMENT_OPTIONS: string[] = ['easy','moderate','challenging'] // D-10
export const MAINTENANCE_OPTIONS: string[] = ['low','moderate','high'] // D-11
export const PROPAGATION_OPTIONS: string[] = ['seed','cutting','division','layering','grafting','root cutting','tuber','sucker'] // D-13
export const EDIBLE_PART_OPTIONS: string[] = ['leaf','fruit','nut','seed','root','flower','bark','sap','shoot','pod'] // D-14
// MONTH_OPTIONS already exists (line 4) — reuse for harvest_months ordering (D-15)
// DECISION REQUIRED: replace PERM_USE_OPTIONS (line 9) with FUNCTIONAL_ROLE_OPTIONS or alias it
```

### `Plant` interface additions (`lib/types.ts`)
```typescript
// Source: extends lib/types.ts:30-32 (after forest_garden_layer / permaculture_uses)
succession_role: string[] | null
establishment_difficulty: string | null
maintenance_level: string | null
years_to_bearing: number | null
propagation_methods: string[] | null
edible_parts: string[] | null
harvest_months: string[] | null
```

## State of the Art

No external state-of-the-art shift relevant. This is pattern reuse of a stable in-repo codebase (Next.js 14.2.35, Supabase JS 2.x, Anthropic SDK 0.96.0 — all unchanged since Phase 1).

**Outdated within the repo:**
- `lib/plant-labels.ts:9` `PERM_USE_OPTIONS` — superseded by D-02 16-tag vocab; must be reconciled this phase.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `claude-haiku-4-5-20251001` is still a valid/available model id | Standard Stack | LOW — verified as the literal used by 3 working scripts; if API rejects it, all existing scripts are already broken (out of phase scope) |
| A2 | `.or('field.is.null,...')` is supported by `@supabase/supabase-js@2.105.4` for OR-of-nulls targeting | Pattern 1 | LOW — `.or()` is core PostgREST; if unavailable, fallback is fetch-all + in-memory filter (no behavior change) |
| A3 | Existing `permaculture_uses` data is legacy/free-form and lossy normalization is acceptable | Runtime State, Pitfall 1 | NONE — explicitly stated and accepted in D-01 |
| A4 | npm passes `--verify` after `--` to the tsx script via `process.argv` | Pattern 3 | LOW — standard npm behavior; alternative is a separate `enrich-functional-data:verify` script entry (D-18 permits "companion script") |
| A5 | `max_tokens` should rise to ~800-1000 for the larger ~10-field schema | Pitfall 5 | LOW — tunable; under-sizing only causes retryable NULLs, not data corruption |

## Open Questions

1. **`PERM_USE_OPTIONS` reconciliation strategy**
   - Known: D-01 mandates the 16-tag vocab and overwriting existing data; `lib/plant-labels.ts:9` has a conflicting 10-tag list.
   - Unclear: rename `PERM_USE_OPTIONS`→`FUNCTIONAL_ROLE_OPTIONS` (and update any importers) vs. replace its contents in place. Grep for `PERM_USE_OPTIONS` importers before deciding (none found in detail page or scripts read; likely only the v2 filter sidebar references it — but SRCH-02 is deferred so it may be unused).
   - Recommendation: replace contents in place to minimize churn; add `FUNCTIONAL_ROLE_OPTIONS` as the canonical name and `export const PERM_USE_OPTIONS = FUNCTIONAL_ROLE_OPTIONS` alias if any importer exists. Planner should add a grep task.

2. **Legacy `pioneer`/`wildlife habitat` semantic remap**
   - Known: existing data contains tags that map to *different* Phase-2 fields (`pioneer` → `succession_role`, not roles).
   - Unclear: whether to attempt semantic migration or let Claude re-derive from scratch.
   - Recommendation: let the enrichment prompt request *all* functional fields fresh from `common_name`/`latin_name` (matches reference scripts which never read existing values) — re-derivation is simpler and D-01 accepts replacement. Old values are not migrated, just overwritten.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@anthropic-ai/sdk` | Enrichment script | ✓ | 0.96.0 (`npm ls`) | — |
| `@supabase/supabase-js` | Script + RSC | ✓ | 2.105.4 | — |
| `tsx` | Script runner | ✓ | 4.22.0 | — |
| `ANTHROPIC_API_KEY` env | Claude calls | runtime (.env.local, not committed) | — | Script throws at start (`:150`) — expected guard |
| `SUPABASE_SERVICE_ROLE_KEY` env | DB writes | runtime (.env.local) | — | Script throws at start (`:149`) — expected guard |
| Supabase CLI | `supabase db push` migration | assumed (used Phase 1; CLAUDE.md documents it) | — | Apply SQL in Supabase dashboard (CLAUDE.md documents both) |

**Missing dependencies with no fallback:** None — all packages installed; env vars are runtime concerns the existing scripts already guard.

## Validation Architecture

`.planning/config.json` was not located in standard path; treating `nyquist_validation` as enabled (default per spec). **However:** project testing is **Playwright E2E only against the production URL** (CLAUDE.md — no unit/jest). This phase's primary validation is the **D-18 `--verify` coverage report**, which IS the executable acceptance gate (it functions as the test harness for DATA-05).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright 1.60.0 (E2E only) + the D-18 `--verify` script (data coverage gate) |
| Config file | `playwright.config.ts` |
| Quick run command | `npm run enrich-functional-data -- --verify` (data gate) |
| Full suite command | `npx playwright test` (hits production — destructive-safe; this phase adds no mutations) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | `permaculture_uses` normalized to 16-tag vocab, 250/250 | data-verify | `npm run enrich-functional-data -- --verify` | ❌ Wave 0 (verify branch new) |
| DATA-02 | `succession_role`/`forest_garden_layer` non-null coverage | data-verify | same | ❌ Wave 0 |
| DATA-03 | `establishment_difficulty`/`maintenance_level`/`propagation_methods` coverage | data-verify | same | ❌ Wave 0 |
| DATA-04 | `edible_parts`/`harvest_months` columns typed-present (empty OK) | data-verify | same | ❌ Wave 0 |
| DATA-05 | Pipeline skips populated rows, exits 0; verify exits non-zero on gaps | data-verify | run twice (2nd = "Nothing to do."); `--verify` | ❌ Wave 0 |
| DATA-01..04 (display) | Detail page shows 4 new sections with correct conditional hiding | E2E (Playwright) | `npx playwright test tests/logged-out` | partial — existing detail-page tests; new section assertions needed |

### Sampling Rate
- **Per task commit:** `npm run lint` + `npx tsc --noEmit` (TypeScript strict — `Plant` interface must compile)
- **Per wave merge:** `npm run enrich-functional-data -- --verify` (after enrichment task waves)
- **Phase gate:** `--verify` exits 0 AND Playwright detail-page suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `scripts/enrich-functional-data.ts` `--verify` branch — IS the DATA-05 acceptance test (no separate test file; the script is self-verifying per D-18)
- [ ] Playwright assertions for the 4 new detail-page sections + conditional-hide behavior (extend existing `tests/` detail-page spec; scope to `nav`/section per CLAUDE.md Playwright gotchas; cards `.bg-cream`, pills `bg-terracotta/10`)
- [ ] No framework install needed — Playwright + tsx already present

*Note: project has no unit-test framework by design (CLAUDE.md); the D-18 verify subcommand is the deliberate substitute for DATA-05's "post-run verification" acceptance criterion.*

## Security Domain

`security_enforcement` config not located; default-enabled. Assessment:

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Scripts use service-role key (offline data tooling, not user-facing) |
| V3 Session Management | no | No session surface added |
| V4 Access Control | yes (low) | New columns inherit existing `plants` RLS SELECT `USING (true)` (public catalog, intended). No RLS change needed — same policy already covers `permaculture_uses` |
| V5 Input Validation | yes | Claude output validated against fixed vocabularies before DB write (D-03 drop-invalid) — already the established `normalizeEnum`/Set-filter pattern. Prevents arbitrary AI strings entering `TEXT[]` |
| V6 Cryptography | no | None |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| AI returns malicious/garbage strings into `TEXT[]` | Tampering | Per-field vocabulary whitelist filter (drop-invalid, D-03) — already standard in `backfill-native-states.ts:77` |
| Service-role key exposure | Info Disclosure | Key is scripts-only, never client-side (CLAUDE.md); `.env.local` not committed — unchanged from existing scripts |
| Render of enriched text in RSC | Tampering/XSS | Values are vocabulary-constrained enums, rendered as React text children (auto-escaped); no `dangerouslySetInnerHTML` — no new surface |

No new security-sensitive surface. The only control to enforce is the existing input-validation discipline (whitelist Claude output), which D-03 already mandates.

## Sources

### Primary (HIGH confidence — read in full this session)
- `scripts/update-existing-plants.ts` (1-242) — reference enrichment scaffold, batching, `normalizeEnum`, JSON-in-text
- `scripts/backfill-native-states.ts` (1-139) — empty-array-not-null idempotency, Set-filter array validation
- `scripts/backfill-usda-zones.ts` (1-198) — mixed not-null/null targeting, two-pass pattern
- `app/(app)/plants/[id]/page.tsx` (1-181) — InfoCell, pill markup, section/guard pattern, Permaculture block to delete
- `lib/types.ts` (1-55) — `Plant` interface, `ForestGardenLayer`
- `lib/plant-labels.ts` (1-11) — `MONTH_OPTIONS`, `PERM_USE_OPTIONS` (conflict found)
- `supabase/migrations/20260515024612_add_permaculture_fields.sql` / `...611...` — migration style
- `.planning/phases/02-functional-data-enrichment/02-CONTEXT.md` — D-01..D-19 (authoritative)
- `.planning/phases/02-functional-data-enrichment/02-UI-SPEC.md` — display contract
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `CLAUDE.md`, `package.json`
- `npm ls @anthropic-ai/sdk` → 0.96.0 verified; `grep -rl verify scripts/` → no precedent

### Secondary / Tertiary
- None — no external web research required (zero new dependencies, in-repo pattern reuse only).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package verified via `npm ls`/`package.json`; zero new deps
- Architecture: HIGH — all five patterns are verbatim from read in-repo source
- Pitfalls: HIGH — Pitfall 1 (vocab conflict) directly observed in `lib/plant-labels.ts:9` vs CONTEXT D-02
- `--verify` pattern: MEDIUM — net-new (no repo precedent); design is straightforward read-only Supabase counts

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (stable; in-repo patterns, no fast-moving external deps)
