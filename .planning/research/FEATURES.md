# Feature Landscape: Permaculture Plant Database (Next Milestone)

**Domain:** Permaculture / food forest plant reference and design tool
**Researched:** 2026-05-18
**Context:** Subsequent milestone — core browsing, filtering, user accounts, and shareable lists already exist. Researching what to build next.

---

## Background: What the Ecosystem Gets Right and Wrong

**PFAF (Plants for a Future)** is the canonical reference in this space — 7,000+ plants, deeply curated functional data (edibility ratings, medicinal ratings, other-uses ratings, propagation, soil preferences, wildlife notes). Practitioners describe it as having "no single better source" for permaculture design. Its weaknesses are well-documented: server instability, search interface produces errors on multi-criteria queries, no regional personalization, no modern UX, no mobile support, data is static with no user-facing enrichment pipeline, and it exposes raw text fields that require practitioners to interpret rather than filter. Users have built offline query tools (Permaflorae) just to work around its search limitations.

**Natural Capital Plant Database (permacultureplantdata.com)** goes deeper on ecological relationships — tracks polyculture design types with validation status (candidate/testing/validated), niche roles, soil organism associates. Strong on ecological theory, weak on UX and regional relevance.

**Permaculture Plants (permacultureplants.com)** uses a clean function taxonomy: 14 functional categories (nitrogen fixer, dynamic accumulator, insectary, chop-and-drop, edible, medicinal, wildlife benefit, erosion control, etc.) plus forest layer (7 layers), climate region (8 zones), and plant attributes (calorie crop, cold hardy, legume, etc.). Good signal on how to structure functional filters.

**SAGE app** is the closest to what this project is building — guild builder, crop planner, climate-zone-aware suggestions, plant data editing, harvest logging. But its primary use case is annual vegetable planning; perennial/food-forest data depth is weak.

**GrowVeg** does location-aware scheduling (frost dates from 5,000+ weather stations, ZIP code lookup) extremely well for annuals. Companion planting is binary (good/bad neighbor). No permaculture functional data.

**Agroforestry Research Trust** — no online database; Martin Crawford's books are the reference, not a queryable tool. Their plant nursery spun off in January 2026 to "Edible Canopy." This is a gap the project can fill.

**Key insight from practitioner forums:** Permaculture designers want *interconnected* plant data, not isolated species profiles. The current state of every tool is that plants are islands — you look them up one at a time. Nobody has built a tool that surfaces relationships (guilds, companions, functional complements) as a first-class design primitive.

---

## Table Stakes

Features users expect from any serious plant reference tool. Missing these means practitioners stay with PFAF or leave.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Functional role tags** — nitrogen fixer, dynamic accumulator, insectary, chop-and-drop, ground cover, edible, medicinal, wildlife benefit | Every permaculture resource (PFAF, permacultureplants.com, SAGE) structures data this way. These are the *vocabulary* of the domain. Practitioners filter by them constantly. | Medium | Boolean flags per plant. At minimum: nitrogen_fixer, dynamic_accumulator, insectary, wildlife_value, edible (already implicit), medicinal. Can be added as DB columns or a JSONB functions array. |
| **Forest layer classification** | The 7-layer food forest model (canopy, sub-canopy, shrub, herbaceous, ground cover, vine, rhizosphere/root) is the foundational design framework. A plant database without layer assignment is incomplete for any food forest designer. | Low | Enum or multi-select. Standard taxonomy, well-established. |
| **Edible parts** | "What do I harvest from this plant?" is the first question homesteaders ask. PFAF tracks leaf/fruit/nut/root/seed/shoot/bark. Without this, the database can't answer basic design questions. | Low | Multi-select enum: fruit, nut, leaf, shoot, root, seed, bark, flower. |
| **Bloom and harvest season** | Designers need to know when a plant is productive to ensure year-round yields and pollinator forage across seasons. Martin Crawford's harvest calendar is one of ART's most valued outputs. | Medium | Month-range fields: bloom_start, bloom_end, harvest_start, harvest_end (1–12 integers). |
| **Mature height and spread** | Required for layer placement decisions and spacing. Every plant reference includes this. | Low | Already likely partial data — needs to be consistently populated. |
| **Propagation methods** | Homesteaders propagating from cuttings/divisions/seed dramatically reduce establishment cost. This is near-universally requested in practitioner forums. | Low | Multi-select: seed, cutting, division, layering, grafting, transplant. |
| **Growth rate** | Slow/medium/fast — affects succession planning and when a plant contributes to the system. Critical for pioneer vs. climax species decisions. | Low | Enum: slow/medium/fast. |

