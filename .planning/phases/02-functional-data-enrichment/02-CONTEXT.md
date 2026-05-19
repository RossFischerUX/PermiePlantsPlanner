# Phase 2: Functional Data Enrichment - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Every plant in the database gains structured functional data across four dimensions, populated via a Claude Haiku enrichment pipeline and surfaced on the plant detail page:

- **DATA-01** — functional role tags (controlled vocabulary, normalized into the existing `permaculture_uses` array)
- **DATA-02** — forest layer (existing `forest_garden_layer`) + succession role (new)
- **DATA-03** — establishment & care: propagation methods, establishment difficulty, years to bearing, maintenance level
- **DATA-04** — edible parts + approximate harvest months
- **DATA-05** — enrichment pipeline with per-field skip-if-populated guard and an independent post-run verification report

"Filterable" in this phase means **the data is structured and query-ready** — no new filter UI is built in the plant browser. Filter sidebar controls for these fields (SRCH-02) remain v2.

</domain>

<decisions>
## Implementation Decisions

### Functional Role Taxonomy (DATA-01)
- **D-01:** Reuse and normalize the existing `permaculture_uses TEXT[]` column to a controlled vocabulary — do **not** add a new `functional_roles` column. Existing ~250 rows are re-enriched to conform to the vocabulary (free-form legacy values normalized/replaced).
- **D-02:** Controlled vocabulary (16 tags), validated against Claude output the same way `VALID_SUN`/`VALID_WATER` are enforced in `update-existing-plants.ts`:
  `nitrogen fixer`, `dynamic accumulator`, `insectary plant`, `chop-and-drop`, `wildlife benefit`, `medicinal`, `fiber`, `groundcover`, `windbreak`, `pollinator nectary`, `bee forage`, `living mulch`, `biomass producer`, `erosion control`, `hedgerow`, `edible`.
- **D-03:** A plant may carry multiple role tags (array). Unknown/invalid tags returned by Claude are dropped (not stored), mirroring existing enum-validation behavior.

### Filter UI Scope
- **D-04:** Phase 2 ships **schema + detail-page display + enrichment pipeline only**. No new filter controls in the plant browser sidebar. Filter UI for role/layer/succession/edible is deferred to SRCH-02 (v2) — consistent with the existing v1/v2 split in REQUIREMENTS.md.

### Detail Page Presentation
- **D-05:** Add **dedicated sections** to `app/(app)/plants/[id]/page.tsx`: `Functional Roles`, `Forest Layer & Succession`, `Establishment & Care`, `Harvest`. The current generic "Permaculture" section is retired/absorbed (its `forest_garden_layer` + `permaculture_uses` content moves into the new dedicated sections).
- **D-06:** Array/tag fields (functional roles, edible parts, succession role, propagation methods) render as Botanical Heritage `rounded-full` pills (consistent with the existing `permaculture_uses` chip rendering). Scalar fields (establishment difficulty, maintenance level, years to bearing, forest layer) render as `InfoCell` label-value rows.
- **D-07:** Section header styling follows the existing detail-page pattern (`text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em]`). New sections slot after Landscaping and before Notable Cultivars; empty/null fields are conditionally hidden (same `&&` guard pattern already used for the Permaculture section).

### Field Shapes (DATA-02 / DATA-03 / DATA-04)
- **D-08:** `forest_garden_layer` — unchanged (existing enum: canopy / sub-canopy / shrub / herb / ground cover / rhizosphere / climber).
- **D-09:** `succession_role` → **`TEXT[]`** (a plant may span multiple stages, e.g., `[pioneer, early successional]`). Vocabulary: `pioneer | early successional | mid successional | climax`.
- **D-10:** `establishment_difficulty` → single enum: `easy | moderate | challenging`.
- **D-11:** `maintenance_level` → single enum: `low | moderate | high`.
- **D-12:** `years_to_bearing` → `INTEGER | null` — the typical earliest bearing year for food plants; `null` for non-food plants (range nuance lives in description prose, not this field).
- **D-13:** `propagation_methods` → `TEXT[]`: `seed | cutting | division | layering | grafting | root cutting | tuber | sucker`.
- **D-14:** `edible_parts` → `TEXT[]`: `leaf | fruit | nut | seed | root | flower | bark | sap | shoot | pod`. Empty array = not edible.
- **D-15:** `harvest_months` → `TEXT[]` using the **same month-name format as the existing `bloom_months`** column (reuse any existing month display/ordering helpers).

