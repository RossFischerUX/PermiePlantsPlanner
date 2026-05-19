# Phase 2: Functional Data Enrichment - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 2-functional-data-enrichment
**Areas discussed:** Functional role taxonomy, Filter UI scope this phase, Detail page presentation, Enrichment pipeline & verification

---

## Functional Role Taxonomy

| Option | Description | Selected |
|--------|-------------|----------|
| New `functional_roles` column | Dedicated controlled-vocab column; leave `permaculture_uses` as legacy prose | |
| Reuse + normalize `permaculture_uses` | Keep existing column, enforce controlled vocabulary, re-enrich existing ~250 rows | ✓ |

| Option | Description | Selected |
|--------|-------------|----------|
| REQUIREMENTS seed set | Exactly the DATA-01 list, fixed enum | |
| Seed set + a few additions | REQUIREMENTS list plus common permaculture roles | ✓ |
| Open list, seed-suggested | No hard enum; Claude may add others | |

| Extra tags (multiSelect) | Description | Selected |
|--------|-------------|----------|
| Pollinator/bee forage | `pollinator nectary` / `bee forage` | ✓ |
| Living mulch / biomass | `living mulch` / `biomass producer` | ✓ |
| Erosion control / hedgerow | `erosion control` / `hedgerow` | ✓ |
| Edible (food-producing) | coarse `edible` role flag | ✓ |

**User's choice:** Reuse + normalize `permaculture_uses`; seed set + all four extra tag groups (16-tag vocabulary).
**Notes:** Existing free-form values are normalized/replaced during re-enrichment. Invalid Claude outputs dropped, matching existing `VALID_*` enum behavior.

---

## Filter UI Scope This Phase

| Option | Description | Selected |
|--------|-------------|----------|
| Schema + display only | Structured columns + detail-page display + pipeline; no new filter UI (SRCH-02 stays v2) | ✓ |
| Add functional-role filter only | Pull one filter section forward | |
| Full filter UI now | Complete SRCH-02 in this phase | |

**User's choice:** Schema + display only.
**Notes:** "Filterable" interpreted as structured/query-ready. Filter UI deferral is consistent with the existing v1/v2 split in REQUIREMENTS.md.

---

## Detail Page Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated sections | Distinct Functional Roles / Forest Layer & Succession / Establishment & Care / Harvest sections; retire generic Permaculture section | ✓ |
| Expand 'Permaculture' section | One section with new labeled sub-blocks | |

| Option | Description | Selected |
|--------|-------------|----------|
| Pills/badges | `rounded-full` pills for array fields; InfoCell rows for scalars | ✓ |
| Label-value rows | Everything as InfoCell rows | |

**User's choice:** Dedicated sections; pills for arrays, InfoCell rows for scalars.
**Notes:** Old "Permaculture" section content redistributed into Functional Roles + Forest Layer & Succession.

---

## Enrichment Pipeline & Verification

| Option | Description | Selected |
|--------|-------------|----------|
| New dedicated script | `scripts/enrich-functional-data.ts`, reuse batch/delay/validation patterns | ✓ |
| Extend update-existing-plants.ts | Add fields to existing script | |

| Option | Description | Selected |
|--------|-------------|----------|
| Per-field skip guard | Enrich only null fields per row | ✓ |
| Per-record skip guard | Skip plant if all functional fields populated | |

| Option | Description | Selected |
|--------|-------------|----------|
| Verification subcommand + report | Independent `--verify` pass/fail coverage report, non-zero exit on gaps | ✓ |
| Inline end-of-run summary | Coverage summary only at end of pipeline run | |

| Option | Description | Selected |
|--------|-------------|----------|
| Use these defaults | Proposed enum/array shapes for DATA-02/03/04 | partial |
| Mostly — I'll adjust some | Accept structure, tweak specifics | |
| (free text) "give me pros and cons" | Requested trade-off analysis per field | ✓ |

**User's choice:** New dedicated script; per-field skip; verification subcommand + report. After pros/cons analysis: accepted proposed defaults with robustness additions (`propagation_methods` += `tuber`, `sucker`; `edible_parts` += `shoot`, `pod`; `years_to_bearing` = typical earliest int or null) **with one exception** — `succession_role` is `TEXT[]` (multi-stage) rather than a single enum, because many plants span succession phases.
**Notes:** See CONTEXT.md D-08..D-19 for final locked field shapes and verification semantics.

---

## Claude's Discretion

- Migration file name / column ordering (follow timestamped convention; mirror `add_permaculture_fields` style).
- Pill/InfoCell component reuse; new display constants go in `lib/plant-labels.ts`.
- Claude Haiku prompt wording / structured-output schema (must validate against locked vocabularies).
- `TEXT[]` plain vs. `CHECK`-constrained for array columns (app/script-layer validation acceptable).

## Deferred Ideas

- Filter sidebar controls for new fields — SRCH-02 (v2).
- Personalized relevance ranking / climate-weighted prominence — PERS-01/02 (v2).
- Companion planting tables — Phase 3.
- Range-valued `years_to_bearing` and sub-month harvest granularity — deferred; single int / month-level for v1.