---

## Differentiators

Features that set this platform apart. Not expected by users used to PFAF, but high value and low availability elsewhere.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Location-based climate personalization** | User enters location (ZIP or city) → system infers Köppen-Geiger climate zone → filters and UI weight shift to surface the most relevant data dimensions for that climate (drought tolerance front-and-center in Mediterranean; flood tolerance in subtropical). No competitor does this for permaculture plants. | High | Köppen-Geiger data is available as a downloadable GeoTIFF raster or via APIs (koppen.earth, gloh2o.org/koppen). Lat/lon lookup → climate zone classification → stored on user profile. Affects filter defaults and plant card display priorities, not the data itself. Scoped to PROJECT.md as "Pending" key decision. |
| **Companion planting relationships with mechanism** | Most tools give binary "good/bad neighbor" (Planter, GrowVeg). The research-backed data model uses weighted relationships: HELPS (pollinator attraction, nitrogen provision, pest suppression, allelopathy avoidance) and AVOIDS. Surfacing the *mechanism* (e.g., "comfrey accumulates calcium/potassium — chop-and-drop near fruit trees") is uniquely useful. Knowledge graph has 162 plant nodes, 1,455 HELPS and 404 AVOIDS relations as a known baseline. | High | Relational table: plant_relationships (plant_a_id, plant_b_id, relationship_type ENUM, mechanism TEXT, confidence ENUM). Display on plant detail as "grows well with" / "avoid near" sections. Do not try to build a guild canvas — that is spatial tooling, which is out of scope. |
| **Succession role classification** | Pioneer / nurse / climax / support — critical for designing phased food forests. No competitor database surfaces this cleanly as a filterable dimension. Practitioners currently piece this together from multiple sources. | Low | Enum: pioneer, support, climax, multi-role. Informed by growth rate + nitrogen fixing status — can be partially inferred by AI enrichment script. |
| **Establishment difficulty and time to productive contribution** | "How hard is this to get started?" and "How long until it earns its place?" are the two questions homesteaders ask before committing to a plant. PFAF buries this in prose. Structured 1–5 difficulty rating + "years to first harvest" integer is highly actionable and not available elsewhere as a filter. | Medium | establishment_difficulty (1–5 integer), years_to_bearing (integer, nullable for non-fruiting plants). Can be AI-enriched in pipeline. |
| **Dynamic accumulator mineral specificity** | PFAF says "dynamic accumulator" as a binary. Research (Cornell Small Farms, 2022) has identified 340 qualifying species with specific mineral concentration data — calcium, potassium, phosphorus, magnesium, trace minerals. Showing *which minerals* a plant accumulates makes chop-and-drop decisions design-informed rather than generic. | Medium | Text array or JSONB: accumulated_minerals: ['calcium','potassium','phosphorus']. Data partially available from Dr. Duke's phytochemical databases and Cornell's 2022 study. |
| **Seasonal yield timeline / harvest calendar** | Displaying a plant's bloom → harvest arc visually (even as a simple month bar) answers the #1 food forest design question: "Do I have something producing in every month?" No competitor renders this visually at plant card level. | Medium | Renders from bloom_start/bloom_end/harvest_start/harvest_end already proposed above. Low schema cost, high display value. |
| **Server-side filtered and paginated browsing** | Currently a critical tech-debt item (full catalog loaded client-side). Beyond fixing the technical debt, proper server-side filtering enables filters over new functional dimensions (forest layer, succession role, nitrogen fixer) without browser performance degradation. This is table stakes UX at scale — moving it here because it *enables* the differentiating features. | High | See PROJECT.md Active requirements. Must be done before functional filters are practical. |

