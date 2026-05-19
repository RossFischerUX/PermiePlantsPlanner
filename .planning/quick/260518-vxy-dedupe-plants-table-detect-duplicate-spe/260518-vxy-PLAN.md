---
quick_id: 260518-vxy
type: execute
autonomous: false
files_modified:
  - scripts/dedupe-plants.ts
  - package.json
  - CLAUDE.md
user_setup:
  - service: supabase
    why: "Script writes to the live production plants / plant_list_items tables"
    env_vars:
      - name: SUPABASE_SECRET_KEY
        source: "Supabase Dashboard → Project Settings → API (or SUPABASE_SERVICE_ROLE_KEY)"
      - name: NEXT_PUBLIC_SUPABASE_URL
        source: "Supabase Dashboard → Project Settings → API"
---

<objective>
De-duplicate the live Supabase `plants` table. The catalog (~1716 rows) has multiple
rows for the same species (confirmed during phase-2 enrichment — e.g. duplicate
"Alfalfa (Medicago sativa)", "Ajuga (Ajuga reptans)"). Collapse each species group to a
single canonical row (the most-enriched one), repointing any `plant_list_items`
references first so no user list loses a plant.

Purpose: A clean 1-row-per-species catalog before Phase 2 gap closure runs — duplicate
rows skew enrichment coverage counts and surface duplicates in the plant browser.

Output:
- `scripts/dedupe-plants.ts` — dry-run report by default, `--apply` for the destructive path
- `package.json` script `dedupe-plants`
- CLAUDE.md doc line for the new script
- A clean catalog (post-apply: zero duplicate species groups)

⚠ DESTRUCTIVE ON PRODUCTION DATA. The dry-run report is human-reviewed and explicitly
approved (Task B, blocking checkpoint) BEFORE any deletion runs (Task C).

Sequencing note: Run this BEFORE Phase 2 gap closure. Local commits only — do NOT push
and do NOT trigger a deploy.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@lib/types.ts
@scripts/enrich-functional-data.ts

<interfaces>
<!-- Canonical service-role client + pagination pattern. Mirror this exactly. -->

From scripts/enrich-functional-data.ts:
```typescript
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// PostgREST caps a single response at 1000 rows; catalog is ~1716. MUST paginate:
const PAGE_SIZE = 1000
for (let page = 0; ; page++) {
  const { data, error } = await supabase
    .from('plants')
    .select('...')
    .order('common_name')
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
  if (error) throw new Error(error.message)
  const rows = data ?? []
  // accumulate...
  if (rows.length < PAGE_SIZE) break
}
```

Functional fields used to score "most enriched" (count non-null scalars AND
non-empty arrays), from lib/types.ts Plant interface:
`permaculture_uses` (string[]), `succession_role` (string[]),
`establishment_difficulty` (string), `maintenance_level` (string),
`propagation_methods` (string[]), `edible_parts` (string[]),
`harvest_months` (string[]), `years_to_bearing` (number),
`forest_garden_layer` (string). Tiebreak: oldest `created_at`.

FK / schema facts (from supabase/migrations/20260515024609_create_plant_lists_table.sql):
- `plant_list_items.plant_id → plants(id)` has **NO ON DELETE CASCADE** → deleting a
  referenced plant FAILS with an FK violation. References MUST be repointed first.
