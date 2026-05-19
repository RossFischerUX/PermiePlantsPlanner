# Phase 2: Functional Data Enrichment - Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 6 (1 new script, 1 new migration, 4 modified)
**Analogs found:** 6 / 6 (every file has an exact or strong in-repo analog; only the `--verify` branch is net-new)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `scripts/enrich-functional-data.ts` (NEW) | data-script (tsx, service-role) | batch + transform (Claude enrich) | `scripts/update-existing-plants.ts` | exact (copy-adapt) |
| `scripts/enrich-functional-data.ts` `--verify` branch | data-script (read-only report) | batch (aggregate COUNT) | none — net-new pattern | no analog (design in Pattern 3) |
| `supabase/migrations/<ts>_add_functional_data_fields.sql` (NEW) | migration | DDL (ADD COLUMN + CHECK) | `supabase/migrations/20260515024612_add_permaculture_fields.sql` | exact |
| `lib/types.ts` (MODIFY) | model / type contract | n/a (static) | self — extend `Plant` interface `:6-35` | exact (in-file extension) |
| `lib/plant-labels.ts` (MODIFY) | config / constants | n/a (static) | self — existing `const string[]` arrays `:1-11` | exact (in-file extension) + DATA HAZARD |
| `app/(app)/plants/[id]/page.tsx` (MODIFY) | component (RSC) | request-response (read display) | self — Permaculture section `:150-169` | exact (in-file restructure) |
| `package.json` (MODIFY) | config | n/a | self — `update-plants` script entry `:11` | exact |

## Pattern Assignments

---

### `scripts/enrich-functional-data.ts` (data-script, batch+transform) — NEW

**Analog:** `scripts/update-existing-plants.ts` (copy whole-file scaffold), with array-validation grafted from `scripts/backfill-native-states.ts:77` and OR-of-nulls targeting derived from `scripts/backfill-usda-zones.ts:118-123`.

**Imports + client setup + config — COPY VERBATIM** (`update-existing-plants.ts:18-32, 65-72`):
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

const CLAUDE_BATCH_SIZE = 10
const CLAUDE_BATCH_DELAY_MS = 15000   // CLAUDE.md HARD RULE — do not shorten

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

**Env guards — COPY VERBATIM** (`update-existing-plants.ts:149-150`):
```typescript
if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) missing from .env.local')
if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing from .env.local')
```

**Enum validator — COPY VERBATIM** (`update-existing-plants.ts:91-94`):
```typescript
function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  return allowed.find(a => a.toLowerCase() === value.toLowerCase()) ?? null
}
```

**Array vocab validator — ADAPT from** `backfill-native-states.ts:77` (the Set-filter idiom; D-03 drop-invalid behavior):
```typescript
// backfill-native-states.ts:77 (original):
// return parsed.filter((s): s is string => typeof s === 'string' && VALID_STATE_CODES.has(s.toUpperCase())).map(s => s.toUpperCase())
const validArr = (arr: unknown, allow: Set<string>): string[] =>
  Array.isArray(arr)
    ? arr.filter((s): s is string => typeof s === 'string' && allow.has(s.toLowerCase()))
    : []
```

**Claude JSON-in-text extraction — COPY THE IDIOM** (`update-existing-plants.ts:96-141`; the structured-output interface in this repo = typed `interface` + JSON prompt + regex extract + try/catch → null). NOTE: raise `max_tokens` from `600` to ~`900` (Pitfall 5 — ~10-field schema is larger than the 17-field reference but with longer enum lists; under-sizing only causes retryable NULLs):
```typescript
const response = await anthropic.messages.create({
  model: 'claude-haiku-4-5-20251001',          // EXACT literal — do not "upgrade" (RESEARCH A1)
  max_tokens: 900,                              // raised from 600 (Pitfall 5)
  messages: [{ role: 'user', content: `...return a single JSON object...
{
  "permaculture_uses": ["nitrogen fixer", ...] | [],
  "succession_role": ["pioneer","early successional",...] | [],
  "establishment_difficulty": "easy" | "moderate" | "challenging" | null,
  "maintenance_level": "low" | "moderate" | "high" | null,
  "years_to_bearing": integer | null,
  "propagation_methods": ["seed","cutting",...] | [],
  "edible_parts": ["leaf","fruit",...] | [],
  "harvest_months": ["January","February",...] | []
}` }],
})
const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
const match = text.match(/\{[\s\S]*\}/)
if (!match) { console.warn(`  ⚠ No JSON for ${latinName}`); return null }
return JSON.parse(match[0]) as FunctionalData       // wrapped in try/catch → return null on parse fail
```

