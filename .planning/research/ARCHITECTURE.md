# Architecture Patterns: Enriched Botanical Data

**Project:** Permaculture Plant Picker
**Domain:** Enriched botanical database — functional attributes, relationships, climate zones, personalization
**Researched:** 2026-05-18
**Overall confidence:** HIGH (all critical patterns verified against official PostgreSQL docs and Supabase docs)

---

## Existing Schema Baseline

The `plants` table already uses two patterns that inform all new additions:

- `permaculture_uses TEXT[]` — a `TEXT[]` array column for functional roles, already populated
- `native_states TEXT[]` — a `TEXT[]` array for state codes, filtered with `@>` (contains)
- `usda_zone_min / usda_zone_max INTEGER` — denormalized range integers for efficient range queries

These are the right patterns. The new additions should extend them consistently rather than introducing a separate paradigm.

---

## 1. Plant Functional Attributes

**Question:** How to model multi-valued functional data (nitrogen fixer, edible, pollinator attractor, etc.)?

**Recommendation: Extend `permaculture_uses TEXT[]` — do not normalize into a junction table.**

### Rationale

The `permaculture_uses TEXT[]` column already exists and is the right shape for this data. It stores categorical string tags. Normalized junction tables (`plant_functions`, `plant_function_map`) would be appropriate if:
- the attribute set were unbounded and user-defined
- you needed referential integrity on attribute names
- attributes themselves had rich metadata (descriptions, categories, icons stored in DB)

None of those apply here. The attribute vocabulary is fixed and curated. A junction table adds a JOIN on every plant fetch with no query benefit — GIN-indexed array containment queries are 4–7x faster than equivalent JOIN queries at typical dataset sizes (verified: medium.com/@sruthiganesh benchmark, 4.7ms vs 34ms at 50k rows). With 500–2000 plants, the performance gap is even more favoring the array approach.

### Schema

No migration needed for existing uses. Extend the vocabulary via enrichment scripts.

For attributes that require **quantified or ranged values** (e.g., yield estimates, establishment time, nitrogen contribution kg/yr), add JSONB alongside the tag array:

```sql
ALTER TABLE plants
  ADD COLUMN functional_attributes JSONB DEFAULT '{}';
```

Store only structured data in JSONB — not tags. The split is:
- `permaculture_uses TEXT[]` — what roles the plant fills (tags for filtering)
- `functional_attributes JSONB` — quantified or multi-key metadata about those roles

Example `functional_attributes` content:
```json
{
  "nitrogen_kg_per_year": 50,
  "propagation_methods": ["seed", "cutting", "division"],
  "succession_role": "pioneer",
  "establishment_difficulty": "easy",
  "maintenance_level": "low",
  "drought_tolerance": "high",
  "flood_tolerance": "low",
  "pollinator_types": ["bees", "butterflies"]
}
```

### Indexes

```sql
-- Existing: filter by functional role tags
CREATE INDEX IF NOT EXISTS plants_permaculture_uses_gin
  ON plants USING GIN (permaculture_uses);

-- New: filter/query functional attributes
CREATE INDEX IF NOT EXISTS plants_functional_attributes_gin
  ON plants USING GIN (functional_attributes);
```

### Query Patterns

Filter plants by functional role (existing pattern extended):
```sql
-- Plants that fix nitrogen AND produce food
SELECT id, common_name, latin_name
FROM plants
WHERE permaculture_uses @> ARRAY['nitrogen fixer', 'edible'];
```

Filter by quantified attribute in JSONB:
```sql
-- Plants with high drought tolerance
SELECT id, common_name
FROM plants
WHERE functional_attributes @> '{"drought_tolerance": "high"}';
```

Read a specific attribute for display:
```sql
SELECT id, common_name,
  functional_attributes->>'succession_role' AS succession_role,
  functional_attributes->'propagation_methods' AS propagation
FROM plants
WHERE id = $1;
```

### Enrichment Script Approach

The Claude Haiku enrichment pipeline already outputs `permaculture_uses` arrays. Extend the prompt to also output a `functional_attributes` JSON object. The backfill pattern is already established and idempotent — add a `backfill-functional-attributes` script that reads existing plants and populates the JSONB column, skipping rows where it is already populated and non-null.

