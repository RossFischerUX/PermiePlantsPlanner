# Phase 1: Server-Side Filtering - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 1-Server-Side-Filtering
**Areas discussed:** Component Architecture, Pagination Style, Filter Sidebar Scope, Loading & Transition UX

---

## Component Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| RSC shell + client island | page.tsx becomes RSC; client FilterBar uses nuqs useQueryState | ✓ |
| Stay client, Server Action for data | Keep 'use client', call Server Action on URL change | |
| Full RSC with nuqs server utils | Most idiomatic App Router pattern | |

**User's choice:** RSC shell + client island

| Option | Description | Selected |
|--------|-------------|----------|
| Query inline in page.tsx | Consistent with plant detail, lists pattern | ✓ |
| Extracted lib/plants.ts helper | Reusable but adds abstraction for one use case | |

**User's choice:** Inline query in page.tsx

| Option | Description | Selected |
|--------|-------------|----------|
| nuqs useQueryState (URL as truth) | No prop drilling, URL drives state | ✓ |
| Props from RSC + router.replace callbacks | More explicit, bypasses nuqs purpose | |

**User's choice:** nuqs useQueryState hooks

| Option | Description | Selected |
|--------|-------------|----------|
| Extract and keep (preserve logic) | Move to separate files, no rewrites | ✓ |
| Rewrite as part of refactor | Clean up internals, higher risk | |

**User's choice:** Extract and keep — minimize risk

---

## Pagination Style

| Option | Description | Selected |
|--------|-------------|----------|
| "Load more" button | Appends next page, simple, grid-friendly | ✓ |
| Page numbers | Traditional, sharable pages, requires count query | |
| Infinite scroll | Smooth UX, IntersectionObserver, complex state | |

**User's choice:** Load more button

| Option | Description | Selected |
|--------|-------------|----------|
| 24 per page | Clean grid counts, fast load | ✓ |
| 48 per page | Closer to current all-at-once behavior | |
| 12 per page | Very fast but frequent paging | |

**User's choice:** 24 per page

| Option | Description | Selected |
|--------|-------------|----------|
| COUNT query — "Showing X of Y" | Separate count query with same filters | ✓ |
| Show only loaded count | No extra query | |
| No count display | Simplest | |

**User's choice:** Separate COUNT query — "Showing 24 of 47 plants"

| Option | Description | Selected |
|--------|-------------|----------|
| Reset to page 1 on filter change | Standard behavior, simple | ✓ |
| Preserve scroll position | Complex, rarely expected | |

**User's choice:** Always reset to page 1 on filter change

| Option | Description | Selected |
|--------|-------------|----------|
| Always replace results on filter change | Consistent with page-1 reset | ✓ |
| Merge into existing list | Complex, unexpected behavior | |

**User's choice:** Always replace (filter change = new result set)

---

## Filter Sidebar Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full extraction — fix duplication too | Extract FilterSection, PlantCard, lib/plant-labels.ts | ✓ |
| Minimal — only what RSC refactor forces | Leave desktop/mobile duplication in place | |
| Strict scope — no UI cleanup | Touch data-fetching only | |

**User's choice:** Full extraction — clean it up while rewriting the page

| Option | Description | Selected |
|--------|-------------|----------|
| Co-located in app/(app)/plants/ | Follows existing convention | ✓ |
| Shared in app/components/ | New pattern not in current codebase | |

**User's choice:** Co-located in app/(app)/plants/

| Option | Description | Selected |
|--------|-------------|----------|
| Single FilterControls component shared by both layouts | Eliminates duplication | ✓ |
| Keep separate desktop/mobile implementations | Less refactoring | |

**User's choice:** Single shared FilterControls component

---

## Loading & Transition UX

| Option | Description | Selected |
|--------|-------------|----------|
| Skeleton cards | 24 placeholder card shapes while loading | ✓ |
| Spinner or loading bar | Subtle, may not be obvious | |
| nuqs + React transitions (opacity) | Seamless but more complex | |

**User's choice:** Skeleton cards

| Option | Description | Selected |
|--------|-------------|----------|
| Instant — no debounce | Each checkbox toggle updates URL immediately | ✓ |
| Debounced 300ms | Batch rapid changes | |

**User's choice:** Instant, no debounce

| Option | Description | Selected |
|--------|-------------|----------|
| Friendly message + clear all button | Reset all filters at once | |
| Redirect to broader results | Auto-clear most restrictive filter | |
| Just a message | No action | |

**User's choice (freeform):** Friendly message + active filter chips with individual × remove buttons — user selects which filter to remove, not forced to clear all

| Option | Description | Selected |
|--------|-------------|----------|
| Active filter chips above the grid | Visible on mobile and desktop | ✓ |
| Only in sidebar/drawer | Requires opening sidebar to see active state | |

**User's choice:** Active filter chips above the results grid

---

## Claude's Discretion

- Exact file names for extracted components (e.g., `PlantsFilterSidebar.tsx` vs `FilterBar.tsx`)
- nuqs configuration details (array serializer format, shallow routing settings)
- Skeleton card animation details (pulse vs shimmer, exact dimensions)

## Deferred Ideas

- `lib/plant-labels.ts` consolidation noted as useful for Phase 2 when new field display constants will be needed
- Personalized relevance ranking (PERS-01) — v2 requirement, depends on location infrastructure
- Full-text search (SRCH-01) — v2 requirement, server-side filtering is the prerequisite