**Batch loop + 15s delay — COPY VERBATIM STRUCTURE** (`update-existing-plants.ts:177-230`):
```typescript
for (let i = 0; i < plants.length; i += CLAUDE_BATCH_SIZE) {
  const batch = plants.slice(i, i + CLAUDE_BATCH_SIZE)
  await Promise.all(batch.map(async plant => { /* enrich + per-field merge update */ }))
  const processed = Math.min(i + CLAUDE_BATCH_SIZE, plants.length)
  console.log(`  [${processed}/${plants.length}] updated ${updated} · skipped ${skipped} · failed ${failed}\n`)
  if (processed < plants.length) await sleep(CLAUDE_BATCH_DELAY_MS)
}
```

**Fatal-error tail — COPY VERBATIM** (`update-existing-plants.ts:238-241`):
```typescript
main().catch(err => { console.error('\nFatal error:', err); process.exit(1) })
```

**Targeting query (Pattern 1 — per-field skip, D-17) — DERIVED, not verbatim.**
Existing analogs all use AND-of-nulls (`.is(col,null).is(col2,null)...`, `update-existing-plants.ts:153-161`) or mixed not-null/null (`backfill-usda-zones.ts:121-123`). D-17 needs OR-of-nulls. Use Supabase `.or()` (RESEARCH A2, low risk):
```typescript
const TARGET_FIELDS = ['succession_role','establishment_difficulty','maintenance_level',
  'years_to_bearing','propagation_methods','edible_parts','harvest_months'] as const
// permaculture_uses is NOT in this list — D-01 RE-ENRICHES ALL ROWS (Pitfall 2)
const { data } = await supabase
  .from('plants')
  .select('id, common_name, latin_name, permaculture_uses, succession_role, establishment_difficulty, maintenance_level, years_to_bearing, propagation_methods, edible_parts, harvest_months')
  .or(TARGET_FIELDS.map(f => `${f}.is.null`).join(','))
  .order('common_name')
```

**Per-field merge update (the core D-17 logic — composed, see RESEARCH:363-376):**
```typescript
const update: Record<string, unknown> = {
  permaculture_uses: validArr(raw.permaculture_uses, FUNCTIONAL_ROLE_SET),  // D-01: ALWAYS overwrite
}
if (row.succession_role == null)          update.succession_role = validArr(raw.succession_role, SUCCESSION_SET)
if (row.establishment_difficulty == null) update.establishment_difficulty = normalizeEnum(raw.establishment_difficulty, VALID_DIFFICULTY)
if (row.maintenance_level == null)        update.maintenance_level = normalizeEnum(raw.maintenance_level, VALID_MAINT)
if (row.years_to_bearing == null)         update.years_to_bearing = Number.isInteger(raw.years_to_bearing) ? raw.years_to_bearing : null
if (row.propagation_methods == null)      update.propagation_methods = validArr(raw.propagation_methods, PROPAGATION_SET)
if (row.edible_parts == null)             update.edible_parts = validArr(raw.edible_parts, EDIBLE_SET)   // [] if non-edible
if (row.harvest_months == null)           update.harvest_months = validArr(raw.harvest_months, MONTH_SET)
if (Object.keys(update).length > 0) await supabase.from('plants').update(update).eq('id', row.id)
```
Empty-array idempotency convention from `backfill-native-states.ts:7-9,114`: write `[]` (not null) only on a deliberate "genuinely empty" decision so the row isn't re-queried; keep `NULL` on Claude failure so partial-failure reruns re-attempt (Pitfall 3).

---

### `scripts/enrich-functional-data.ts` `--verify` branch (D-18) — NO ANALOG

