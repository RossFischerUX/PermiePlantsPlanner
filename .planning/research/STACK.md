# Technology Stack — Additions Research

**Project:** Permaculture Plant Picker
**Researched:** 2026-05-18
**Scope:** Additions to locked Next.js 14 + Supabase stack. Not a greenfield recommendation — every decision here is about what to ADD, not replace.

---

## Locked Stack (Existing — Do Not Change)

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 14.2.35 | App Router, RSC-first |
| React | 18.3.1 | Client components gated with `'use client'` |
| TypeScript | 5.9.3 | Strict mode, `@/*` alias |
| Supabase JS | 2.105.4 | Database + auth client |
| Supabase SSR | 0.10.3 | SSR cookie helpers |
| Tailwind CSS | 3.4.19 | Botanical Heritage tokens |
| @anthropic-ai/sdk | 0.96.0 | Scripts only — plant enrichment |
| Playwright | 1.60.0 | E2E tests only |

---

## New Additions by Domain

---

### Domain 1: Köppen-Geiger Climate Zone Inference

**Problem:** User enters a ZIP code or coordinates; the system needs to return a Köppen-Geiger climate class (e.g. `Csb`, `Dfa`) to weight UI attributes accordingly.

This is a two-step pipeline:
1. ZIP/city → lat/lon
2. lat/lon → Köppen class

#### Step 1: ZIP to Coordinates

**Recommended: Open-Meteo Geocoding API (no library, direct fetch)**

- Endpoint: `https://geocoding-api.open-meteo.com/v1/search?name=<zip>&countryCode=US`
- Accepts ZIP codes directly as the `name` parameter
- Returns `latitude`, `longitude`, `elevation`, and a `postcodes` array
- No API key, no account, no rate limit for non-commercial use under 10,000 req/day
- Open-source project, self-hostable if needed
- Verified: supports US ZIP codes as search input (MEDIUM confidence — tested behavior documented, not formally specified for ZIP)

**Why not Zippopotam.us:** Also free and no-key, but data is from GeoNames (algorithmically estimated coordinates, newly-created ZIPs lag years behind). Open-Meteo data is more current and actively maintained.

**Why not Google Geocoding API:** Requires API key, billing setup, and key management in environment variables. Adds operational overhead for a feature that can be accomplished for free.

**Why not react-geocode or similar npm wrappers:** These wrap Google Maps and inherit all its requirements. No justification when a simple `fetch()` call to Open-Meteo works.

**Implementation:** A Next.js Server Action (no new library required). ZIP → `fetch(open-meteo)` → extract `lat`/`lon`. Keep it a server action so no API-key leakage risk and response caching with `revalidate` applies.