---

## 2. Companion Planting Relationships

**Question:** Adjacency list vs. JSONB vs. dedicated relationship table for graph-like plant pairings?

**Recommendation: Dedicated symmetric relationship table with a `relationship_type` discriminator.**

### Rationale

Companion planting relationships are many-to-many and typed (beneficial, antagonistic, neutral/guild). They are not hierarchical (no parent/child), so recursive CTEs are unnecessary. The data is moderate in density (each plant has 5–30 relationships at most). JSONB on the plant row (e.g., `companions JSONB`) is tempting but breaks bidirectional queries — finding "what are the companions of Plant X?" requires scanning every plant's JSONB column unless you denormalize heavily. A normalized relationship table is the correct shape.

### Schema

```sql
CREATE TABLE plant_relationships (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_a_id      UUID    NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  plant_b_id      UUID    NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  relationship    TEXT    NOT NULL
    CHECK (relationship IN ('beneficial', 'antagonistic', 'guild', 'neutral')),
  mechanism       TEXT,    -- optional: "repels aphids", "fixes nitrogen for"
  confidence      TEXT    CHECK (confidence IN ('verified', 'traditional', 'anecdotal')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  -- Enforce canonical ordering: plant_a_id < plant_b_id
  -- prevents (A→B) and (B→A) duplicates
  CONSTRAINT plant_relationship_order CHECK (plant_a_id < plant_b_id),
  CONSTRAINT plant_relationship_unique UNIQUE (plant_a_id, plant_b_id, relationship)
);
```

The `plant_a_id < plant_b_id` constraint enforces canonical ordering so the same pair cannot be stored twice in opposite directions. Queries that need bidirectional results use a UNION.

### Indexes

```sql
CREATE INDEX plant_relationships_a ON plant_relationships (plant_a_id);
CREATE INDEX plant_relationships_b ON plant_relationships (plant_b_id);
CREATE INDEX plant_relationships_type ON plant_relationships (relationship);
```

### Query Patterns

All companions of a given plant (bidirectional):
```sql
SELECT
  CASE WHEN pr.plant_a_id = $1 THEN pr.plant_b_id ELSE pr.plant_a_id END AS companion_id,
  p.common_name,
  pr.relationship,
  pr.mechanism
FROM plant_relationships pr
JOIN plants p ON p.id = CASE
  WHEN pr.plant_a_id = $1 THEN pr.plant_b_id
  ELSE pr.plant_a_id
END
WHERE (pr.plant_a_id = $1 OR pr.plant_b_id = $1)
  AND pr.relationship = 'beneficial';
```

Guild detection — plants that are mutually compatible with a list of IDs (used for list compatibility checking):
```sql
-- Find antagonistic pairs within a user's plant list
SELECT
  pa.common_name AS plant_a,
  pb.common_name AS plant_b,
  pr.relationship
FROM plant_relationships pr
JOIN plants pa ON pa.id = pr.plant_a_id
JOIN plants pb ON pb.id = pr.plant_b_id
WHERE pr.relationship = 'antagonistic'
  AND pr.plant_a_id = ANY($1::uuid[])  -- $1 = array of plant IDs in the list
  AND pr.plant_b_id = ANY($1::uuid[]);
```

### RLS

```sql
ALTER TABLE plant_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read" ON plant_relationships FOR SELECT USING (true);
-- Writes restricted to service role (enrichment scripts only)
```

### Enrichment Approach

Relationship data comes from two sources:
1. Claude Haiku prompt during enrichment: "List 5–10 plants this plant is known to be beneficial with, and any known antagonists."
2. Manual curation for high-confidence entries.

The `confidence` column distinguishes AI-inferred (`anecdotal`) from verified literature sources (`verified`).

---

## 3. Köppen-Geiger Climate Zones

**Question:** Store polygons with PostGIS, or use a flat lookup table? How to match lat/lng to zone?

**Recommendation: Flat lookup table at 0.1-degree grid resolution. Do NOT use PostGIS for this use case.**

### Rationale