`grep -rl verify scripts/` → nothing. Net-new pattern. Design (read-only Supabase COUNT, npm passes flags after `--`):
```typescript
async function verify() {
  const REQUIRED = ['permaculture_uses','succession_role','establishment_difficulty',
    'maintenance_level','propagation_methods'] as const   // years_to_bearing EXEMPT (D-19);
                                                           // edible_parts/harvest_months: typed-present only (D-19)
  const { count: total } = await supabase.from('plants').select('id', { count: 'exact', head: true })
  let failed = false
  for (const f of REQUIRED) {
    const { count: ok } = await supabase.from('plants').select('id', { count: 'exact', head: true }).not(f, 'is', null)
    console.log(`  ${f}: ${ok}/${total} ${ok === total ? '✓' : '✗'}`)
    if (ok !== total) {
      failed = true
      const { data: bad } = await supabase.from('plants').select('id, common_name').is(f, null)
      bad?.forEach(p => console.log(`     ✗ ${p.common_name} (${p.id})`))
    }
  }
  process.exit(failed ? 1 : 0)
}
if (process.argv.includes('--verify')) { await verify() } else { await main() }
```
Line-format contract (CONTEXT.md Specifics): `functional_roles (permaculture_uses): 248/250 ✓`. Run via `npm run enrich-functional-data -- --verify`.

---

### `supabase/migrations/<timestamp>_add_functional_data_fields.sql` — NEW

**Analog:** `supabase/migrations/20260515024612_add_permaculture_fields.sql` (CHECK enum for single-value) + `20260515024611_add_plant_detail_fields.sql` (plain `ADD COLUMN`).

`...612` shows the exact CHECK idiom; `...611` the plain array/text pattern. Filename = 14-digit timestamp + `_add_functional_data_fields.sql`. Apply via `supabase db push` (CLAUDE.md).
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
```
ANTI-PATTERN: Do NOT re-add `forest_garden_layer` or `permaculture_uses` — already created by `...612` (would error). Arrays intentionally have NO DB CHECK (matches `permaculture_uses` precedent `...612:8`; D-discretion — array CHECK is awkward; validation lives in the script).

---

### `lib/types.ts` (model / type contract) — MODIFY

**Analog:** self — extend the `Plant` interface in place. Insert after `permaculture_uses: string[] | null` (`types.ts:31`), before `notable_cultivars` (`:32`). Column names MUST match the migration exactly.
```typescript
succession_role: string[] | null
establishment_difficulty: string | null
maintenance_level: string | null
years_to_bearing: number | null
propagation_methods: string[] | null
edible_parts: string[] | null
harvest_months: string[] | null
```
`forest_garden_layer: ForestGardenLayer | null` and `permaculture_uses: string[] | null` already exist (`:30-31`) — do NOT re-add. `ForestGardenLayer` (`:4`) is unchanged (D-08).

---

### `lib/plant-labels.ts` (config / constants) — MODIFY  ⚠ DATA HAZARD

**Analog:** self — same `export const NAME: string[] = [...]` shape as existing arrays (`:1-9`).

**DATA HAZARD (RESEARCH Pitfall 1, HIGH):** `plant-labels.ts:9` currently is the legacy 10-tag vocab:
```typescript
export const PERM_USE_OPTIONS: string[] = ['nitrogen fixer', 'dynamic accumulator', 'edible', 'medicinal', 'pollinator', 'biomass', 'windbreak', 'wildlife habitat', 'pioneer', 'insectary']
```
This CONFLICTS with the D-02 16-tag vocab (`pollinator`→`pollinator nectary`/`bee forage`; `biomass`→`biomass producer`; `wildlife habitat`→`wildlife benefit`; `insectary`→`insectary plant`; `pioneer` is DROPPED from roles — it is a `succession_role` value under D-09). The plan MUST include a discrete task to reconcile this (Open Question 1: replace contents in place; add `FUNCTIONAL_ROLE_OPTIONS` as canonical, alias `PERM_USE_OPTIONS = FUNCTIONAL_ROLE_OPTIONS` only if a grep finds importers — none found in detail page or scripts read so far; likely only the deferred v2 filter sidebar).

**New constants to add** (extend, do NOT inline in page — Phase 1 D-09; UI-SPEC:114):
```typescript
export const FUNCTIONAL_ROLE_OPTIONS: string[] = ['nitrogen fixer','dynamic accumulator','insectary plant','chop-and-drop','wildlife benefit','medicinal','fiber','groundcover','windbreak','pollinator nectary','bee forage','living mulch','biomass producer','erosion control','hedgerow','edible'] // D-02
export const SUCCESSION_OPTIONS: string[] = ['pioneer','early successional','mid successional','climax'] // D-09
export const ESTABLISHMENT_OPTIONS: string[] = ['easy','moderate','challenging'] // D-10
export const MAINTENANCE_OPTIONS: string[] = ['low','moderate','high'] // D-11
export const PROPAGATION_OPTIONS: string[] = ['seed','cutting','division','layering','grafting','root cutting','tuber','sucker'] // D-13
export const EDIBLE_PART_OPTIONS: string[] = ['leaf','fruit','nut','seed','root','flower','bark','sap','shoot','pod'] // D-14
// MONTH_OPTIONS already exists (:4) — REUSE for harvest_months calendar ordering (D-15)
```
Also add the 4 InfoCell label strings (UI-SPEC:107-114) as a label map/constants here, not inlined: `Forest Garden Layer`, `Establishment`, `Maintenance`, `Years to Bearing`.

---

### `app/(app)/plants/[id]/page.tsx` (RSC component) — MODIFY

**Analog:** self — the Permaculture `<section>` to replace is `:150-169`. Reuse the existing `InfoCell` component and pill markup byte-identically (UI-SPEC Component Inventory: reuse-only).

**`InfoCell` component — REUSE VERBATIM** (`page.tsx:9-16`, already defined, no change):
```typescript
function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-stone-white rounded-xl p-4">
      <p className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.05em] mb-1">{label}</p>
      <p className="text-sm text-dark-bark capitalize">{value}</p>
    </div>
  )
}
```

**Pill chip markup — REUSE BYTE-IDENTICAL** (`page.tsx:162-164`; UI-SPEC requires identical classes for all 5 new array fields):
```tsx
<span key={use} className="text-xs bg-terracotta/10 text-terracotta px-3 py-1.5 rounded-full border border-terracotta/20 capitalize">
  {use}