```typescript
// Server Action — no library needed
async function zipToCoordinates(zip: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${zip}&countryCode=US&count=1&language=en`;
  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
  const data = await res.json();
  const result = data.results?.[0];
  return result ? { lat: result.latitude, lon: result.longitude } : null;
}
```

#### Step 2: Coordinates → Köppen Class

**Recommended: Bundled static lookup table (no external API)**

**Finding:** There is no maintained npm package for coordinate-to-Köppen lookup as of May 2026. Existing npm/GitHub projects (rjerue/koppen-map, chen-jenn/koppen-geiger) are visualization tools, not coordinate lookup libraries, and none are published on npm.

**Available data source:** The Vienna University of Technology hosts official 0.5-degree lat/lon ASCII grids — ~245 KB compressed, ~91,828 rows, format: `lat lon class`. This is the canonical scientific dataset used in peer-reviewed climate research.

**Recommended approach:** Download the 1976-2000 baseline ASCII file, convert to a compact binary or JSON lookup, bundle it as a static asset, and implement a nearest-neighbor grid lookup function in TypeScript. At 0.5-degree resolution, the lookup is a simple `Math.round(lat * 2) / 2` snap. The uncompressed text is ~2.5 MB but can be preprocessed into a ~300 KB typed array or compact JSON keyed by `"lat:lon"`.

Alternative: Use the `gloh2o.org/koppen` V3 GeoTIFF (1 km resolution) for higher accuracy but this requires a geospatial library (e.g. `geotiff` npm package) and larger bundle. Overkill for this use case — 0.5-degree (~55 km) resolution is sufficient for climate zone matching.

**Why not a third-party API:** There is no production-quality free API for this. The Köppen Climate Explorer (koppen.earth) is a web app, not an API endpoint.

**Implementation:**
1. One-time data pipeline script: download ASCII → parse → serialize to `public/data/koppen-grid.json` (keyed lookup object) or a sorted array for binary search
2. TypeScript module `lib/koppen.ts`: `classifyCoordinates(lat: number, lon: number): string` — snap to nearest 0.5-degree grid cell, return 2–3 char Köppen code
3. Store result per user in Supabase (a `koppen_zone TEXT` column on a user profile or in `localStorage` for anonymous users)

**No new npm packages required for this domain.** (Confidence: MEDIUM — no library exists; build approach is well-established pattern)

**Data source:** http://koeppen-geiger.vu-wien.ac.at/shifts.htm (ASCII downloads, free for non-commercial use)

---

### Domain 2: Enriching the Plant Database with Functional Data

**Problem:** The `plants` table needs new data dimensions: functional yields, companion relationships, establishment/care characteristics, and climate tolerance metadata. The existing Claude Haiku enrichment pipeline must be extended.

#### Schema Additions to `plants` Table (via migration)

New columns to add directly to `plants` (simple scalar/array attributes):

| Column | Type | Notes |
|--------|------|-------|
| `yields` | `TEXT[]` | e.g. `['edible fruit', 'nitrogen fixation', 'biomass', 'wildlife habitat']` |
| `ecosystem_functions` | `TEXT[]` | e.g. `['dynamic accumulator', 'insectary', 'erosion control']` |
| `propagation_methods` | `TEXT[]` | e.g. `['seed', 'cutting', 'division']` |
| `establishment_difficulty` | `TEXT` | `CHECK IN ('easy', 'moderate', 'difficult')` |
| `succession_role` | `TEXT` | `CHECK IN ('pioneer', 'early', 'mid', 'climax')` |
| `drought_tolerance` | `TEXT` | `CHECK IN ('low', 'moderate', 'high')` |
| `flood_tolerance` | `TEXT` | `CHECK IN ('low', 'moderate', 'high')` |
| `koppen_zones` | `TEXT[]` | e.g. `['Csb', 'Csa', 'Bsk']` — zones where plant is well-adapted |
| `maintenance_level` | `TEXT` | `CHECK IN ('low', 'moderate', 'high')` |

**Why TEXT[] for yields/ecosystem_functions:** Consistent with existing `permaculture_uses TEXT[]` and `bloom_months TEXT[]`. Native PostgreSQL array operators (`@>`, `&&`) work with GIN indexes. Avoids a normalized lookup table for data that's editorial/semi-structured and will vary per plant.

**Why NOT JSONB for these attributes:** The attributes are flat, enumerable, and filterable. JSONB adds query complexity with `->>`/`@>` operators while providing no structural benefit over typed columns. Reserve JSONB for truly schemaless nested data.

#### New Table: `plant_companions`

Companion relationships are many-to-many with typed relationships — requires a join table.

```sql
CREATE TABLE plant_companions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_id    UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  companion_id UUID NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  relationship_type TEXT CHECK (relationship_type IN ('beneficial', 'antagonist', 'neutral', 'guild_member')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (plant_id, companion_id)
);

ALTER TABLE plant_companions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plant_companions are publicly readable"
  ON plant_companions FOR SELECT USING (true);

