# Phase 3: Companion Planting Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 3-Companion-Planting-Schema
**Areas discussed:** Pair directionality model, Seed data for verification, Vocab enforcement + nullable mechanism

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Pair directionality model | Directed vs symmetric vs directed+reciprocal | ✓ |
| Seed data for verification | How to produce honest data for success criterion #3 vs COMP-04 v2 | ✓ |
| Vocab enforcement + nullable mechanism | CHECK enum vs app-layer; nullable mechanism | ✓ |
| Query access surface | lib/ helper now vs type-only inline | (not selected — left to Claude discretion) |

---

## Pair Directionality Model

### Q1 — Pair modeling

| Option | Description | Selected |
|--------|-------------|----------|
| Directed (source → target) | subject→object, asymmetry honest, reciprocal = 2 rows | ✓ |
| Symmetric canonical pair | plant_a_id < plant_b_id, one row both ways | |
| Directed + reciprocal flag | directed + is_reciprocal boolean | |

**User's choice:** Directed (source → target)

### Q2 — Integrity constraints

| Option | Description | Selected |
|--------|-------------|----------|
| Unique triple + no self-ref | UNIQUE(subject,object,type) + CHECK(subject<>object) | ✓ |
| Unique pair (any type) | UNIQUE(subject,object) only | |
| No DB constraints (app-layer only) | plain columns, script-level dedupe | |

**User's choice:** Unique triple + no self-ref

### Q3 — FK delete behavior

| Option | Description | Selected |
|--------|-------------|----------|
| ON DELETE CASCADE | relationships auto-removed with plant | ✓ |
| No cascade (RESTRICT/default) | mirror plant_list_items bare REFERENCES | |
| You decide | planner chooses | |

**User's choice:** ON DELETE CASCADE

**Notes:** Deliberate divergence from `plant_list_items` accepted — relationship rows have no standalone value.

---

## Seed Data for Verification

### Q1 — How to produce honest data

| Option | Description | Selected |
|--------|-------------|----------|
| Hand-curated seed migration | ~10–20 classic pairs, name-resolved | ✓ |
| Tiny tsx seed script | scripts/seed-companion-relationships.ts | |
| Schema-only + documented insert | empty DB, manual INSERT in verify step | |

**User's choice:** Hand-curated seed migration

### Q2 — ID resolution + missing-plant behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Name subquery + fail loud | INSERT ... SELECT ILIKE, RAISE if zero rows | ✓ |
| Pinned UUIDs (looked up at authoring) | hard-coded UUIDs | |
| You decide | planner picks, honest-gate constrained | |

**User's choice:** Name subquery + fail loud

### Q3 — Seed coverage

| Option | Description | Selected |
|--------|-------------|----------|
| Both types + all 3 confidences | ≥1 HELPS, ≥1 AVOIDS, all 3 confidence levels, mechanism populated | ✓ |
| Both types, mechanism populated | ≥1 HELPS + ≥1 AVOIDS, confidences not mandated | |
| You decide | planner composes seed | |

**User's choice:** Both types + all 3 confidences

---

## Vocab Enforcement + Nullable Mechanism

### Q1 — Vocabulary enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Postgres CHECK enums | scalar CHECK(col IN (...)), Phase 2 precedent | ✓ |
| App-layer validation only | plain TEXT, script-validated | |
| You decide | follow established convention | |

**User's choice:** Postgres CHECK enums

### Q2 — Mechanism nullability + confidence default

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanism nullable, confidence NOT NULL (no default) | honest no-mechanism state; explicit evidence classification | ✓ |
| Mechanism + confidence both NOT NULL | strictest; risks fabricated mechanism prose | |
| Mechanism nullable, confidence default 'anecdotal' | convenient bulk insert; risks mislabeling evidence | |

**User's choice:** Mechanism nullable, confidence NOT NULL

**Notes:** Aligns with Phase 2 D-20 honest-NULL precedent and the no-fabrication honest-gate principle.

---

## Claude's Discretion

- Query access surface — not selected for discussion; locked as type-only (`PlantRelationship` export + inline `.from()`), consistent with Phase 2 adding zero query helpers.
- RLS — public SELECT `USING (true)` mirroring `plants`; no public write policy.
- Exact column names, migration filename(s), id/created_at boilerplate, exact curated pair list and mechanism prose (must satisfy coverage decision D-06).

## Deferred Ideas

- COMP-03 companion detail-page UI — v2.
- COMP-04 ~100-relationship AI backfill + manual validation — v2.
- `is_reciprocal` flag / symmetric modeling — considered, rejected (D-01).
- Relationship types beyond HELPS/AVOIDS — out of scope (COMP-01 locks the two-value vocab).