### Enrichment Pipeline & Verification (DATA-05)
- **D-16:** Create a **new dedicated script** `scripts/enrich-functional-data.ts` (plus an npm script entry) focused only on the Phase-2 fields. Reuse the batch size (10), 15s batch delay, structured-output interface, and enum-validation patterns from `scripts/update-existing-plants.ts`. Do not extend `update-existing-plants.ts`.
- **D-17:** **Per-field** skip-if-populated guard: for each row, enrich only the Phase-2 fields that are currently null/empty; leave already-populated fields untouched. Supports safe reruns and incremental backfill after partial failures.
- **D-18:** DATA-05 verification is a **`--verify` subcommand (or companion script) producing an independent pass/fail coverage report** — counts non-null coverage per field across all plants (e.g., `succession_role: 248/248 ✓`), prints per-field results, and exits non-zero if any required field is null for the enriched set. Re-runnable without re-running enrichment.
- **D-19:** "The enriched set" for verification = all plant rows the pipeline targets (the full catalog of ~250 plants). `years_to_bearing` is exempt from the non-null assertion (legitimately null for non-food plants); `edible_parts`/`harvest_months` may be empty arrays for non-edible plants — verification asserts the column is present/typed, not non-empty, for those.

### Required-Array Field Semantics (D-20, supersedes implicit D-19 assumption)
- **D-20:** For the three required-array fields — `succession_role`, `permaculture_uses`, and `propagation_methods` — a controlled-vocabulary field that genuinely does not apply to a plant is written as `NULL`, never as `{}` (empty array). `NULL` is an accepted, explicitly-reviewed terminal state (re-targetable by the enrichment script on future runs); `{}` is the dishonest "sticky failure" state that is never acceptable. The `--verify` gate HARD-FAILS (exits 1) only when any of these fields equals `{}`. It prints `NULL` rows as an **informational residual** (ids + common_names) without failing — `NULL` represents plants where Claude's controlled vocabulary genuinely does not apply (e.g., toxic invasives with no functional permaculture role, non-successional sterile ornamentals, spore-propagated plants outside the 8-method propagation vocab). `establishment_difficulty` and `maintenance_level` retain strict non-null (scalar enums, no empty-array concept). `edible_parts` and `harvest_months` retain D-19 typed-presence semantics (empty arrays remain valid for non-edible plants; not forced to null). This decision supersedes the implicit "every plant has non-empty required-array data" assumption from D-19's original `~250`-row catalog estimate — the de-duplicated 1455-row catalog now includes non-successional ornamentals (Variegated Croton), toxic invasives with no functional permaculture role (poison hemlock, jimsonweed), and spore-propagated plants outside the 8-method propagation vocabulary (Spinulum annotinum / interrupted clubmoss).

### Claude's Discretion
- Exact migration file name and column ordering (follow `supabase/migrations/` timestamped convention; mirror the `add_permaculture_fields` migration style with `CHECK` constraints for single-value enums where practical).
- Exact pill/InfoCell component reuse and any shared display constants — extend `lib/plant-labels.ts` (established in Phase 1 as the extensible label/icon home) rather than inlining new maps.
- Claude Haiku prompt wording and structured-output schema details, as long as outputs are validated against the vocabularies in D-02/D-09..D-15.
- Whether succession-role / edible-parts use `TEXT[]` plain columns vs. `CHECK`-constrained — Postgres array CHECK is awkward; app-layer + script-layer validation is acceptable (matches existing `permaculture_uses` which has no DB CHECK).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Roadmap
- `.planning/REQUIREMENTS.md` — DATA-01 through DATA-05 (the requirements this phase satisfies); confirms SRCH-02 filter UI is v2 (informs D-04 scope boundary).
- `.planning/ROADMAP.md` — Phase 2 goal and success criteria.

### Existing Schema & Types
- `lib/types.ts` — `Plant` interface, `ForestGardenLayer` type. New fields must be added here; `forest_garden_layer` and `permaculture_uses` already present.
- `supabase/migrations/20260515024612_add_permaculture_fields.sql` — pattern for adding permaculture columns (`forest_garden_layer` CHECK enum, `permaculture_uses TEXT[]`). Mirror this style.
- `supabase/migrations/20260515024611_add_plant_detail_fields.sql` — pattern for plain `ALTER TABLE … ADD COLUMN` detail fields.