CREATE INDEX ON plant_companions(plant_id);
CREATE INDEX ON plant_companions(companion_id);
```

**Why a separate table, not JSONB:** Companion relationships are bidirectional, queryable ("find all plants that are beneficial with X"), and benefit from FK integrity (cascade deletes when a plant is removed). JSONB cannot enforce FK constraints or bidirectional lookup efficiently.

**Why NOT a third-party companion planting API or dataset:** No production-quality free API exists. PFAF's data is not available via API; it's manually curated. The existing Claude Haiku enrichment pipeline is the right tool for bulk inference from the model's training data, supplemented by manual curation for high-value species.

#### Extended Claude Haiku Enrichment Scripts

**Recommended: Upgrade existing scripts to use structured outputs**

The `@anthropic-ai/sdk` 0.96.0 supports Claude Haiku 4.5 (`claude-haiku-4-5`) with structured JSON outputs. The current scripts use ad-hoc JSON parsing; switching to `output_config.format` with a Zod schema eliminates schema drift.

**Caution on Zod version:** Zod v4 was released in 2025 with significant breaking changes (error API, `z.strictObject()`, generic structure). The `@anthropic-ai/sdk` helpers use `zodOutputFormat` — verify SDK compatibility before upgrading to Zod v4. If the SDK ships its own Zod peer dependency, pin to that version. **Use Zod 3 (`zod@^3`) until the SDK explicitly documents Zod v4 support.**

New enrichment script: `scripts/backfill-functional-data.ts` — batch enriches `yields`, `ecosystem_functions`, `propagation_methods`, `establishment_difficulty`, `succession_role`, `drought_tolerance`, `flood_tolerance`, `koppen_zones`, `maintenance_level`. Use the same rate-limiting pattern (10 calls per 15s batch).

New enrichment script: `scripts/backfill-companions.ts` — for each plant, ask Haiku to return up to 10 known companion/antagonist pairings. Only insert rows where both plants exist in the `plants` table (join on `latin_name` or `common_name`). Log unmatchable companions for later resolution.

**Model to use:** `claude-haiku-4-5` — faster and cheaper than Sonnet for structured extraction tasks. Structured outputs are now GA on this model; no beta header required.

**No new npm packages required for enrichment.** The existing `@anthropic-ai/sdk` handles structured outputs. Add `zod@^3` as a devDependency if not already present.

---

### Domain 3: Server-Side Filtered and Paginated Plant Browsing

**Problem:** The plant browser currently loads the full catalog client-side on every page load. This needs to become a URL-driven server-side query with filtering and pagination.

#### URL State Management

**Recommended: nuqs ^2 (`nuqs@^2`)**

- Current version: 2.x (latest 2.8.x as of research date)
- Provides type-safe URL search params as React state (`useQueryState`, `useQueryStates`)
- Supports Next.js App Router natively (next@>=14.2.0 supported)
- Server-side parsing via `createSearchParamsCache` from `nuqs/server` — no prop drilling, RSC-compatible
- 6 kB gzipped
- Handles debounced URL updates, `useTransition` integration for loading states

**Why nuqs over manual URLSearchParams:** The current filter state is managed in component state and lost on navigation. nuqs makes filter state bookmarkable, shareable, and server-renderable with minimal boilerplate. The alternative (manual `useSearchParams` + `useRouter` + `URLSearchParams`) requires 30+ lines of error-prone synchronization code per filter.

**Why not React Query for this:** React Query solves client-side caching for async data, but the primary goal here is server-side rendering with URL-driven state. nuqs + RSC is the correct primitive; React Query would add client-side complexity to what should be a server-rendered page.

**Installation:**
```bash
npm install nuqs
```

**Adapter needed:** Wrap the root layout with `<NuqsAdapter>` from `nuqs/adapters/next/app`.

#### Server-Side Querying Pattern

No new library needed beyond the existing Supabase client. The pattern is:

1. `page.tsx` (RSC): receive `searchParams` prop, parse with `createSearchParamsCache` (nuqs), build Supabase query with `.eq()`, `.in()`, `.contains()`, `.overlaps()`, `.range()`, `.order()`
2. `useSearchParams()` + nuqs `useQueryStates()` in client filter components to update URL without full navigation
3. `<Suspense key={stableFilterKey}>` around the plant grid to show skeleton on filter changes

**Supabase query pattern:**
```typescript
// In a server component or async function called from RSC:
let query = supabase.from('plants').select('*', { count: 'estimated' });

if (params.sun) query = query.eq('sun', params.sun);
if (params.water) query = query.eq('water', params.water);
if (params.zone) query = query.gte('usda_zone_max', zoneMin).lte('usda_zone_min', zoneMax);
if (params.states?.length) query = query.overlaps('native_states', params.states);
if (params.uses?.length) query = query.overlaps('permaculture_uses', params.uses);

query = query.order('common_name').range(offset, offset + PAGE_SIZE - 1);
const { data, count } = await query;
```

#### Database Indexes Required

The following indexes are needed to make server-side filtering fast at scale. These go in a new migration:

```sql
-- GIN index for array column overlap/contains queries
CREATE INDEX plants_permaculture_uses_gin ON plants USING GIN (permaculture_uses);
CREATE INDEX plants_native_states_gin    ON plants USING GIN (native_states);
CREATE INDEX plants_bloom_months_gin     ON plants USING GIN (bloom_months);

-- B-tree indexes for equality/range filters
CREATE INDEX plants_sun   ON plants (sun);
CREATE INDEX plants_water ON plants (water);
CREATE INDEX plants_plant_type ON plants (plant_type);
CREATE INDEX plants_usda_zone_min ON plants (usda_zone_min);
CREATE INDEX plants_usda_zone_max ON plants (usda_zone_max);
CREATE INDEX plants_forest_garden_layer ON plants (forest_garden_layer);

-- For default sort
CREATE INDEX plants_common_name ON plants (common_name);
```

**Why GIN for arrays:** PostgreSQL will not use GIN with `=ANY()` — must use `&&` (overlaps) or `@>` (contains). The Supabase JS `.overlaps()` method maps to `&&` and is GIN-compatible. Confirmed by PostgreSQL docs and Supabase troubleshooting guide.

**Note on table size:** At ~250 plants (current) and even 5,000 plants (future), Postgres will often choose a sequential scan over an index for small tables. The indexes become important at 10,000+ rows. Add them now; they don't hurt small tables.

#### Full-Text Search

**Recommended: PostgreSQL native `tsvector` via Supabase `.textSearch()`**

No external search library (Algolia, Typesense, Elasticsearch) is warranted at this scale. Supabase's built-in full-text search via PostgreSQL is sufficient for a plant catalog of this size.

```sql
-- Add generated tsvector column for search
ALTER TABLE plants
  ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
      setweight(to_tsvector('english', coalesce(common_name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(latin_name, '')), 'A') ||
      setweight(to_tsvector('english', coalesce(description, '')), 'C')
    ) STORED;

