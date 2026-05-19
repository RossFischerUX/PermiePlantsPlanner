---
phase: 02-functional-data-enrichment
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - app/(app)/plants/[id]/page.tsx
  - lib/plant-labels.ts
  - lib/types.ts
  - scripts/enrich-functional-data.ts
  - supabase/migrations/20260518192238_add_functional_data_fields.sql
  - tests/plants.spec.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 02: Code Review Report (Re-review after gap-closure 02-04 / D-20)

**Reviewed:** 2026-05-19
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

This is a re-review following gap-closure plan 02-04 (decision D-20). The previously-flagged
CR-02 (skip path writing `{}` and locking rows) is **confirmed closed**: the no-Claude-data
branch (`scripts/enrich-functional-data.ts:230-257`) now normalizes empty arrays in the three
required-array fields to `NULL`, and the verify gate (`verify():366-438`) hard-fails only on
residual `{}` rows while accepting `NULL` as a reviewed informational residual. The targeting
OR-clause correctly includes empty-array re-selection terms, and the per-field merge guards
correctly treat `[]` like `null` for the array fields. No blocking defects remain.

The remaining findings are correctness-adjacent edge cases and quality issues. The most
substantive is a real ordering bug in harvest-month display caused by a casing mismatch
between the validator and the stored value (WR-01), and a test that is tightly coupled to
mutable live-DB enrichment state (WR-02).

## Warnings

### WR-01: harvest_months stored with Claude's raw casing breaks calendar sort on detail page

**File:** `scripts/enrich-functional-data.ts:77-80, 296` and `app/(app)/plants/[id]/page.tsx:223`

