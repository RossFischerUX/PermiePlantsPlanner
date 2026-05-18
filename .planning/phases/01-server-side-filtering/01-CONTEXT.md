# Phase 1: Server-Side Filtering - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Convert the plant browser from a full client-side catalog load with in-memory filtering to server-filtered, paginated Supabase queries with URL-driven filter state managed by nuqs. The `app/(app)/plants/page.tsx` page (currently a 654-line `'use client'` component loading up to 2000 rows) becomes an RSC shell. Filter interaction lives in extracted client components. Result: no full-catalog downloads, shareable/bookmarkable filter URLs, and a clean component architecture.

</domain>

<decisions>
## Implementation Decisions

### Component Architecture
- **D-01:** `app/(app)/plants/page.tsx` becomes an RSC. It reads `searchParams` (via nuqs server utilities), runs the filtered Supabase query inline, and renders the initial result set — consistent with how plant detail and list pages work.
- **D-02:** A client `FilterBar` island (co-located at `app/(app)/plants/PlantsFilterSidebar.tsx` or similar) uses nuqs `useQueryState` hooks to read/write URL params. URL is the single source of truth — no prop drilling from RSC parent.
- **D-03:** Existing `FilterSection` and `PlantCard` logic is extracted to separate co-located files, kept intact — no logic rewrites. Follows the existing pattern: `NavUser.tsx`, `ListItemActions.tsx`, etc.
- **D-04:** The filtered Supabase query lives directly in `page.tsx` (inline, not a lib helper) — consistent with the rest of the app.

### Pagination
- **D-05:** "Load more" button — appends the next page of results to the current grid. No infinite scroll, no page numbers.
- **D-06:** Page size: **24 plants per page** (divides cleanly into 3, 4, or 6-column grids).
- **D-07:** Show result count via a separate `COUNT` query with the same filters — display as "Showing 24 of 47 plants". Run in parallel with the data query.
- **D-08:** Any filter change resets to page 1 and replaces the loaded result set entirely.

### Filter Sidebar — Extraction & Deduplication
- **D-09:** Full extraction while rewriting the page. Extract `FilterSection` to a reusable component, `PlantCard` to its own file, and shared constants (`SUN_ICONS`, `WATER_ICONS`, `SUN_LABELS`, `WATER_LABELS`, etc.) to `lib/plant-labels.ts`. Fixes the known duplication anti-pattern.
- **D-10:** Desktop sidebar and mobile drawer both render a single shared `FilterControls` component. Eliminates the current copy-paste duplication in the 654-line page.
- **D-11:** All extracted components co-located in `app/(app)/plants/` — follows existing codebase convention.

### Loading & Transition UX
- **D-12:** Loading state: **skeleton cards** — 24 placeholder card-shaped rectangles while server results load. Consistent with the Botanical Heritage card shape (`rounded-2xl`, `bg-stone-white`).
- **D-13:** No debounce on URL updates — instant on each filter checkbox toggle (nuqs default). Appropriate for checkbox filters where each click is intentional.
- **D-14:** Empty state: friendly message + **active filter chips** showing each applied filter with an individual × remove button. User can selectively remove filters without clearing all.
- **D-15:** Active filter chips also appear **above the results grid** (not only in the sidebar/drawer) — visible on both mobile and desktop at all times.

### Claude's Discretion
- Exact file names for extracted components (`PlantsFilterSidebar.tsx` vs `FilterBar.tsx` etc.) — follow established co-location naming convention.
- nuqs configuration details (serializer format for arrays, shallow routing vs full navigation).
- Skeleton card implementation details (exact dimensions, animation style).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — PERF-01 (nuqs for URL state) and PERF-02 (server-side filtered pagination) are the requirements this phase satisfies.

### Architecture & Conventions
- `.planning/codebase/ARCHITECTURE.md` — Server vs. client split table, data flow patterns, anti-patterns section (client-side full-table load is explicitly documented here).
- `.planning/codebase/CONVENTIONS.md` — Component naming, file co-location patterns, Supabase client usage rules, styling tokens.

### Key Source Files
- `app/(app)/plants/page.tsx` — The 654-line file being refactored. Read before planning to understand current filter options, `FilterSection`, `PlantCard`, and URL sync logic.
- `lib/types.ts` — `Plant`, `PlantList`, `PlantListItem` interfaces — must not change.
- `lib/zones.ts` — `encodeZone`, `ZONE_LABELS` — used for USDA zone filter; must be preserved.
- `lib/supabase/server.ts` — Server-side Supabase client for RSC data fetching.

### Design System
- `.stitch/DESIGN.md` — Botanical Heritage tokens. Skeleton cards must use `stone-white` background, `rounded-2xl` shape.
- `tailwind.config.ts` — Custom color tokens and shadow utilities.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `FilterSection` (inline in `plants/page.tsx:~36`) — accordion filter component with label, options, selected state, toggle callback. Extract as-is.
- `PlantCard` (inline in `plants/page.tsx:~78`) — full card component with image, name, badges, add-to-list UI. Extract as-is.
- `ZONE_LABELS`, `encodeZone` from `lib/zones.ts` — already handles USDA zone filter encoding for URL params.
- `US_STATES` from `lib/us-states.ts` — used for native states filter.
- `Suspense` wrapper pattern already in place in `plants/page.tsx` for `useSearchParams` — this pattern continues in the new architecture.

### Established Patterns
- RSC data fetch pattern: `const { data } = await supabase.from('plants').select('*').eq(...)` — same as `plants/[id]/page.tsx`, `lists/page.tsx`.
- Co-located client components: `PascalCase.tsx` siblings of `page.tsx` — `NavUser.tsx`, `AddToListClient.tsx`, `ListItemActions.tsx`.
- URL state: currently manual `router.replace` — nuqs `useQueryState` replaces this entirely.
- `router.refresh()` for RSC cache invalidation after client mutations — no change needed here (filters drive navigation, not mutations).

### Integration Points
- `app/(app)/layout.tsx` — provides nav/footer; no changes needed.
- `lib/supabase/server.ts` — RSC page uses this for the filtered + paginated query.
- `lib/supabase/client.ts` — client components (AddToListClient etc.) continue using this; no changes.
- `app/(app)/plants/[id]/page.tsx` — unchanged; plant detail pages are independent RSCs.

</code_context>

<specifics>
## Specific Ideas

- Active filter chips: display each applied filter value as a pill with a × button above the results grid. In the empty state, the same chips appear so users can selectively remove filters to broaden results.
- "Showing X of Y plants" count line between the filter chips and the results grid.
- "Load more" button: show only when there are more pages available (i.e., total count > loaded count). Hide when all results are loaded. Show "All N plants loaded" or similar when exhausted.

</specifics>

<deferred>
## Deferred Ideas

- `lib/plant-labels.ts` consolidation of `SUN_ICONS`/`WATER_LABELS` etc. will benefit Phase 2 (new fields will need similar display constants) — extract now but keep extensible.
- Personalized relevance ranking (PERS-01) — deferred to v2. URL-driven filters are the foundation.
- Full-text search (SRCH-01) — deferred to v2. Server-side filtering is the prerequisite.

</deferred>

---

*Phase: 1-Server-Side-Filtering*
*Context gathered: 2026-05-18*