PostGIS is the right tool for arbitrary polygon operations (routing, bounding-box filtering, spatial joins). For Köppen-Geiger zone assignment, it is overkill:

- The Köppen-Geiger dataset (University of Melbourne, Peel et al.) is available as an ASCII raster at 0.1° × 0.1° resolution — that is 1800 × 3600 = 6.48M rows covering the globe. This is a fixed, static lookup.
- A lookup at 0.1° resolution means quantizing `lat` and `lng` to the nearest 0.1° and doing a primary key lookup — a single indexed scan, no polygon math required.
- PostGIS would require enabling the extension (available on Supabase but adds complexity), importing and indexing polygon geometry, and writing spatial queries via a database function — all for a lookup that a B-tree primary key serves in under 1ms.
- The US subset is roughly 350k rows — easily manageable.

The tradeoff: 0.1° grids are ~11km cells at the equator. For climate zones (which span hundreds of km) this resolution is more than adequate.

### Schema

```sql
CREATE TABLE koppen_zones (
  lat_grid   NUMERIC(5,1) NOT NULL,  -- e.g. 37.5
  lng_grid   NUMERIC(5,1) NOT NULL,  -- e.g. -122.0
  zone_code  CHAR(3)      NOT NULL,  -- e.g. 'Csb', 'Dfb', 'BWh'
  PRIMARY KEY (lat_grid, lng_grid)
);

CREATE INDEX koppen_zones_code ON koppen_zones (zone_code);
```

Import from the Peel et al. ASCII raster file (available at koeppen-geiger.vu-wien.ac.at) as a one-time data load via a migration or import script.

### Lookup Function

```sql
CREATE OR REPLACE FUNCTION get_koppen_zone(lat float, lng float)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT zone_code
  FROM koppen_zones
  WHERE lat_grid = ROUND(lat::numeric, 1)
    AND lng_grid = ROUND(lng::numeric, 1);
$$;
```

### Client Usage (Next.js)

The lookup is called once when a user sets or updates their location. The resolved `zone_code` is stored on the user profile (see section 4). No real-time spatial query is needed during plant browsing.

```typescript
// In a server action or API route handler
const { data } = await supabase
  .rpc('get_koppen_zone', { lat: userLat, lng: userLng });
// → 'Csb'
```

### Zone Groupings

The 30 Köppen-Geiger zone codes collapse into 5 major groups for UI display and coarse filtering:

| Code prefix | Group | Label |
|-------------|-------|-------|
| A (Af, Am, Aw) | Tropical | Tropical |
| B (BWh, BWk, BSh, BSk) | Arid | Arid / Desert |
| C (Cfa, Cfb, Csa, Csb, Csc, Cwa, Cwb) | Temperate | Temperate |
| D (Dfa, Dfb, Dfc, Dsa, Dsb, ...) | Continental | Continental |
| E (ET, EF) | Polar | Polar / Alpine |

Store the full code on the user profile; derive the major group in application code. This allows fine-grained matching without committing to a coarse schema.

### Data Load Note

The ASCII raster file from Peel et al. (vu-wien.ac.at) is space-delimited: `LAT LNG ZONE`. A simple Node.js import script can parse and bulk-insert via Supabase service role. The file is ~30MB uncompressed; COPY is the right mechanism. This is a one-time operation — climate zones do not change on a planning horizon.

---

## 4. Location Personalization

**Question:** Where to store user location preferences and how to use them in query weighting?

**Recommendation: `user_profiles` table; personalization as ORDER BY computed relevance score in Supabase RPC functions.**

### Schema

```sql
CREATE TABLE user_profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  koppen_zone    CHAR(3),          -- resolved zone code, e.g. 'Csb'
  lat            NUMERIC(7,4),     -- stored for re-resolution on map updates
  lng            NUMERIC(7,4),
  usda_zone_min  INTEGER,          -- user's local USDA zone (half-zone int)
  usda_zone_max  INTEGER,          -- typically equal to usda_zone_min or +1
  state_code     CHAR(2),          -- e.g. 'CA'; drives native species relevance
  display_name   TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX user_profiles_koppen ON user_profiles (koppen_zone);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own profile"
  ON user_profiles FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users update own profile"
  ON user_profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY "Users insert own profile"
  ON user_profiles FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = id);
```