**Issue:** `validArr` validates membership case-insensitively (`allow.has(s.toLowerCase())`)
but returns the **original** string `s` — Claude's casing, not the canonical vocabulary
casing. `MONTH_SET` is built from `MONTH_OPTIONS` lowercased, so a Claude response of
`"january"` (or `"JANUARY"`) passes validation and is persisted verbatim as `"january"`.
The detail page then sorts harvest pills with
`MONTH_OPTIONS.indexOf(a) - MONTH_OPTIONS.indexOf(b)` where `MONTH_OPTIONS` is
`['January', ...]`. `indexOf("january")` returns `-1`, so any off-canonical-case month sorts
to the front and the calendar ordering (the entire point of D-15's reuse of `MONTH_OPTIONS`)
silently breaks. CSS `capitalize` masks the visual symptom (still renders "January") so this
will not be caught by eye. Same latent casing inconsistency affects `succession_role`,
`propagation_methods`, `edible_parts`, `permaculture_uses`, but those are display-only with
no order dependency, so the impact is contained to harvest_months.

**Fix:** Normalize to the canonical vocabulary casing on write. In `validArr`, map matches
back to the canonical option rather than echoing the input:
```ts
const validArr = (arr: unknown, options: readonly string[]): string[] => {
  if (!Array.isArray(arr)) return []
  const byLower = new Map(options.map(o => [o.toLowerCase(), o]))
  return arr.flatMap(s =>
    typeof s === 'string' && byLower.has(s.toLowerCase()) ? [byLower.get(s.toLowerCase())!] : []
  )
}
```
Pass the option arrays (not pre-lowered Sets) at the call sites. Alternatively, make the
detail-page sort case-insensitive, but normalizing on write is the durable fix and keeps
stored data canonical for any future consumer.

### WR-02: Forest Layer & Succession test asserts against mutable live-DB enrichment state

**File:** `tests/plants.spec.ts:311-322`

**Issue:** This assertion was made unconditional in 02-04 (IN-04). It hard-asserts
`forestSection.locator('span.rounded-full').first()` is visible for `invasivePlantId`
(common ivy), with a comment claiming the fixture "deterministically has
`succession_role: ["pioneer","early successional"]` post-D-20 enrichment." The detail page
only renders a pill when `plant.succession_role?.length` is truthy
(`app/(app)/plants/[id]/page.tsx:171-177`). But D-20's own design explicitly allows
`succession_role` to be `NULL` as an "accepted informational residual" — and the skip path
(`enrich-functional-data.ts:236-237`) actively normalizes that field to `NULL` on any Claude
failure. So the test's invariant ("this specific row always has succession pills") is not
guaranteed by the schema or the enrichment contract; it depends on the current row state of
the **production** Supabase the suite targets. A future re-enrichment run where Claude
returns no valid succession tags for common ivy will set the field to `NULL`, hide the
section's pills, and turn this into a false-failing test with no code regression. The test
also has no `forest_garden_layer` fallback assertion even though the section can render on
that field alone.

**Fix:** Decouple from a single mutable fixture. Either (a) assert the weaker, contract-true
invariant — the section renders when *either* `forest_garden_layer` or `succession_role`
has data, walking cards until one such plant is found — or (b) assert the section's
*conditional-hide* behavior (present-with-content OR absent) the way the Harvest test at
`tests/plants.spec.ts:338-350` already does. Do not couple a hard assertion to a specific
production row's enrichment value.

### WR-03: enrichWithClaude only inspects the first content block

**File:** `scripts/enrich-functional-data.ts:135-146`

**Issue:** `const block = response.content[0]` assumes the JSON is always in the first
content block. If the model emits any leading non-text block (or the SDK returns the answer
in a later block), `block.type === 'text'` is false, `text` is `''`, and the function
returns `null` — which the caller treats as a Claude failure and (post-D-20) normalizes the
row's arrays to `NULL`. The row is silently skipped despite a usable response potentially
being present, wasting an API call and a rate-limit slot, and degrading coverage. This is a
robustness gap, not a crash.

**Fix:** Concatenate all text blocks before extracting JSON:
```ts
const text = response.content
  .filter((b): b is Anthropic.TextBlock => b.type === 'text')
  .map(b => b.text)
  .join('')
  .trim()
```

### WR-04: verify() has no per-field accounting invariant — silent gaps possible

**File:** `scripts/enrich-functional-data.ts:366-438`

**Issue:** For each required-array field the gate independently counts `okCount`
(`not is null AND neq '{}'`), `emptyCount` (`eq '{}'`), and `nullCount` (`is null`). It
never asserts `okCount + emptyCount + nullCount === total`. PostgREST array equality on
`'{}'` is the only "empty" form checked; any row whose array is neither NULL, nor exactly
`{}`, nor real vocabulary data (e.g. a malformed literal, or a single whitespace element
that slipped past validation) is counted in `okCount` and reported as "✓" — coverage looks
complete while the data is bad. The gate's honesty guarantee (the whole point of D-20)
rests on an unverified partition.

**Fix:** After the three counts, assert the partition and fail loudly on mismatch:
```ts
if ((okCount ?? 0) + (emptyCount ?? 0) + (nullCount ?? 0) !== total) {
  console.error(`  ✗ ${f}: count partition mismatch — possible malformed rows`)
  failed = true
}
```

## Info

### IN-01: Magic number `200` upper bound for years_to_bearing

**File:** `scripts/enrich-functional-data.ts:287`

**Issue:** `y > 0 && y <= 200` hard-codes an unexplained sanity ceiling. The intent (reject
hallucinated absurd values) is reasonable but the constant is undocumented.

**Fix:** Hoist to a named constant with a one-line rationale, e.g.
`const MAX_YEARS_TO_BEARING = 200 // reject model hallucinations; oldest fruiting trees ~century-scale`.

### IN-02: Greedy JSON extraction regex can over-capture

**File:** `scripts/enrich-functional-data.ts:141`

**Issue:** `text.match(/\{[\s\S]*\}/)` is greedy and will span from the first `{` to the
**last** `}` in the response. If the model emits any prose containing braces around the JSON
object, the captured slice is not valid JSON. The `JSON.parse` is wrapped in try/catch so
the failure mode is a clean `null` (no crash), but it converts recoverable responses into
skips. Low impact given the strict prompt, but brittle.

**Fix:** Prefer a non-greedy/balanced extraction, or attempt `JSON.parse(text)` first and
fall back to the regex only on failure.

### IN-03: Validator API asymmetry — normalizeEnum takes arrays, validArr takes Sets

**File:** `scripts/enrich-functional-data.ts:62-80, 281-296`

**Issue:** `normalizeEnum(value, ESTABLISHMENT_OPTIONS as readonly string[])` takes the
option array directly, while `validArr(raw.x, FUNCTIONAL_ROLE_SET)` takes a pre-built
lowercased Set. Two parallel validation idioms for the same "validate against controlled
vocabulary" concern increases cognitive load and is the root enabler of WR-01 (the Set form
discards canonical casing). Consider unifying both on the option arrays (see WR-01 fix).

### IN-04: Duplicated empty-array merge guard repeated across fields

**File:** `scripts/enrich-functional-data.ts:276, 289` (and skip path 236-241)

**Issue:** The pattern
`plant.X == null || (Array.isArray(plant.X) && plant.X.length === 0)` is hand-repeated for
`succession_role` and `propagation_methods`, and the inverse `Array.isArray(x) && x.length === 0`
is repeated three times in the skip path. A small helper
(`const isEmptyOrNull = (v: unknown) => v == null || (Array.isArray(v) && v.length === 0)`)
would remove the duplication and reduce the chance of the two lists drifting out of sync
(they must stay aligned with `REQUIRED_ARRAY` in `verify()`).

### IN-05: Stale `forest_garden_layer` field not part of this migration but rendered conditionally

**File:** `app/(app)/plants/[id]/page.tsx:163-179`, `lib/types.ts:30`

**Issue:** Not a defect — noting for traceability. `forest_garden_layer` is defined in the
earlier `20260515024612_add_permaculture_fields.sql` migration, not the phase-02 migration
under review, but the phase-02 detail-page section ("Forest Layer & Succession") depends on
it and on `succession_role`. The cross-migration coupling is correct; flagged only so the
reviewer/fixer is aware the section spans two migrations when reasoning about WR-02.

---

_Reviewed: 2026-05-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