### Enrichment Pipeline Pattern
- `scripts/update-existing-plants.ts` — reference implementation for the new script: Claude Haiku client setup, `CLAUDE_BATCH_SIZE=10`, `CLAUDE_BATCH_DELAY_MS=15000`, structured-output interface, `VALID_SUN`/`VALID_WATER`/`VALID_TYPE` enum-validation pattern, service-role Supabase client, null-field targeting query.
- `scripts/backfill-native-states.ts`, `scripts/backfill-usda-zones.ts` — additional idempotent backfill patterns (skip-if-populated precedent).
- `CLAUDE.md` § Data Import Scripts — rate-limit rule (10 calls / 15s, do not remove the delay), npm script naming convention.

### Detail Page & Design System
- `app/(app)/plants/[id]/page.tsx` — current section structure (Plant Overview / Landscaping / Permaculture / Notable Cultivars), `InfoCell` component, conditional-render guards, existing `permaculture_uses` pill rendering (~lines 94–175). Read before modifying.
- `lib/plant-labels.ts` — extensible label/icon constants home (established Phase 1, D-09); new field display labels go here.
- `.stitch/DESIGN.md` and `tailwind.config.ts` — Botanical Heritage tokens; pills are `rounded-full`, section eyebrows `text-warm-stone uppercase tracking-[0.06em]`.

### Phase 1 Carry-Forward
- `.planning/phases/01-server-side-filtering/01-CONTEXT.md` — D-09 established `lib/plant-labels.ts` as extensible specifically anticipating Phase 2's new fields.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/update-existing-plants.ts` — copyable scaffolding for `enrich-functional-data.ts` (Anthropic + Supabase clients, batching, sleep helper, enum validators).
- `permaculture_uses` pill rendering in `app/(app)/plants/[id]/page.tsx` — reuse the same chip markup for the new tag/array fields.
- `InfoCell` component (detail page) — reuse for scalar fields (difficulty, maintenance, years to bearing).
- `bloom_months` format + any month helpers — `harvest_months` reuses this exactly (D-15).
- `lib/plant-labels.ts` — extend with display labels for new fields.

### Established Patterns
- Enum validation: Claude output checked against `VALID_*` const arrays; invalid values discarded before UPDATE (apply to the 16-tag role vocab + new enums).
- Idempotent backfill: target rows where target fields are null; safe to rerun (D-17 per-field variant).
- Conditional section render on detail page: `{(plant.fieldA || plant.fieldB?.length) && (<section>…)}`.
- Migrations: timestamped `supabase/migrations/*.sql`; single-value enums use Postgres `CHECK (col IN (...))`; arrays are plain `TEXT[]` with app/script validation.

### Integration Points
- `lib/types.ts` `Plant` interface — add: `succession_role: string[] | null`, `establishment_difficulty: string | null`, `maintenance_level: string | null`, `years_to_bearing: number | null`, `propagation_methods: string[] | null`, `edible_parts: string[] | null`, `harvest_months: string[] | null` (exact naming at planner discretion but must match migration).
- New migration in `supabase/migrations/` adds the columns; applied via `supabase db push`.
- `app/(app)/plants/[id]/page.tsx` — new dedicated display sections (only consumer this phase; no plant-browser changes).
- `package.json` scripts — add `enrich-functional-data` (+ verify) following existing `import-plants`/`update-plants` naming.

</code_context>

<specifics>
## Specific Ideas

- Detail-page sections, in order: Plant Overview → Landscaping → **Functional Roles** → **Forest Layer & Succession** → **Establishment & Care** → **Harvest** → Notable Cultivars. The old standalone "Permaculture" section is removed; its content is redistributed into Functional Roles (roles) and Forest Layer & Succession (layer).
- Verification report line format example: `functional_roles (permaculture_uses): 248/250 ✓` / non-zero exit listing the offending plant ids when a required field is null.
- `years_to_bearing` shown only when non-null; non-food plants simply omit the row.
- `edible_parts` empty array → no Harvest "edible parts" pills (and likely no Harvest section if both edible_parts and harvest_months are empty).

</specifics>

<deferred>
## Deferred Ideas

- Filter sidebar controls for functional role / forest layer / succession / edible parts — SRCH-02, already v2 in REQUIREMENTS.md. Phase 2 deliberately ships query-ready schema only (D-04).
- Personalized relevance ranking / climate-weighted attribute prominence (PERS-01/02) — v2.
- Companion planting tables (COMP-01/02) — Phase 3.
- Range-valued `years_to_bearing` (e.g., "2–4 yrs") — single int chosen for v1; richer modeling deferred if needed.
- Sub-month harvest granularity ("early/late August") — month-level only for v1.

None — discussion stayed within phase scope (all deferrals above are pre-existing roadmap boundaries, not scope creep surfaced in this discussion).

</deferred>

---

*Phase: 2-Functional-Data-Enrichment*
*Context gathered: 2026-05-18*