CREATE INDEX plants_search_gin ON plants USING GIN (search_vector);
```

Client usage via Supabase JS: `.textSearch('search_vector', query, { type: 'websearch', config: 'english' })`.

**Why not Algolia/Typesense:** At <5,000 records, external search services add cost, another integration to maintain, and sync complexity with no meaningful performance benefit over PG FTS.

---

## Complete Dependency Delta

Only new packages to add to the project:

### Runtime Dependencies

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `nuqs` | `^2` | URL search param state management | Type-safe filter state in URL; RSC-compatible; eliminates manual URLSearchParams boilerplate |

### Development / Script Dependencies

| Package | Version | Purpose | Why |
|---------|---------|---------|-----|
| `zod` | `^3` | Schema validation for structured AI outputs | Required by `@anthropic-ai/sdk` `zodOutputFormat` helper; pin v3 until SDK documents v4 support |

### No New Dependencies

| Capability | How Achieved |
|------------|-------------|
| ZIP → coordinates | Direct `fetch()` to Open-Meteo API (no npm package needed) |
| Coordinates → Köppen class | Static lookup table bundled in `public/data/` + TypeScript module in `lib/koppen.ts` |
| Plant functional data enrichment | Extend existing `@anthropic-ai/sdk` scripts |
| Server-side pagination | Native Supabase `.range()` + `.order()` + URL `searchParams` |
| Full-text search | PostgreSQL `tsvector` + Supabase `.textSearch()` |
| Database indexes | SQL migration only |

---

## What NOT to Use and Why

| Option | Why Not |
|--------|---------|
| Google Geocoding API | Requires billing, API key management, and registration — unnecessary when Open-Meteo is free and keyless |
| Algolia / Typesense | External service cost and sync overhead at <5,000 records where PG FTS is sufficient |
| React Query / TanStack Query | Adds client-side caching layer to what should be server-rendered RSC data fetching; URL state via nuqs + RSC is the correct primitive |
| Zod v4 | Breaking changes from v3; `@anthropic-ai/sdk` `zodOutputFormat` compatibility with v4 unverified as of research date |
| geotiff (npm) for Köppen data | 1 km resolution GeoTIFF is overkill; 0.5-degree ASCII grid lookup is sufficient and zero-dependency |
| Third-party Köppen API | No production-quality free API exists for this; must use static dataset |
| JSONB for new plant attributes | Yields, tolerances are flat enumerable values; TEXT/TEXT[] columns are more queryable and type-safe |

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| nuqs version + Next.js 14 compatibility | HIGH | Official nuqs.dev docs + npm release history confirmed |
| Open-Meteo ZIP code geocoding | MEDIUM | Docs confirm ZIP accepted as `name` param; no formal specification that US ZIP codes are parsed as postal codes vs. city names |
| Köppen ASCII dataset availability | HIGH | Direct verification of koeppen-geiger.vu-wien.ac.at download page |
| No npm package for Köppen lookup | HIGH | Exhaustive npm/GitHub search; multiple query variations; no published package found |
| Claude Haiku 4.5 structured outputs GA | HIGH | Official Anthropic docs at platform.claude.com confirmed; no beta header required |
| Zod v3 vs v4 compatibility with SDK | MEDIUM | SDK ships zodOutputFormat helper; v4 breaking changes documented; official SDK Zod v4 compatibility not verified in docs |
| GIN index for array overlap queries | HIGH | Verified against PostgreSQL docs and Supabase troubleshooting guide; `&&` operator is GIN-compatible, `=ANY()` is not |
| tsvector FTS via Supabase | HIGH | Official Supabase docs; well-established PostgreSQL pattern |

---

## Sources

- Open-Meteo Geocoding API: https://open-meteo.com/en/docs/geocoding-api
- Köppen-Geiger data downloads (Vienna): http://koeppen-geiger.vu-wien.ac.at/shifts.htm
- Köppen-Geiger V3 high-res dataset: https://www.gloh2o.org/koppen/
- nuqs official docs: https://nuqs.dev/docs/installation
- Next.js canonical search/pagination pattern: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination
- Supabase full-text search: https://supabase.com/docs/guides/database/full-text-search
- PostgreSQL GIN index for arrays: https://www.tigerdata.com/learn/optimizing-array-queries-with-gin-indexes-in-postgresql
- Claude structured outputs (GA): https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Zod v4 migration guide: https://zod.dev/v4/changelog
- Supabase array filtering: https://www.restack.io/docs/supabase-knowledge-supabase-array-filtering