The `(SELECT auth.uid())` wrapper (not bare `auth.uid()`) is the Supabase-recommended pattern — it caches the result per query rather than evaluating per row.

A Postgres trigger creates the profile row automatically on `auth.users` insert:

```sql
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.user_profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();
```

### Location Update Flow

1. User enters location (address or lat/lng) in a settings page.
2. Client geocodes to lat/lng (browser Geolocation API or a geocoding service like Nominatim — no API key required for low-volume use).
3. Client calls a server action that:
   a. Calls `get_koppen_zone(lat, lng)` to resolve the zone code.
   b. UPSERTs `user_profiles` with `lat`, `lng`, `koppen_zone`, `usda_zone_min`, and `state_code`.
4. On subsequent browsing sessions, the profile is fetched alongside `auth.getUser()` in the layout RSC and passed down as a prop.

### Query Weighting

Personalization is applied as a computed relevance score, not as hard filters. This surfaces regionally relevant plants at the top while keeping the full catalog accessible.

**Pattern: Supabase RPC function with ORDER BY computed score.**

```sql
CREATE OR REPLACE FUNCTION get_plants_personalized(
  p_koppen_zone TEXT,
  p_usda_zone   INTEGER,
  p_state_code  TEXT,
  p_limit       INTEGER DEFAULT 50,
  p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
  id            UUID,
  common_name   TEXT,
  latin_name    TEXT,
  sun           TEXT,
  water         TEXT,
  plant_type    TEXT,
  image_url     TEXT,
  permaculture_uses TEXT[],
  relevance_score INTEGER
)
LANGUAGE sql STABLE AS $$
  SELECT
    p.id, p.common_name, p.latin_name,
    p.sun, p.water, p.plant_type, p.image_url, p.permaculture_uses,
    (
      -- Zone overlap score: 2 points if USDA zone is within plant's range
      CASE WHEN p_usda_zone BETWEEN COALESCE(p.usda_zone_min, 0)
                                AND COALESCE(p.usda_zone_max, 40)
           THEN 2 ELSE 0 END
      +
      -- Native to user's state: 1 point
      CASE WHEN p_state_code IS NOT NULL
            AND p.native_states @> ARRAY[p_state_code]
           THEN 1 ELSE 0 END
      +
      -- Not invasive in user's state: small penalty for invasive flag
      CASE WHEN p.is_invasive THEN -1 ELSE 0 END
    ) AS relevance_score
  FROM plants p
  ORDER BY relevance_score DESC, p.common_name ASC
  LIMIT p_limit OFFSET p_offset;
$$;
```

Called from a server component:
```typescript
const { data: plants } = await supabase.rpc('get_plants_personalized', {
  p_koppen_zone: profile.koppen_zone,
  p_usda_zone: profile.usda_zone_min,
  p_state_code: profile.state_code,
  p_limit: 50,
  p_offset: 0,
});
```

This approach is compatible with the planned migration away from client-side full-table load. The same RPC can accept additional filter parameters (sun, water, plant_type) to replace the in-memory filtering in `plants/page.tsx`.

### Non-Personalized Fallback

When no profile exists (unauthenticated or no location set), fall back to the existing query (`plants` table, no ordering by relevance). The RPC function is only called when `profile?.koppen_zone` is non-null.

---

## Component Boundaries and Data Flow

```
Browser
  └── plants/page.tsx ('use client')
        │
        ├── [no profile]  → supabase.from('plants').select(...) [existing]
        │
        └── [profile set] → supabase.rpc('get_plants_personalized', {...})
                              returns same card shape + relevance_score

  └── plants/[id]/page.tsx (RSC)
        │
        ├── supabase.from('plants').select('*, functional_attributes, permaculture_uses')
        └── supabase.from('plant_relationships')
              .select('plant_b_id, relationship, mechanism, plants!plant_b_id(common_name)')
              .or(`plant_a_id.eq.${id},plant_b_id.eq.${id}`)
              .eq('relationship', 'beneficial')

  └── (app)/layout.tsx (RSC)
        └── supabase.from('user_profiles').select('*').eq('id', user.id)
              → pass profile as prop to page (or via server context)

Settings Page (new)
  └── LocationPicker ('use client')
        └── browser.navigator.geolocation / Nominatim geocode
        └── supabase.rpc('get_koppen_zone', { lat, lng }) → zone_code
        └── supabase.from('user_profiles').upsert({ id, lat, lng, koppen_zone, ... })
```

