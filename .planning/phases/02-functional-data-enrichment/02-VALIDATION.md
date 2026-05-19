---
phase: 2
slug: functional-data-enrichment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

This phase has **no unit-test framework by design** (CLAUDE.md — Playwright E2E only). The
DATA-05 `--verify` coverage report is the deliberate, executable substitute for a unit
harness: it IS the acceptance gate for DATA-01..05 data coverage. Detail-page display
behavior is validated via Playwright E2E.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.60.0 (E2E only) + the D-18 `--verify` data-coverage script (acceptance gate) |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npm run lint && npx tsc --noEmit` (per-task: strict `Plant` interface must compile) |
| **Full suite command** | `npm run enrich-functional-data -- --verify && npx playwright test tests/logged-out` |
| **Estimated runtime** | ~60s (`--verify` read-only counts) + Playwright detail-page suite |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint && npx tsc --noEmit`
- **After every plan wave:** Run `npm run enrich-functional-data -- --verify` (after enrichment waves)
- **Before `/gsd:verify-work`:** `--verify` exits 0 AND Playwright detail-page suite green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Task IDs are placeholders until PLAN.md exists; the planner must reconcile this map
> against final task numbering. Wave ordering follows MVP vertical slices:
> migration → types/labels → enrichment (split: re-enrich roles vs. backfill new) →
> `--verify` branch → detail-page restructure.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | DATA-02/03/04 | — | Migration adds typed columns; RLS unchanged (inherits public SELECT) | data-verify | `supabase db push && npm run enrich-functional-data -- --verify` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | DATA-01..04 | — | `Plant` interface + labels compile under strict TS | type | `npx tsc --noEmit` | ✅ | ⬜ pending |
| 2-02-01 | 02 | 2 | DATA-01 | T-2-V5 | Roles re-enriched & overwritten; invalid tags dropped via whitelist | data-verify | `npm run enrich-functional-data -- --verify` | ❌ W0 | ⬜ pending |
| 2-02-02 | 02 | 2 | DATA-02/03/04/05 | T-2-V5 | New null fields backfilled (skip-if-populated); rerun = "Nothing to do." | data-verify | `npm run enrich-functional-data -- --verify` | ❌ W0 | ⬜ pending |
| 2-02-03 | 02 | 2 | DATA-05 | — | `--verify` exits non-zero + lists offending ids on coverage gap | data-verify | `npm run enrich-functional-data -- --verify` | ❌ W0 | ⬜ pending |
| 2-03-01 | 03 | 3 | DATA-01..04 (display) | T-2-XSS | 4 new detail sections render; conditional-hide for null/empty | E2E | `npx playwright test tests/logged-out` | partial | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/enrich-functional-data.ts` `--verify` branch — **IS** the DATA-05 acceptance test (no separate test file; the script is self-verifying per D-18). Read-only Supabase count queries; per-field non-null coverage; non-zero exit listing offending plant ids; exempts `years_to_bearing`; treats `edible_parts`/`harvest_months` empty arrays as valid (assert column present/typed per D-19).
- [ ] Playwright assertions for the 4 new detail-page sections (Functional Roles / Forest Layer & Succession / Establishment & Care / Harvest) + conditional-hide behavior — extend existing `tests/` detail-page spec. Scope assertions to `nav`/section per CLAUDE.md Playwright gotchas; cards `.bg-cream`, pills `rounded-full`. Cross-check `02-UI-SPEC.md` lines 116–136 for the conditional-hide matrix.
- [ ] No framework install needed — Playwright 1.60.0 + tsx 4.22.0 already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Re-enrichment normalization is semantically faithful (legacy free-form `permaculture_uses` → 16-tag vocab; e.g. legacy `pioneer` maps to `succession_role`, not a role tag) | DATA-01 | Semantic correctness of AI normalization can't be asserted by count coverage alone | After enrichment, spot-check ~10 plants whose old `permaculture_uses` had legacy/free-form values; confirm roles conform to D-02 vocab and no role-vs-succession category errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (`--verify` branch, Playwright section assertions)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