- There is **NO unique constraint** on `plant_list_items(list_id, plant_id)`. "Redundant
  join row" must be detected in-app: a dupe row is redundant if the same `list_id`
  already has a row pointing at the canonical plant. In that case DELETE the dupe's
  join row instead of repointing it (avoids a double entry in the user's list).
- Service-role client bypasses RLS, so cross-user `plant_list_items` writes are allowed.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task A: Create scripts/dedupe-plants.ts (dry-run report by default)</name>
  <files>scripts/dedupe-plants.ts, package.json, CLAUDE.md</files>
  <action>
Create `scripts/dedupe-plants.ts`. Mirror the service-role client + `.env.local`
dotenv load + `.range()` pagination from `scripts/enrich-functional-data.ts` (see
`<interfaces>`). Throw early if `SERVICE_ROLE_KEY` or `SUPABASE_URL` is missing.

Argv flags:
- (default, no flags) = DRY-RUN: report only, NO writes of any kind.
- `--apply` = destructive path (implemented in Task C; in Task A leave a guarded
  branch that calls an `apply()` function — stub it to `throw new Error('apply not
  implemented')` for now so the dry-run path is fully testable in isolation).
- `--report-json <path>` = additionally write the full computed plan as JSON to
  `<path>` (so Task C's apply can consume the exact same grouping/canonical
  decisions). Parse the path as the argv token following `--report-json`.

Fetch ALL plant rows with pagination (PAGE_SIZE 1000), selecting:
`id, common_name, latin_name, created_at, permaculture_uses, succession_role,
establishment_difficulty, maintenance_level, propagation_methods, edible_parts,
harvest_months, years_to_bearing, forest_garden_layer`. Order by `latin_name`.

Species identity key (sameness): normalize `latin_name` — trim, collapse internal
whitespace to single spaces, lowercase. That normalized string is the PRIMARY group
key. If `latin_name` is null/empty after normalization, fall back to the same
normalization on `common_name` as the group key. Group rows by this key. A group
with >1 row is a duplicate group.

Enrichment score per row = count of fields that are "present": a scalar field is
present if non-null and (for strings) non-empty after trim; an array field is
present if it is a non-empty array. Score across the 9 functional fields listed in
`<interfaces>`. Canonical row = highest score; tiebreak = oldest `created_at`
(ascending); final tiebreak = lexicographically smallest `id` (stable/deterministic).

Fetch all `plant_list_items` (paginated, select `id, list_id, plant_id`) so the
report can flag which dupe rows are referenced. For each duplicate group, compute:
canonical id, the list of dupe ids, and for each dupe id the join rows referencing
it (id + list_id).

Print to stdout:
- total plant rows, total group count, duplicate group count, total dupe rows
  (rows that would be deleted = sum over groups of (group size − 1)),
- count of dupe rows referenced by `plant_list_items` and total referencing join rows,
- a sample of up to 15 duplicate groups: normalized key, canonical
  `id` + common_name, dupe ids, and per dupe whether/how many join rows reference it.

If `--report-json <path>` given, write `{ generatedAt, totalRows, groups: [{ key,
canonicalId, dupeIds, references: [{ joinRowId, listId, dupePlantId }] }] }` to that
path (use `fs.writeFileSync`, `JSON.stringify(.., null, 2)`).

End the dry-run cleanly (no `process.exit` needed on success; mirror the script's
existing error-handling entry-point pattern with `.catch(err => { console.error(...);
process.exit(1) })`).

Add to `package.json` "scripts": `"dedupe-plants": "tsx scripts/dedupe-plants.ts"`.

Add a doc line under the CLAUDE.md "Data Import Scripts" code block, matching the
existing `npm run ...  # description` two-space-aligned style:
`npm run dedupe-plants          # de-dupe plants table (DRY-RUN; --apply to write)`
  </action>
  <verify>
    <automated>cd /Users/rossfischer/Desktop/Development/plantmaster-clone && npx tsc --noEmit && npm run lint && npm run dedupe-plants 2>&1 | grep -Eiq 'duplicate group|dupe row|total .*rows'</automated>
  </verify>
  <done>
`scripts/dedupe-plants.ts` exists; tsc and lint pass; `npm run dedupe-plants`
(no flags) connects to the live DB, prints a coherent dry-run report (totals +
sample groups) and writes ZERO changes; `--report-json` writes a valid JSON plan;
`package.json` has the `dedupe-plants` script; CLAUDE.md has the doc line.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
A dry-run de-dupe report script. It reads the entire live `plants` catalog and the
`plant_list_items` join table (read-only), groups rows by normalized species
identity, picks the most-enriched canonical row per group, and reports exactly how
many rows would be deleted and which user-list references would be repointed —
without writing anything.
  </what-built>
  <how-to-verify>
1. Run: `cd /Users/rossfischer/Desktop/Development/plantmaster-clone && npm run dedupe-plants -- --report-json /tmp/dedupe-plan.json`
2. Read the printed report. Sanity-check:
   - Total plant rows ≈ 1716 (catalog scale).
   - Duplicate group count and total dupe rows are plausible (the species you
     reported — Alfalfa / Medicago sativa, Ajuga / Ajuga reptans — appear as groups).
   - The canonical row chosen for spot-checked groups is the more-enriched one.
   - The count of dupe rows referenced by `plant_list_items` looks reasonable
     (likely small; most dupes are unreferenced).
3. Optionally inspect `/tmp/dedupe-plan.json` for the full plan.
4. This will PERMANENTLY DELETE the dupe rows in Task C. Confirm the scope is
   correct before approving.
  </how-to-verify>
  <resume-signal>Type "approved" to proceed to the destructive apply (Task C), or describe scope changes needed.</resume-signal>
</task>

<task type="auto">
  <name>Task C: Implement and run the destructive --apply path</name>
  <files>scripts/dedupe-plants.ts</files>
  <action>
Replace the Task-A `apply()` stub with the real destructive path. `apply()` MUST
recompute the grouping/canonical decisions from a fresh DB read (do NOT trust a
stale `--report-json`; recomputing keeps the script idempotent and re-runnable —
if some groups were already collapsed by a prior partial run, they simply won't
appear as duplicate groups the second time).

Safe ordering, per duplicate group, using the service-role client:

1. For each dupe row `d` in the group (every non-canonical row):
   a. Find all `plant_list_items` rows where `plant_id = d.id`.
   b. For each such join row `j`: check whether `j.list_id` ALREADY has a join row
      whose `plant_id = canonical.id` (query `plant_list_items` filtered by
      `list_id = j.list_id` and `plant_id = canonical.id`, OR build an in-memory
      set of `(list_id, plant_id)` pairs once up front and consult it, keeping it
      updated as you repoint). If the canonical plant is ALREADY in that list →
      DELETE join row `j` (it would be a redundant double entry). Otherwise →
      UPDATE `j` SET `plant_id = canonical.id`.
2. Only AFTER every dupe row in the group has zero remaining `plant_list_items`
   references, DELETE the dupe plant rows (`plants` where `id` in the group's
   dupe ids). Deleting before repointing FAILS — the FK has no ON DELETE CASCADE.

Track and accumulate: rows before, references repointed (UPDATE count), redundant
join rows deleted (DELETE-on-conflict count), plant rows deleted. Handle Supabase
errors per operation (log + continue or abort the group; do not leave a plant row
deleted with a dangling reasoning — repoint failures must prevent that group's
plant deletes).

After all groups processed, re-run the dry-run analysis (call the same grouping
function against a fresh read) and assert ZERO duplicate groups remain; print a
final summary block:
`rows before / rows after / references repointed / redundant join rows deleted /
duplicate plant rows deleted / duplicate groups remaining (must be 0)`.
Exit non-zero if duplicate groups remain after apply.

Then RUN it: `npm run dedupe-plants -- --apply` against the live DB.
Do NOT git push and do NOT deploy.
  </action>
  <verify>
    <automated>cd /Users/rossfischer/Desktop/Development/plantmaster-clone && npx tsc --noEmit && npm run lint && npm run dedupe-plants 2>&1 | grep -Eiq 'duplicate group(s)? *: *0|0 duplicate groups'</automated>
  </verify>
  <done>
`--apply` ran against production: references repointed (or redundant join rows
deleted where the canonical plant was already in the list), then duplicate plant
rows deleted in that order. Post-apply dry-run reports ZERO duplicate species
groups. Final summary printed (before/after counts). Script is idempotent —
re-running `--apply` is a safe no-op. No git push, no deploy. tsc + lint pass.
  </done>
</task>

</tasks>

<verification>
- `scripts/dedupe-plants.ts` runs in dry-run mode with zero writes and a coherent report.
- Blocking human checkpoint occurred and was explicitly approved before any deletion.
- Post-apply dry-run reports 0 duplicate species groups.
- Spot SQL sanity (optional manual): in Supabase SQL editor,
  `SELECT lower(trim(latin_name)) k, count(*) c FROM plants GROUP BY 1 HAVING count(*) > 1;`
  returns zero rows.
- No `plant_list_items` row points at a deleted plant id (no dangling FK).
- No `git push`, no deployment triggered. Local commits only.
</verification>

<success_criteria>
- One canonical row per species in the live `plants` catalog (zero duplicate groups).
- Every user-list reference to a removed duplicate was preserved by repointing to the
  canonical plant, or de-duplicated where the list already contained the canonical plant.
- Script is idempotent / safely re-runnable.
- Ran before Phase 2 gap closure; production unchanged except the intended de-dup.
</success_criteria>

<output>
Create `.planning/quick/260518-vxy-dedupe-plants-table-detect-duplicate-spe/260518-vxy-SUMMARY.md` when done.
</output>
