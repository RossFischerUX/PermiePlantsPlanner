# Roadmap: Permaculture Plant Picker

## Overview

Five phases deliver the core database infrastructure and UX foundations for a region-aware permaculture plant picker. Phase 1 eliminates the architectural bottleneck of full client-side loads so the app can scale. Phase 2 enriches every plant with functional, ecological, and harvest data. Phase 3 adds the companion planting schema that underpins future guild features. Phase 4 builds location and climate infrastructure for regional personalization. Phase 5 completes list UX and closes the open RLS security gap.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Server-Side Filtering** - Replace client-side plant load with server-filtered, paginated queries and URL-driven filter state
- [ ] **Phase 2: Functional Data Enrichment** - Populate forest layer, functional roles, establishment, and harvest data for every plant via AI pipeline
- [ ] **Phase 3: Companion Planting Schema** - Add plant_relationships table and TypeScript types for guild and companion data
- [ ] **Phase 4: Location Infrastructure** - Geocode user location to Köppen-Geiger zone and persist it in user profiles
- [ ] **Phase 5: List UX & Security** - Wire drag-and-drop reordering and tighten plant_list_items RLS policy

## Phase Details

### Phase 1: Server-Side Filtering
**Goal**: Users can browse and filter the plant catalog without a full client-side data load; filter state is reflected in the URL
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: PERF-01, PERF-02
**Success Criteria** (what must be TRUE):
  1. Sharing or bookmarking a filtered plant browser URL restores the exact same filters on load
  2. The plant browser fetches only the matching page of results from Supabase — network tab shows no full-catalog download
  3. Applying a filter (e.g., USDA zone 8) visibly updates the URL query string without a full page reload
  4. Paginating through results loads only the next page's records, not the full dataset
**Plans:** 1/6 plans executed

Plans:
**Wave 1** *(run in parallel — no dependencies)*
- [x] 01-01-PLAN.md — Wave 0 tests: add 7 new Playwright test cases for PERF-01/PERF-02 behaviors
- [ ] 01-02-PLAN.md — Foundation: install nuqs, NuqsAdapter, lib/plant-labels.ts, searchParams.ts

**Wave 2** *(blocked on Wave 1 / 01-02 completion)*
- [ ] 01-03-PLAN.md — Component extraction: FilterSection, PlantCard, PlantCardSkeleton
- [ ] 01-04-PLAN.md — Server layer: actions.ts with buildPlantsQuery + fetchMorePlants Server Action

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 01-05-PLAN.md — Client islands: FilterControls, ActiveFilterChips, PlantsFilterSidebar

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 01-06-PLAN.md — RSC rewrite: PlantsGrid + page.tsx as RSC (walking skeleton complete)

**Cross-cutting constraints:**
- nuqs `shallow: false` required on every `useQueryState` hook (RSC re-execution depends on it)
- Botanical Heritage design tokens exclusively — no gray/green Tailwind defaults
- TypeScript strict, no `any`; server.ts in RSCs, client.ts in `'use client'` components

**UI hint**: yes

### Phase 2: Functional Data Enrichment
**Goal**: Every plant in the database has structured ecological role, forest layer, establishment, and harvest data — readable in the UI and filterable
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05
**Success Criteria** (what must be TRUE):
  1. A plant detail page shows functional role tags (e.g., nitrogen fixer, insectary plant) drawn from a structured array field
  2. A plant detail page shows its forest layer classification (canopy, shrub, herbaceous, etc.) and succession role
  3. A plant detail page shows propagation methods, establishment difficulty, and maintenance level
  4. A plant detail page shows edible parts and approximate harvest months
  5. Running the enrichment pipeline script skips already-populated records and completes without errors; a post-run verification confirms all fields are non-null for the enriched set
**Plans**: TBD

### Phase 3: Companion Planting Schema
**Goal**: The database and application type layer support companion planting relationships between plants
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: COMP-01, COMP-02
**Success Criteria** (what must be TRUE):
  1. A `plant_relationships` table exists in Supabase with rows containing plant pair IDs, relationship type (HELPS/AVOIDS), mechanism text, and confidence level
  2. `lib/types.ts` exports a `PlantRelationship` type and Supabase queries for relationships compile without TypeScript errors
  3. A direct Supabase query for a known plant's relationships returns the correct rows with all expected fields populated
**Plans**: TBD

### Phase 4: Location Infrastructure
**Goal**: Authenticated users can enter their location and have their Köppen-Geiger climate zone resolved and stored for use across sessions
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: LOC-01, LOC-02
**Success Criteria** (what must be TRUE):
  1. Entering a ZIP code or city name resolves to a latitude/longitude coordinate and then to a named Köppen-Geiger climate zone code (e.g., "Csa — Mediterranean")
  2. A logged-in user who sets their location sees the same climate zone and USDA zone range on return visits — the data persists across sessions
  3. A logged-in user can edit or clear their saved location from account settings
**Plans**: TBD
**UI hint**: yes

### Phase 5: List UX & Security
**Goal**: Users can reorder plants in their lists via drag-and-drop and list contents are protected so only owners and valid share-link viewers can read them
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: LIST-01, LIST-02
**Success Criteria** (what must be TRUE):
  1. Dragging a plant card to a new position in a list persists the new order to Supabase — a page refresh shows the reordered list
  2. An unauthenticated request to read `plant_list_items` for a list without a valid `share_id` is rejected by RLS
  3. Public presentation pages at `/presents/[shareId]` continue to load correctly for any valid share link
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Server-Side Filtering | 1/6 | In Progress|  |
| 2. Functional Data Enrichment | 0/TBD | Not started | - |
| 3. Companion Planting Schema | 0/TBD | Not started | - |
| 4. Location Infrastructure | 0/TBD | Not started | - |
| 5. List UX & Security | 0/TBD | Not started | - |
