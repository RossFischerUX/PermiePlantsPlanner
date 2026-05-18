# Requirements: Permaculture Plant Picker

**Defined:** 2026-05-18
**Core Value:** A user with a site to plant can find the right plants for their specific place, understand what each plant contributes to the ecosystem, and assemble a palette — faster and with more confidence than any other tool.

## v1 Requirements

### Performance & Architecture

- [ ] **PERF-01**: Plant browser filter state lives in the URL (shareable, bookmarkable, RSC-compatible) via nuqs
- [ ] **PERF-02**: Plant catalog is fetched server-side with pagination and server-applied filters — no full client-side load

### Plant Functional Data

- [ ] **DATA-01**: Each plant has functional role tags (nitrogen fixer, dynamic accumulator, insectary plant, chop-and-drop, wildlife benefit, medicinal, fiber, groundcover, windbreak, etc.) stored as a structured array and filterable
- [ ] **DATA-02**: Each plant has forest layer classification (canopy, sub-canopy, shrub, herbaceous, ground cover, root/rhizosphere, vine, mycelium) and succession role (pioneer, early successional, climax, etc.)
- [ ] **DATA-03**: Each plant has establishment and care data: propagation methods, establishment difficulty (easy/moderate/challenging), approximate years to bearing (for food plants), and maintenance level
- [ ] **DATA-04**: Each plant has edible parts (leaf, fruit, nut, seed, root, flower, bark, sap) and approximate harvest months — enabling seasonal planning in list reports
- [ ] **DATA-05**: All functional data fields are populated via Claude Haiku structured output enrichment pipeline with skip-if-populated guard and post-run verification

### Companion Planting

- [ ] **COMP-01**: `plant_relationships` database table exists: pairs of plants with relationship type (HELPS/AVOIDS), mechanism text, and confidence level (verified/traditional/anecdotal)
- [ ] **COMP-02**: Companion relationship data schema is integrated into `lib/types.ts` and accessible via Supabase queries

### Location Infrastructure

- [ ] **LOC-01**: System resolves a user-entered ZIP code or city name to latitude/longitude (via geocoding API) and then to a Köppen-Geiger climate zone code (via static lookup table)
- [ ] **LOC-02**: Authenticated users have a `user_profiles` record storing their Köppen zone, USDA zone range, and state — persisted across sessions and editable in account settings

### List UX & Security

- [ ] **LIST-01**: Plant list items can be reordered via drag-and-drop; order is persisted to Supabase
- [ ] **LIST-02**: `plant_list_items` RLS SELECT policy is tightened so only the list owner (or public via valid `share_id`) can read items — `/presents/[shareId]` pages continue to work

## v2 Requirements

Deferred to next milestone. Tracked but not in current roadmap.

### Personalization

- **PERS-01**: Plant browser surfaces personalized relevance ranking — plants scored by climate match + USDA zone + native state and sorted accordingly for the logged-in user
- **PERS-02**: Filter sidebar surfaces contextually relevant attributes more prominently based on user's climate zone (e.g., drought tolerance emphasized for Mediterranean users)

### Companion Planting (Display)

- **COMP-03**: Plant detail pages include a companion planting section showing HELPS and AVOIDS relationships with mechanism notes
- **COMP-04**: Companion seed set of ~100 high-confidence relationships enriched via AI backfill with manual validation pass

### Search & Discovery

- **SRCH-01**: Full-text search across plant names, common names, and descriptions using PostgreSQL tsvector — no external search service
- **SRCH-02**: Filter by forest layer, functional role, succession role, and edible parts in the plant browser sidebar

### Stability

- **STAB-01**: Optimistic UI reverts on add/remove errors — currently mutations are silently discarded; show error toast and revert state

### Future Milestones

- Spatial layout / site mapping tools
- Client-ready PDF/document exports for design professionals
- UGC ratings, comments, wiki-style plant data editing
- Maintenance scheduling and troubleshooting tools
- Business model / subscription tiers

## Out of Scope

| Feature | Reason |
|---------|--------|
| Guild canvas / spatial layout | Separate product milestone; database must be solid first |
| PDF/document export | Professional tier feature; deferred |
| UGC/wiki/ratings | Community features after core data is established |
| Maintenance scheduling | Future milestone |
| Monetization / paywall | Business model TBD; keep auth flexible |
| Dynamic accumulator mineral specificity | Cornell 2022 data exists but integration effort exceeds v1 value |
| Native counties granularity | `backfill-native-counties` script deferred; Flora API key needed |
| OAuth / social login | Not needed for v1; PKCE email auth is sufficient |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERF-01 | Phase 1 | Pending |
| PERF-02 | Phase 1 | Pending |
| DATA-01 | Phase 2 | Pending |
| DATA-02 | Phase 2 | Pending |
| DATA-03 | Phase 2 | Pending |
| DATA-04 | Phase 2 | Pending |
| DATA-05 | Phase 2 | Pending |
| COMP-01 | Phase 3 | Pending |
| COMP-02 | Phase 3 | Pending |
| LOC-01 | Phase 4 | Pending |
| LOC-02 | Phase 4 | Pending |
| LIST-01 | Phase 5 | Pending |
| LIST-02 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 13 total
- Mapped to phases: 13
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-18*
*Last updated: 2026-05-18 after initialization*
