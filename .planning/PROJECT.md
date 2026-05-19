# Permaculture Plant Picker

## What This Is

A deep-database platform for homesteaders and garden designers to discover, research, and assemble plant palettes for regenerative landscapes. Plants are surfaced with region-aware relevance — the system infers a user's Köppen-Geiger climate classification from their location and adjusts which data dimensions are most prominently surfaced (drought tolerance matters in a Mediterranean climate; it's background noise in the tropics). Design tools and community features are on the horizon; the database is the foundation everything else is built on.

## Core Value

A user with a site to plant can find the right plants for their specific place, understand what each plant contributes to the ecosystem, and assemble a palette — faster and with more confidence than any other tool.

## Requirements

### Validated

- ✓ Plant catalog browsable with filters (sun, water, USDA zone, soil) — existing
- ✓ Plant detail pages with images, taxonomy, key attributes — existing
- ✓ USDA hardiness zone support (half-zone integers, zone range filtering) — existing
- ✓ Native states data and filtering — existing
- ✓ Invasive flag and notable cultivars displayed — existing
- ✓ User accounts (email auth, password reset) — existing
- ✓ User-owned plant lists with add/remove, drag-sort UI (not yet wired), notes — existing
- ✓ Shareable public presentation pages (plant grid + reports) — existing
- ✓ iNaturalist taxonomy + Wikimedia image integration — existing
- ✓ AI-enriched plant data pipeline (Claude Haiku + iNaturalist import scripts) — existing
- ✓ Plant functional data: functional roles, forest layer, edible parts, harvest months — Validated in Phase 2 (DATA-02/04); rendered in dedicated detail-page sections
- ✓ Establishment & care data: propagation methods, establishment difficulty, succession role, maintenance — Validated in Phase 2 (DATA-02/03/05). Per decision D-20, succession_role/permaculture_uses/propagation_methods are NULL (re-targetable, never empty-array) for species where the controlled vocab genuinely doesn't apply (non-successional ornamentals, toxic invasives, spore plants) — the `--verify` gate hard-fails only on the dishonest empty-array state.

### Active

- [ ] Companion planting relationships: guilds, compatible pairings, antagonists
- [ ] Climate & microclimate fit: drought tolerance, flood tolerance, soil type, slope/aspect preferences
- [ ] Location-based personalization: user enters location → system infers Köppen-Geiger climate zone → UI weights relevant attributes accordingly
- [ ] Curated, high-quality database expansion: grow beyond current ~250 plants with verified data on the most important permaculture species
- [ ] Drag-and-drop list reordering (UI exists, logic not wired)
- [ ] Mutation error handling: optimistic UI revert on add/remove failures (currently silent)
- [ ] Server-side filtered plant browsing: replace full client-side load with paginated/filtered queries

### Out of Scope

- Spatial layout / site mapping tools — deferred to future milestone; database must be solid first
- Client-ready PDF/document exports — deferred to professional tier milestone
- UGC ratings, comments, wiki-style editing — deferred; community features after core data is established
- Maintenance scheduling / troubleshooting tools — deferred to future milestone
- Monetization / paywall — not decided; keep auth and features flexible
- Native counties granularity (Flora API) — deferred; `backfill-native-counties` script exists but not integrated

## Context

**Existing codebase:** Next.js 14 App Router + Supabase (PostgreSQL + RLS + Auth), deployed on Vercel at permacultureplantpicker.com. Tailwind CSS with a custom "Botanical Heritage" design system (parchment/forest/terracotta palette, Playfair Display headings). E2E tests only (Playwright, targeting production URL).

**Competitive context:** Plants for a Future (PFAF) has the most relevant data but terrible UX. Agroforestry Research Trust offers classes/courses, not a database. Nothing in this space combines deep permaculture data with modern UX and regional personalization.

**Data pipeline:** Import scripts in `scripts/` use iNaturalist API + Claude Haiku for enrichment. Rate-limited to 10 Claude API calls per 15s. Backfill scripts are idempotent.

**Known technical debt (from codebase map):**
- Full plant catalog loaded client-side on every page load — no server-side pagination
- `plant_list_items` RLS SELECT policy is open (`USING (true)`) — list contents readable by anyone with a `list_id`
- Supabase anon key committed in `tests/global-setup.ts`
- Mutation errors silently discarded; no optimistic UI revert
- Plant browser page is 654 lines with duplicated desktop/mobile filter UI

**Database schema note:** `usda_zone_min`/`usda_zone_max` use half-zone integers (9a=18, 9b=19). "Zone 9" = zones 1–9b (ceiling semantics). See `lib/zones.ts`.

## Constraints

- **Tech stack:** Next.js 14 + Supabase + Tailwind — established, no changes
- **Design system:** Botanical Heritage tokens only — no gray/green Tailwind defaults
- **Testing:** Playwright E2E only, targets production URL — be careful with destructive ops
- **Image hosts:** Only `upload.wikimedia.org`, `*.supabase.co`, `inaturalist-open-data.s3.amazonaws.com`, `static.inaturalist.org` — new sources require `next.config.mjs` update
- **Data enrichment rate:** Max 10 Claude API calls per 15s in import scripts

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Köppen-Geiger climate zones for regionalization | More globally applicable than USDA zones alone; captures precipitation + temperature; users enter location, system infers | — Pending |
| Curated quality over broad coverage | Better to have 500 well-documented plants than 5k shallow records | — Pending |
| Defer spatial/layout tools to later milestone | Database integrity and UX are the moat; spatial tools require a solid foundation | — Pending |
| Business model TBD | Keep auth and feature gates flexible; don't architect for a model not yet chosen | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-19 after Phase 2 (Functional Data Enrichment) completion*