---

## Migration Order

1. **`functional_attributes JSONB` on `plants`** — non-breaking column addition; no data loss; enrichment scripts populate async.
2. **`plant_relationships` table** — new table; zero dependencies on plants schema changes.
3. **`koppen_zones` lookup table** — static data table; one-time import script; no app dependencies until personalization ships.
4. **`user_profiles` table + trigger** — depends on nothing above; creates profiles for new users immediately; existing users get profiles on first profile-touching action.
5. **`get_plants_personalized` RPC** — depends on `user_profiles` and `koppen_zones` existing; replaces client-side filtering.

Each step is independently deployable. Steps 1–4 are dark (no UI change); step 5 is the feature activation.

---

## Anti-Patterns Avoided

**JSONB for companion relationships:** Would require scanning every plant's JSONB column to find what companions Plant X has — no index helps this. The relationship table with GIN-indexed lookups on both `plant_a_id` and `plant_b_id` answers the query in a single index scan.

**PostGIS for zone lookup:** Polygon containment queries are unnecessary when the data is rasterized at 0.1° resolution. The PRIMARY KEY lookup is simpler, faster, and requires no extension dependency.

**Hard-filtering by climate zone:** Using the user's zone as a hard WHERE filter (only show plants rated for zone X) eliminates plants that are marginally outside the zone but might work with microclimate adjustments. Weighted scoring surfaces zone-compatible plants at the top without hiding everything else — which is the correct UX for a discovery tool.

**Junction table for functional attributes:** Adding a `plant_functions` vocabulary table and `plant_function_map` join table would require a JOIN on every plant fetch and complicate the enrichment pipeline with no query benefit for a fixed-vocabulary tag system. The existing `TEXT[]` pattern is correct and already proven in the codebase.

---

## Confidence Assessment

| Area | Confidence | Source |
|------|------------|--------|
| TEXT[] + GIN for functional tags | HIGH | Official PostgreSQL docs (GIN array operators) + benchmark data |
| JSONB for structured attributes | HIGH | Official PostgreSQL docs (jsonb indexing, @> operator) |
| Relationship table schema | HIGH | Standard PostgreSQL many-to-many pattern; verified in docs |
| 0.1° lookup table for Köppen | MEDIUM | Data format confirmed (vu-wien.ac.at ASCII raster); PRIMARY KEY lookup pattern is standard; import script is straightforward but untested |
| user_profiles + trigger pattern | HIGH | Verified against Supabase RLS docs and MakerKit production patterns |
| Weighted ORDER BY RPC | HIGH | Standard PostgreSQL computed column in ORDER BY; STABLE function for plan caching |

---

## Sources

- PostgreSQL current docs — GIN indexes for arrays and JSONB: https://www.postgresql.org/docs/current/gin.html
- PostgreSQL current docs — JSONB indexing and `@>` operator: https://www.postgresql.org/docs/current/datatype-json.html
- PostgreSQL current docs — Recursive CTEs (WITH RECURSIVE): https://www.postgresql.org/docs/current/queries-with.html
- JSONB vs JOIN benchmark (Sruthi Ganesh, 2025): https://medium.com/@sruthiganesh/comparing-query-performance-in-postgresql-jsonb-vs-join-queries-e4832342d750
- Supabase PostGIS docs: https://supabase.com/docs/guides/database/extensions/postgis
- Supabase RLS best practices (MakerKit): https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- Köppen-Geiger data (Peel et al., ASCII raster): https://people.eng.unimelb.edu.au/mpeel/koppen.html
- Köppen-Geiger high-resolution data (Beck et al. 2023, CC BY 4.0): https://www.gloh2o.org/koppen/
