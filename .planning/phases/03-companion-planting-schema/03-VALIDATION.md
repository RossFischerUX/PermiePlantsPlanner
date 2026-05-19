---
phase: 3
slug: companion-planting-schema
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (project has no jest/unit layer; Playwright targets the production UI and is irrelevant to this data-only phase). Verification = service-role tsx script + `tsc`/`next build` + SQL constraint introspection via grep on the migration files. |
| **Config file** | none — Wave 0 creates `scripts/verify-relationships.ts` (Plan 01 Task 1); no framework install needed (`tsx` already in package.json) |
| **Quick run command** | `npm run build` (TS strict compile — success criterion #2) |
| **Full suite command** | `npm run build && npx tsx scripts/verify-relationships.ts` (compile + criterion #3 honest-gate) |
| **Estimated runtime** | ~45 seconds (build ~35s, verify script ~5s, migration grep <1s) |

---

## Sampling Rate

- **After every task commit:** Run `npm run build` (after any `lib/types.ts` or script edit); run the migration grep gate after any migration edit.
- **After every plan wave:** After Wave 1 — `npx tsx scripts/verify-relationships.ts` MUST exit 1 (harness proven RED). After Wave 2 (post `supabase db push`) — `npx tsx scripts/verify-relationships.ts` MUST exit 0.
- **Before `/gsd:verify-work`:** `npm run build` green AND `npx tsx scripts/verify-relationships.ts` exits 0 AND both migrations applied cleanly.
- **Max feedback latency:** 45 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | COMP-02 | T-03-02 / T-03-03 | No `any` in types; verify harness fails loud (RED) before table exists | compile + negative | `npm run build` (exit 0) + `npx tsx scripts/verify-relationships.ts` (exit 1) | ❌ W0 (script created here) | ⬜ pending |
| 03-01-02 | 01 | 1 | COMP-01/02 | T-03-01 / T-03-06 | A1 resolved: curated pairs drawn only from confirmed-present plants; service-role key never committed | data-ground-truth | grep `03-SEED-MANIFEST.md` for HELPS/AVOIDS/verified/traditional/anecdotal + no `## BLOCKER` | ❌ W0 (manifest created here) | ⬜ pending |
| 03-02-01 | 02 | 2 | COMP-01 | T-03-04 / T-03-05 / T-03-06 / T-03-07 | DDL has RLS SELECT-only + CHECK enums; seed is `INTO STRICT` fail-loud, no bare ILIKE INSERT | schema introspection | migration grep gate (Plan 02 Task 1 `<verify>`) | ✅ (grep on authored SQL) | ⬜ pending |
| 03-02-02 | 02 | 2 | COMP-01 | T-03-04 / T-03-06 | Migrations applied to live DB; failed seed RAISEs and rolls back (no partial rows) | migration apply | `supabase db push` reports both applied (BLOCKING human-verify) | ✅ (CLI) | ⬜ pending |
| 03-02-03 | 02 | 2 | COMP-01/02 | T-03-03 / T-03-08 | Criterion #3 proven: verify harness GREEN against real rows; no weakened assertions | integration (service-role) | `npm run build && npx tsx scripts/verify-relationships.ts` (exit 0) | ❌ W0 (harness from 03-01-01) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/verify-relationships.ts` — automates success criterion #3 + D-06 coverage honest-gate assertions (does not exist; created in Plan 01 Task 1). MUST be proven RED (exit 1) while the table is absent before it is trusted GREEN.
- [ ] `package.json` script entry `"verify-relationships"` — mirrors existing backfill/dedupe entries (Plan 01 Task 1).
- [ ] `.planning/phases/03-companion-planting-schema/03-SEED-MANIFEST.md` — live-catalog ground truth resolving A1 before the seed is written (Plan 01 Task 2).
- [ ] No test-framework install needed — `tsx` 4.22.0 already present; no jest/vitest in this project.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `supabase db push` applies migrations to the LIVE production project | COMP-01 | Push targets the hosted production DB (no staging); may require interactive confirmation / `SUPABASE_ACCESS_TOKEN`; running it autonomously against production is gated by design (Plan 02 Task 2, `autonomous: false`) | Plan 02 Task 2 `how-to-verify`: review SQL, run `supabase db push` from repo root, confirm both files applied with no error; on RAISE, re-resolve via Plan 01 Task 2 and re-push |
| D-05 negative case (seed RAISEs on a missing/ambiguous plant) | COMP-01 / D-05 | The `INTO STRICT` RAISE is design-enforced; a destructive negative test against production is unsafe. Confirmed by reasoning + the migration grep gate proving `INTO STRICT` + `pg_temp.resolve_plant` present and no bare `INSERT...SELECT...ILIKE` | Plan 02 Task 1 acceptance criteria (static SQL assertion); if Task 2 push RAISEs, that IS the live confirmation the guard works |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every task has an automated `<verify>`; the one [BLOCKING] human-verify task is `supabase db push` which has no non-destructive automated form against production)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (all 5 tasks across both plans carry an automated gate; the human-verify push task is bracketed by automated gates on both sides)
- [x] Wave 0 covers all MISSING references (`scripts/verify-relationships.ts` + SEED-MANIFEST created in Plan 01 Wave 1 before any consumer in Plan 02 Wave 2)
- [x] No watch-mode flags
- [x] Feedback latency < 45s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-05-19