</span>
```

**Section wrapper + eyebrow + conditional guard — REUSE PATTERN** (`page.tsx:128-129, 140-141, 151-169`):
```tsx
{(plant.fieldA || plant.fieldB?.length) && (
  <section className="mb-8">
    <h2 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">SECTION TITLE</h2>
    {/* InfoCell grid: <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4"> */}
    {/* Pill row:      <div className="flex flex-wrap gap-2"> */}
  </section>
)}
```
Scalar-cell filter-Boolean idiom — copy `overviewCells` pattern (`page.tsx:34-45`): build `[ cond && {label,value}, ... ].filter(Boolean)`. Use `plant.years_to_bearing != null` NOT truthiness (Pitfall 4 — `0` falsy bug); render value as `${n} years` (UI-SPEC:114).

**DELETE** `page.tsx:150-169` (entire Permaculture block). **Notable Cultivars** (`:170-176`) stays AFTER the four new sections. **Do NOT change the Supabase query** (`page.tsx:22-26` `.select('*')` already returns new columns — RESEARCH anti-pattern).

**Four new sections, exact order** (D-05, UI-SPEC:94-103) — slot between Landscaping (`:148`) and Notable Cultivars (`:170`):
1. **Functional Roles** — `permaculture_uses` pills only. Guard: `plant.permaculture_uses?.length`.
2. **Forest Layer & Succession** — `forest_garden_layer` InfoCell + `succession_role` pills. Guard: `plant.forest_garden_layer || plant.succession_role?.length`. Per-field omit inside (UI-SPEC:124-125).
3. **Establishment & Care** — `establishment_difficulty` / `maintenance_level` / `years_to_bearing` InfoCells (filter-Boolean) + `propagation_methods` pills. Guard: any of the four present.
4. **Harvest** — `edible_parts` pills + `harvest_months` pills (months sorted by `MONTH_OPTIONS` calendar order — UI-SPEC:135 ordering contract; all other arrays render in stored order). Guard: `plant.edible_parts?.length || plant.harvest_months?.length`.

Full conditional-hide matrix: UI-SPEC:116-136 (executor display spec).

---

### `package.json` (config) — MODIFY

**Analog:** self — existing script entries `:10-17`. Add after `"update-plants"` (`:11`), mirroring its `tsx scripts/...` form:
```json
"enrich-functional-data": "tsx scripts/enrich-functional-data.ts"
```
`--verify` runs as `npm run enrich-functional-data -- --verify` (no separate entry needed; D-18 permits a companion script but flag-branch is preferred — RESEARCH A4).

---

## Shared Patterns

### Service-role Supabase client + env guard
**Source:** `scripts/update-existing-plants.ts:26-27, 65, 149-150` (identical in `backfill-native-states.ts:24-25,31,87-88`)
**Apply to:** `scripts/enrich-functional-data.ts`
```typescript
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)   // bypasses RLS for writes
if (!SERVICE_ROLE_KEY) throw new Error('... missing from .env.local')
```

### Enum / array vocabulary validation (D-03 drop-invalid)
**Source:** `scripts/update-existing-plants.ts:91-94` (single enum) + `scripts/backfill-native-states.ts:77` (array Set-filter)
**Apply to:** all Claude output before any UPDATE — single enums via `normalizeEnum`, arrays via Set `.filter()`. Invalid values silently dropped (D-03, V5 input-validation control).

### 10-per-batch / 15s-delay rate limit
**Source:** `scripts/update-existing-plants.ts:30-32, 177-230` (identical in `backfill-native-states.ts:28-29,106-131`)
**Apply to:** `scripts/enrich-functional-data.ts` — CLAUDE.md HARD RULE. Copy `CLAUDE_BATCH_SIZE=10`, `CLAUDE_BATCH_DELAY_MS=15000`, and the `for(i+=BATCH){ Promise.all; sleep }` loop verbatim. Never shorten.

### JSON-in-text extraction (NOT SDK tool-use)
**Source:** `scripts/update-existing-plants.ts:130-136`, `scripts/backfill-native-states.ts:72-77`
**Apply to:** `scripts/enrich-functional-data.ts` — `response.content[0].text` → `text.match(/\{[\s\S]*\}/)` → `JSON.parse`, wrapped in try/catch returning `null`. Anti-pattern: introducing Anthropic tool-calling / response_format (not used anywhere in repo; D-16 mandates this idiom).

### Botanical Heritage tokens (reuse-only display)
**Source:** `app/(app)/plants/[id]/page.tsx:9-16` (InfoCell), `:162-164` (pill), `tailwind.config.ts`
**Apply to:** all four new detail-page sections — byte-identical classes; no new colors/spacing/type roles (UI-SPEC PASS on all 6 dimensions; pill `py-1.5`/6px retained verbatim — do NOT "correct" to 8px).

## No Analog Found

| File / capability | Role | Data Flow | Reason |
|-------------------|------|-----------|--------|
| `--verify` subcommand branch | data-script (read-only report) | aggregate COUNT | `grep -rl verify scripts/` returned nothing — net-new pattern; design specified in Pattern 3 / RESEARCH:221-247 (read-only Supabase counts, exit codes per D-18/19). MEDIUM confidence — straightforward but unprecedented. |

Note: the OR-of-nulls per-field targeting (Pattern 1) has no exact analog (existing scripts use AND-of-nulls or mixed not-null/null) but is a low-risk `.or()` derivation (RESEARCH A2); the per-field merge update is composed from `update-existing-plants.ts:190-212` + `backfill-native-states.ts:77`.

## Metadata

**Analog search scope:** `scripts/`, `supabase/migrations/`, `lib/`, `app/(app)/plants/[id]/`, `package.json` (all cited in RESEARCH Sources, read in full this session)
**Files scanned/read:** `scripts/update-existing-plants.ts` (1-242), `scripts/backfill-native-states.ts` (1-139), `scripts/backfill-usda-zones.ts` (115-129), `app/(app)/plants/[id]/page.tsx` (1-181), `lib/types.ts` (1-55), `lib/plant-labels.ts` (1-11), `supabase/migrations/20260515024612` + `...611`, `package.json` (1-39), CONTEXT/RESEARCH/UI-SPEC
**Pattern extraction date:** 2026-05-18