---

## Anti-Features

Things to deliberately NOT build in this milestone, with rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Companion planting guild canvas / spatial layout** | Explicitly out of scope in PROJECT.md. Requires building a spatial design tool — a different product than a database. Every tool that has tried to bolt this on has created UX debt (see SAGE's designer feature complexity). | Surface companion relationships as data on the plant detail page and in list context. Let the user's mental model do the spatial work. |
| **UGC plant data editing / wiki model** | Also out of scope in PROJECT.md. Data quality moat depends on curated, sourced data — not crowd-sourced edits. Community wikis for plant data (e.g., Open Farm wiki) have historically had quality collapse problems. | Build the AI enrichment pipeline to be the authoritative data source. Surface source attribution ("Source: PFAF", "Source: Cornell 2022") instead of edit controls. |
| **Exhaustive companion planting coverage** | The data for companion planting relationships is large, contested, and highly variable by region. Trying to be comprehensive before the core functional data is solid will create a maintenance burden with low signal/noise. | Start with the ~500 most-used permaculture plants × known, high-confidence relationships. Flag confidence levels (observed/published/anecdotal). |
| **Maintenance scheduling / calendar notifications** | PROJECT.md explicitly defers this. Creates product complexity and push notification infrastructure before the core database value is proven. | Harvest season data (bloom/harvest months) is sufficient for designers at this stage without active scheduling logic. |
| **Native county-level granularity** | The Flora API backfill script exists but is deferred. County-level native range data is expensive to source, hard to maintain, and marginal compared to state-level + climate zone for most design decisions. | State-level native range + Köppen-Geiger climate personalization covers 95% of the regional relevance value. |
| **Caloric yield / food production calculators** | Tools like CropCircleFarms.com do yield estimation; it requires per-variety data that is highly cultivation-specific. Wrong for a species-level database. | Surface "calorie crop" as a boolean functional tag. Let yield estimation be a future premium feature if market signals warrant it. |
| **Paid/freemium gating in this milestone** | Business model is TBD (PROJECT.md). Introducing paywalls before the database has proven value alienates early practitioners who are the most valuable feedback source. | Keep all database features open. Auth exists; feature gating can be added to existing list features when monetization strategy is decided. |

---

## Feature Dependencies

```
Server-side filtering (paginated queries)
  → Functional role filters (nitrogen fixer, forest layer, etc.) — can't filter in-DB what doesn't exist in DB
  → Companion planting filter ("show plants that help X") — requires relational DB query

Functional role tags (schema columns)
  → Forest layer filter
  → Succession role filter
  → Dynamic accumulator mineral display
  → Companion planting mechanism display

Bloom/harvest month data
  → Seasonal yield timeline visualization
  → "Season coverage" check in list reports

Location input + Köppen-Geiger inference
  → Climate-weighted filter defaults
  → "Suitable for your climate" badge on plant cards
  → Regional companion planting relevance scoring (later)
```

---

## MVP Recommendation for This Milestone

Build in this order, because each unlocks the next:

1. **Server-side filtered browsing with pagination** — technical prerequisite for everything else. Without this, adding new filter dimensions just adds to an already-overloaded client payload.

2. **Functional role tags** (nitrogen_fixer, dynamic_accumulator, insectary, wildlife_value, medicinal) + **forest layer** + **succession role** — these are the vocabulary of the domain. AI enrichment pipeline already exists; extend it to populate these fields. Makes the filter UI immediately more useful than PFAF.

3. **Edible parts + bloom/harvest season** — low schema cost, high display value. Enables seasonal planning in the existing list report page.

4. **Establishment difficulty + propagation methods** — answers the "can I actually grow this?" question that PFAF answers poorly. Differentiating and achievable with AI enrichment.

5. **Companion planting relationships (basic HELPS/AVOIDS)** — start with a curated seed set of the 50–100 most common permaculture plant pairs. Display on plant detail page only. Do not build a search-by-companion filter until relationship data is dense enough to be useful (> 500 relationships).

6. **Location-based climate personalization** (Köppen-Geiger) — deliver last because it requires both the functional data (steps 2–4) to be worth personalizing, and is the highest-complexity item. A ZIP code input that infers climate zone and filters to climate-matched plants is the minimum viable version.

Defer: Dynamic accumulator mineral specificity, seasonal yield timeline visualization, native county granularity.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Functional role taxonomy | HIGH | Consistent across PFAF, permacultureplants.com, Natural Capital DB, academic literature |
| Forest layer classification | HIGH | Universal in permaculture literature — 7-layer model is canonical |
| Companion planting data model | HIGH | Knowledge graph research (TowardsDataScience) + Plant Anywhere confirms HELPS/AVOIDS as the right primitive |
| Köppen-Geiger personalization approach | MEDIUM | Technically feasible; no competitor has done it for permaculture plants specifically, so product-market fit is unproven |
| Establishment difficulty as differentiator | MEDIUM | Practitioner demand is clear from forums; no tool structures this well; data quality depends on AI enrichment accuracy |
| Dynamic accumulator mineral specificity | MEDIUM | Cornell 2022 study confirms 340 species with structured data; integration effort is real |
| Caloric yield scope exclusion | HIGH | Yield is cultivation-variety-specific; wrong granularity for species-level database |

---

## Sources

- [PFAF Plant Detail Page (Corylus avellana)](https://pfaf.org/user/Plant.aspx?LatinName=Corylus+avellana) — field structure reference
- [Natural Capital Plant Database — How to Use](https://permacultureplantdata.com/plant-database) — polyculture types, ecological function categories
- [Permaculture Plants — Dynamic Accumulator Function Page](https://permacultureplants.com/functions/dynamic-accumulator/) — 14-function taxonomy, 7 forest layers, climate regions
- [Permies Forum — Ultimate Permaculture Plant Database](https://permies.com/t/130942/Ultimate-Permaculture-Plant-Database) — practitioner requests: interconnected data, guild families, localized relationships
- [Permies Forum — Permaculture Plant Database](https://permies.com/t/11247/Permaculture-plant-database) — PFAF frustrations, offline tool workarounds
- [Permablitz Melbourne — PFAF as Designer's Bounty](https://www.permablitz.net/articles/pfaf-permaculture-designers-bounty-plant-info/) — practitioner praise and implicit gaps
- [Towards Data Science — Companion Plant Knowledge Graph](https://towardsdatascience.com/maintain-a-companion-plant-knowledge-graph-in-google-sheets-and-neo4j-4142c0a5065b/) — HELPS/AVOIDS data model, 162 plants, 2,182 relations
- [Permaculture Apprentice — Food Forest Plant List Using PFAF](https://permacultureapprentice.com/food-forest-plant-list-pfaf/) — key search criteria, limitations of single-plant lookup
- [Permaculture Apprentice — Choosing Plants for Food Forest](https://permacultureapprentice.com/choosing-plants-food-forest/) — site-context dimensions, layer placement
- [Leaftide — Best Garden Planning Apps 2026](https://leaftide.com/learn/best-garden-planning-apps/) — permanent plant tracking gap, mixed garden support gap
- [SAGE App — Permaculture Gardens](https://www.permaculturegardens.org/sage-app) — guild builder, climate-zone suggestions, harvest logging features
- [Cornell Small Farms — Dynamic Accumulator Research](https://smallfarms.cornell.edu/2022/04/new-findings-further-the-study-of-dynamic-accumulators/) — 340 qualifying species, structured mineral concentration data
- [Agroforestry Research Trust](https://www.agroforestry.co.uk/) — no online database; harvest calendar and fact sheets only; nursery transferred to Edible Canopy Jan 2026
- [Deep Green Permaculture — Succession Roles](https://deepgreenpermaculture.com/permaculture/permaculture-design-principles/8-accelerating-succession-and-evolution/) — pioneer/climax/nurse plant classification
- [Dustin Bajer — Cold Hardy Food Forest Plant List](https://dustinbajer.com/cold-hardy-food-forest-plant-list/) — layer + edible component tagging as a practical reference format
