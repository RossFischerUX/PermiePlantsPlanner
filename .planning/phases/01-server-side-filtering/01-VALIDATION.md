---
phase: 1
slug: server-side-filtering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright 1.60.0 |
| **Config file** | `playwright.config.ts` |
| **Quick run command** | `npx playwright test tests/plants.spec.ts --project=logged-out` |
| **Full suite command** | `npx playwright test` |
| **Estimated runtime** | ~120 seconds (production E2E) |

> **Note:** Playwright targets `https://permacultureplantpicker.com` (production). All E2E verification requires a deployed build. No localhost test runner available.

---

## Sampling Rate

- **After every task commit:** Run `npx playwright test tests/plants.spec.ts --project=logged-out`
- **After every plan wave:** Run `npx playwright test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~120 seconds (production round-trip)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------------|-----------|-------------------|-------------|--------|
| PERF-01-url-state | 01 | 1 | PERF-01 | URL reflects applied filters | E2E | `npx playwright test tests/plants.spec.ts -g "updates URL"` | ✅ existing | ⬜ pending |
| PERF-01-restore | 01 | 1 | PERF-01 | Navigating to filter URL restores exact filter state | E2E | `npx playwright test tests/plants.spec.ts -g "restores filter"` | ❌ Wave 0 | ⬜ pending |
| PERF-02-no-full-load | 02 | 1 | PERF-02 | Network: no full-catalog Supabase request | E2E (intercept) | `npx playwright test tests/plants.spec.ts -g "no full catalog"` | ❌ Wave 0 | ⬜ pending |
| PERF-02-page-size | 02 | 1 | PERF-02 | Initial load returns exactly 24 plants | E2E | `npx playwright test tests/plants.spec.ts -g "24 plants"` | ❌ Wave 0 | ⬜ pending |
| PERF-02-load-more | 02 | 1 | PERF-02 | "Load more" appends 24 more plants | E2E | `npx playwright test tests/plants.spec.ts -g "load more"` | ❌ Wave 0 | ⬜ pending |
| D-05-load-more-hidden | 02 | 1 | D-05 | "Load more" button absent when all results shown | E2E | `npx playwright test tests/plants.spec.ts -g "load more hidden"` | ❌ Wave 0 | ⬜ pending |
| D-07-count-display | 02 | 1 | PERF-02 | "Showing X of Y plants" accurate count | E2E | `npx playwright test tests/plants.spec.ts -g "count badge"` | ✅ existing | ⬜ pending |
| D-08-reset-on-filter | 02 | 1 | PERF-02 | Filter change resets result set to page 1 | E2E | `npx playwright test tests/plants.spec.ts -g "filter resets"` | ❌ Wave 0 | ⬜ pending |
| D-12-skeleton | 01 | 1 | D-12 | Skeleton cards appear during loading | Manual | N/A | N/A | ⬜ pending |
| D-14-empty-chips | 02 | 1 | D-14 | Empty state shows filter chips with × remove | E2E | `npx playwright test tests/plants.spec.ts -g "empty state"` | ✅ needs update | ⬜ pending |
| D-15-chips-above | 02 | 1 | D-15 | Active chips appear above results grid | E2E | `npx playwright test tests/plants.spec.ts -g "chips above"` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/plants.spec.ts` — add new test cases (file exists; extend with Wave 0 tests below)
- [ ] URL restoration test: navigate to `/plants?sun=full+sun`, assert sun checkbox is checked
- [ ] Network intercept test: use `page.route()` / `page.on('response')` to intercept Supabase REST calls, verify no response >50KB on filter change
- [ ] Page size test: count `.bg-cream.rounded-2xl` cards === 24 when total plant count > 24
- [ ] Load more test: click "Load more plants", assert card count increases by 24
- [ ] Load more hidden test: apply narrow filter returning ≤24 results, assert "Load more" button absent
- [ ] Filter reset test: click "Load more", apply a filter, assert only ≤24 cards visible
- [ ] Active chips above grid test: apply any filter, assert chip visible in a container above `.grid` (not only inside `aside`)

*All new tests are additions to the existing `tests/plants.spec.ts` file.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skeleton cards appear during loading | D-12 | Requires network throttling (browser DevTools); not automatable in Playwright against production | Open /plants in DevTools → Network → throttle to Slow 3G → hard refresh → verify skeleton rectangles appear before plant cards |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
