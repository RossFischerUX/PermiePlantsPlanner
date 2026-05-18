# Domain Pitfalls

**Domain:** Permaculture plant database — Next.js 14 App Router + Supabase
**Researched:** 2026-05-18
**Scope:** Subsequent milestone adding server-side pagination, schema enrichment, RLS hardening, location personalization, and AI enrichment pipelines

---

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or production incidents.

---

### Pitfall 1: Suspense Boundary Omission When Migrating to URL-Driven Filters

**What goes wrong:** Moving filter state from `useState` to URL params requires `useSearchParams()` in the client component. Without a `<Suspense>` boundary wrapping the component that calls `useSearchParams()`, Next.js will opt the **entire page** into client-side rendering at build time. The production build fails with `missing-suspense-with-csr-bailout`. In development this silently passes — the error only surfaces during `npm run build`.

**Why it happens:** `useSearchParams()` reads from the URL, which is only known at request time, not prerender time. Next.js requires a Suspense boundary so the static shell above it can be prerendered as HTML while the dynamic, URL-aware portion hydrates separately.

**Consequences:** Either the build fails outright, or (if `dynamic = 'force-dynamic'` is used as a workaround) the entire plants page is server-rendered on every request with no static shell — eliminating the performance win you were trying to achieve.

**This codebase's current state:** `plants/page.tsx` already wraps `PlantsPageInner` in a `<Suspense>` shell for this exact reason (lines 1–10 of the exported default). The pattern is correct. Danger arises when the filter logic is extracted into a new server component and the boundary is removed or misplaced during refactoring.

**Prevention:**
- Keep the exported page default as a thin Suspense shell; move all `useSearchParams` usage inside the inner component
- The correct server-component pattern is to read `searchParams` from the page's `props` (not `useSearchParams`) and pass values down: `export default async function PlantsPage({ searchParams }) { ... }`
- If mixing RSC data fetching with client filter state, pass `searchParams` prop to the RSC for the initial server render and use `useSearchParams` in a child client component for subsequent client navigations — these are not mutually exclusive

**Warning sign:** `npm run build` passes locally in dev but CI build fails with "missing Suspense boundary" error. Or: switching to RSC approach and discovering `useSearchParams` was removed but the `<Suspense>` wrapper was also silently dropped.

**Phase to address:** Server-side pagination phase (Phase 1 / highest priority).

**Source:** https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout, https://nextjs.org/docs/app/api-reference/functions/use-search-params

---

### Pitfall 2: router.replace() Serving Stale Data After Filter Navigation

**What goes wrong:** The current implementation calls `router.replace()` whenever filter state changes, then re-fetches from Supabase on the client. When migrating to server-side filtering (RSC page reads `searchParams` prop), the App Router's client-side Router Cache may serve a cached version of the page after a `router.replace()` call, causing the filter to appear to change in the URL but the plant grid to not update.

**Why it happens:** In Next.js 14, `router.replace()` updates the URL but does not necessarily invalidate the Router Cache. The Router Cache can serve the previous RSC payload for the same route for a short TTL (30 seconds for dynamic routes, 5 minutes for static). `router.refresh()` invalidates the client cache for the current route but triggers a second server request — meaning two requests instead of one.

**Consequences:** Users change a filter, the URL updates, the grid doesn't change. This looks like a broken filter. The bug is intermittent and timing-dependent, making it hard to reproduce in development.

**Prevention:**
- Use `<Link href={newUrl}>` for filter navigation instead of programmatic `router.replace()` where possible — Link navigations invalidate the cache correctly
- If programmatic navigation is required, use `router.push()` rather than `router.replace()` for filter changes; reserve `replace` for clearing state
- In Next.js 15+, dynamic pages are no longer cached by default; this pitfall is most acute on Next.js 14
- Do not use `export const dynamic = 'force-dynamic'` as a blanket workaround — it eliminates static rendering benefits; instead, the page being dynamic because it reads `searchParams` is sufficient

**Warning sign:** Filters work in development (where Router Cache is disabled) but behave inconsistently in production/staging. Intermittent failures that resolve on hard refresh.

**Phase to address:** Server-side pagination phase.

**Source:** https://github.com/vercel/next.js/discussions/52012, https://nextjs.org/docs/app/getting-started/caching

---

### Pitfall 3: RLS Policy Added to `plant_list_items` That Silently Locks Out Presentation Pages

**What goes wrong:** The current `plant_list_items` RLS SELECT policy is `USING (true)` — intentionally open so that public presentation pages (`/presents/[shareId]`) can fetch list contents without authentication. If this is "fixed" by scoping SELECT to `auth.uid() = owner_id`, the presentation pages will return empty results. Supabase RLS returning empty rows is indistinguishable from "this list has no plants" in the app — no 403, no error, just an empty grid.

**Why it happens:** The presentation pages use the service role client OR the anon client without a user session. The correct fix is a policy that permits access either via `auth.uid() = owner_id` OR by proving the `list_id` belongs to a list whose `share_id` is known. PostgreSQL cannot express this as a simple column comparison — it requires a subquery join to `plant_lists`.

**Consequences:** Public presentation pages show no plants after the policy change. The feature appears broken. Data is not lost, but the Supabase anon key access (used in production presentation page requests) will be blocked.

**This codebase's current state:** The open `USING (true)` policy is documented in `CONCERNS.md` as a known issue. The risk is a well-intentioned "fix" that breaks sharing without realizing the dependency.

**Prevention:**
- Before changing any RLS SELECT policy, map every code path that reads from that table — both authenticated and unauthenticated
- The correct policy for `plant_list_items` is:
  ```sql
  USING (
    auth.uid() = (SELECT owner_id FROM plant_lists WHERE id = list_id)
    OR
    list_id IN (SELECT id FROM plant_lists WHERE share_id IS NOT NULL)
  )
  ```
  This is still overly permissive (anyone who knows any `list_id` can read it if the list has a `share_id`), but it documents the intent
- Test policy changes by running queries AS the anon role in the Supabase SQL editor using `SET ROLE anon;` — NOT as the postgres superuser (superuser bypasses RLS entirely, giving false confidence)
- Always pair a policy change with a migration that adds the new policy and drops the old one atomically; never leave the table in a state where it has RLS enabled but no SELECT policy (results in total lockout for non-superusers)

**Warning sign:** After a migration, `/presents/[shareId]` shows an empty plant grid despite the list having plants. Check `supabase.from('plant_list_items').select('*').eq('list_id', id)` in the browser console — if it returns `[]` with status 200, RLS is silently filtering rows.

**Phase to address:** Security hardening phase (can be paired with RLS audit, but must be tested before deployment).

**Source:** https://supabase.com/docs/guides/database/postgres/row-level-security, https://designrevision.com/blog/supabase-rls-guide

---

### Pitfall 4: AI Enrichment Produces Plausible But Wrong Enum Values That Poison the Filter System

**What goes wrong:** Claude Haiku generates JSON with enum fields like `"sun": "partial shade"` (not `"part shade"`), `"plant_type": "annual"` (not in the allowed set), or `"water": "medium"` (not `"moderate"`). The current scripts handle this with `normalizeEnum()`. If new enrichment fields are added — especially `companion_plants`, `functional_roles`, or `establishment_difficulty` — and the normalization step is omitted, invalid values will be silently inserted. These values then appear in the filter UI but return zero results when selected, because the CHECK constraint allows them only if the constraint is not yet defined, or they match no actual database records.

**Why it happens:** LLMs produce probabilistic output. Even with explicit enums in the prompt, the model occasionally uses synonyms, alternate capitalizations, or adjacent vocabulary. The existing import script is careful about this (lines 98–123 of `import-plants.ts`), but this discipline is easy to skip when writing a new backfill script under time pressure.

**Consequences:** Filter options in the UI return zero results for specific enum values (the "phantom filter" problem). Data looks present but is unusable for filtering. Detection requires querying `SELECT DISTINCT new_column FROM plants` and comparing against expected values.

**Prevention:**
- Define the allowed values for every new enum column as a TypeScript `const` array (following the existing `VALID_SUN`, `VALID_WATER`, `VALID_TYPE` pattern) and pass all enrichment output through `normalizeEnum()` before upsert
- Add PostgreSQL CHECK constraints on the column from the start of the migration, not after backfill; constraint violations are better than silent bad data
- For new array-type fields (like `companion_plants: string[]`), validate against a known vocabulary set — Claude will invent Latin names, common name variants, and near-synonyms
- Run a post-backfill SQL verification query before considering a backfill done: `SELECT COUNT(*) FROM plants WHERE new_column IS NOT NULL` and `SELECT DISTINCT new_column FROM plants ORDER BY 1`

**Warning sign:** A new filter option in the UI consistently returns zero results even though the column has data. `SELECT COUNT(*) FROM plants WHERE forest_garden_layer = 'shrub'` returns data but `WHERE forest_garden_layer = 'Shrub'` (capitalization mismatch) returns zero.

**Phase to address:** Any AI enrichment phase (companion planting, functional attributes, climate attributes). Must be addressed before the enrichment script runs on production data.

**Source:** https://dev.to/the_bookmaster/the-json-parsing-problem-thats-killing-your-ai-agent-reliability-4gjg, codebase review of `scripts/import-plants.ts:94–123`

---

## Moderate Pitfalls

---

### Pitfall 5: New Schema Columns Breaking TypeScript `Plant` Interface Sync

**What goes wrong:** Adding columns to the `plants` table via migrations does not automatically update `lib/types.ts`. The `Plant` interface is hand-maintained. When a new column is added (e.g., `companion_plants TEXT[]`, `drought_tolerance TEXT`, `koppen_zone TEXT`), any code that spreads or destructures `Plant` objects will not have TypeScript errors — the new column simply won't exist in the type and will be `undefined` at runtime. If the column has a non-null constraint but the type marks it as optional, silent `undefined` values get passed to UI rendering code.

**Why it happens:** There is no schema-to-type code generation (no Supabase CLI type generation, no PgTyped). The type system and the database schema drift independently.

**Consequences:** New columns are invisible to TypeScript strict mode. The compile step passes, but new features accessing the column work unreliably (especially on plants that were inserted before the backfill ran, where the column is NULL). Runtime errors appear as blank/missing UI elements rather than thrown exceptions.

**Prevention:**
- Add every new column to `lib/types.ts` in the same PR as the migration, with the correct nullability (new columns added via `ALTER TABLE ... ADD COLUMN` without a DEFAULT are NULL for existing rows — always type them as `| null` initially)
- Consider running `supabase gen types typescript` as part of the migration workflow to auto-generate a reference; even if you don't use the generated file directly, diffing it against `lib/types.ts` catches drift
- For each enrichment phase: (1) write migration, (2) update `lib/types.ts`, (3) update the scripts `HorticulturalData` interface, (4) run backfill — in that order

**Warning sign:** A newly added column renders as `undefined` in the UI on older plant records. TypeScript compiles clean but the feature doesn't work for plants that predate the backfill.

**Phase to address:** Every schema enrichment phase.

---

### Pitfall 6: RLS Policy Subquery Performance Degradation at Scale

**What goes wrong:** The existing `plant_list_items` INSERT/UPDATE/DELETE policies use a correlated subquery: `auth.uid() = (SELECT owner_id FROM plant_lists WHERE id = list_id)`. This is evaluated once per row checked. As user lists grow large (hundreds of items), this subquery fires repeatedly per query. Adding more RLS policies for new access patterns (e.g., shared list editing) that involve additional joins compounds this.

**Why it happens:** PostgreSQL evaluates RLS policies as implicit WHERE clause predicates. A correlated subquery is re-executed for each candidate row. The pattern `auth.uid() = (SELECT ...)` is already the recommended form (it evaluates `auth.uid()` once and caches it), but the subquery join to `plant_lists` still executes per row.

**Consequences:** Slow write operations on list items. `EXPLAIN ANALYZE` will show repeated `Index Scans on plant_lists`. Not critical at current scale (most lists have under 50 items), but important to monitor as lists grow.

**Prevention:**
- Add an index on `plant_list_items.list_id` if one doesn't exist (it should, as a foreign key, but verify with `\d plant_list_items` in psql)
- When writing new policies, prefer the pattern that lets PostgreSQL plan the subquery as an `initPlan` (cache once): `(select auth.uid()) = owner_id` rather than `auth.uid() = owner_id`
- Use `EXPLAIN (ANALYZE, BUFFERS)` in the Supabase SQL editor to verify policy cost — but remember the SQL editor runs as postgres superuser and bypasses RLS; use `SET ROLE authenticated; SET request.jwt.claims = '{"sub":"<real-user-uuid>"}';` to test as a real user

**Warning sign:** List item operations (add/remove/reorder) become noticeably slow as list sizes grow. Check Supabase Logs for slow queries on `plant_list_items`.

**Phase to address:** RLS hardening phase; also worth checking during drag-and-drop reorder implementation (bulk `sort_order` updates will execute many policy evaluations).

**Source:** https://supabase.com/docs/guides/database/postgres/row-level-security (auth function caching section)

---

### Pitfall 7: AI Enrichment Pipeline Partial Failures Without Resume Capability

**What goes wrong:** Running a backfill against 500–2,000 plants with Claude Haiku may fail partway through due to: API rate limit 429s (despite the 15s batch delay), network timeouts, iNaturalist API errors, or the process being killed. The current scripts lack a durable checkpoint. Re-running processes records already enriched (wasting API quota) or — if upsert logic is wrong — overwrites correct data with a second Claude hallucination.

**Why it happens:** The existing scripts are designed for a smaller catalog (~250 plants). At 1,000+ plants, the probability of at least one failure during a multi-hour run approaches 100%.

**Consequences:** Wasted Anthropic API spend (Haiku is cheap but not free). Potentially overwrites good data with bad on re-run. Operators have no way to tell which plants were processed without checking the database manually.

**Prevention:**
- The existing scripts already use idempotent upsert with `SUPABASE_SERVICE_ROLE_KEY` — this is good. But add a `skip if already populated` guard at the start of each record: `if (plant.new_column !== null) continue`
- Add a `--dry-run` flag that logs what would be enriched without writing
- Log progress to a local `.json` file (or a `backfill_log` table in Supabase) so runs can be resumed from the failure point: `{ plant_id, status: 'done'|'failed'|'skipped', error?, timestamp }`
- The existing `retry-skipped-plants.ts` script is the right pattern — maintain a separate retry list
- Test with `--pages 1` (existing flag) before full runs

**Warning sign:** A backfill script exits mid-run. Half the plants now have the new field populated and half don't. Running again risks clobbering already-correct data. Without a skip-if-populated guard, every restart re-processes everything.

**Phase to address:** Any backfill/enrichment phase (companion planting, functional attributes, climate data). The skip-if-populated pattern should be enforced as a convention in the script review.

**Source:** Codebase review of `scripts/import-plants.ts`, `scripts/retry-skipped-plants.ts`

---

### Pitfall 8: Location Personalization Relying on Browser Geolocation API Without Fallback

**What goes wrong:** The Köppen-Geiger climate personalization feature requires a user's geographic coordinates. The most obvious implementation is `navigator.geolocation.getCurrentPosition()`. This will fail silently or trigger a permission denial for: users who deny location access, users on desktop browsers without GPS, users with VPNs, and incognito mode. Without a fallback path (manual city/zip entry, IP geolocation, or "skip for now"), the personalization feature becomes completely non-functional for a significant portion of users.

**Why it happens:** Browser geolocation requires explicit permission. In private browsing it is typically auto-denied. Corporate VPNs and country-level restrictions further reduce reliability. The feature's usefulness is directly tied to how gracefully it degrades.

**Consequences:** A personalization feature that works for 40–60% of users and silently shows nothing to the rest creates a confusing experience. If the app silently falls back to showing unpersonalized results with no indication, users won't know the feature exists.

**Prevention:**
- Design the location feature with three input modes from the start: (1) browser geolocation, (2) typed city/zip (with geocoding via a free API like Open-Meteo or Nominatim), (3) explicit Köppen zone picker as a last resort
- Store the resolved climate zone (not raw coordinates) in a user preference or `localStorage` to avoid re-requesting permission on every visit
- The Köppen-Geiger classification API at `climateapi.scottpinkelman.com` accepts lat/lon and returns a classification code — but it rounds coordinates to the nearest 0.25 degree, which is acceptable for climate zone purposes
- GDPR/CCPA: treat raw coordinates as personal data; only store the derived climate zone code (e.g., "Csa" for Mediterranean), not the coordinates

**Warning sign:** Users report the personalization feature "not working" — these are users whose geolocation was denied. If the UI shows no indication that geolocation was attempted or that a fallback exists, users assume the feature is broken.

**Phase to address:** Location personalization phase; the fallback paths must be specced before building the happy path.

**Source:** https://github.com/sco-tt/Climate-Zone-API, browser Geolocation API spec (MDN), https://www.linkedin.com/advice/1/how-do-you-avoid-common-pitfalls-challenges-2e

---

## Minor Pitfalls

---

### Pitfall 9: `select('*')` Regression When Adding New Heavy Columns

**What goes wrong:** The plants table currently has ~25 columns. As the schema grows with functional attributes, companion plant arrays, and climate data, a `select('*')` on 2,000 plants could transfer significantly more data per row. The current client-side load already transfers 100–200KB; adding 10 new array columns (each potentially storing 5–20 values) could 3-5x this.

**Prevention:** When adding enrichment columns, always update the plant card projection query to list only the columns needed for the grid view. The card only needs: `id, common_name, latin_name, sun, water, plant_type, height_min, height_max, image_url, usda_zone_min, usda_zone_max, permaculture_uses`. Full `select('*')` should be reserved for the detail page.

**Warning sign:** Page load JSON payload increases noticeably after an enrichment migration. Measure with Chrome DevTools Network tab before and after adding columns.

**Phase to address:** Server-side pagination phase (move to projected select as part of the server query); and again at each enrichment phase.

---

### Pitfall 10: Playwright Tests Asserting Specific Plant Counts Break After Database Growth

**What goes wrong:** `tests/plants.spec.ts` asserts that searching "lavender" returns exactly 1 result and `count === 1`. Adding Lavender cultivars or importing more plants with "lavender" in the common name will break this test. The CI suite runs against production data — any plant database expansion triggers test failures unrelated to code changes.

**Prevention:** Replace exact count assertions with `expect(count).toBeGreaterThan(0)`. The existing test file already uses `toBeGreaterThan(0)` in other tests — apply this pattern consistently. When writing tests for new features (companion plant filter, climate filter), assert behavioral outcomes ("results reduced after applying filter") not specific plant names or counts.

**Warning sign:** A backfill that adds data causes CI test failures with no code changes deployed.

**Phase to address:** Database expansion phase (before adding plants); also at test authoring time for any new filter tests.

---

### Pitfall 11: Drag-and-Drop `sort_order` Bulk Update Races With RLS Subquery

**What goes wrong:** Implementing drag-and-drop reorder requires updating `sort_order` on potentially every item in the list (if using a simple integer sequence). A list with 50 plants requires 50 UPDATE statements, each triggering the RLS subquery `(SELECT owner_id FROM plant_lists WHERE id = list_id)`. This runs the subquery 50 times. With optimistic UI, all 50 fire nearly simultaneously.

**Prevention:** Use a sparse integer scheme (sort by multiples of 1000) to minimize the number of items that need updating on a reorder. Or pass the reorder as a single RPC call (Postgres function) that bypasses per-row RLS evaluation by running as security definer.

**Warning sign:** Drag-and-drop reorder is slow or produces intermittent 403 errors on individual items in the batch.

**Phase to address:** Drag-and-drop implementation phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|----------------|------------|
| Server-side pagination | Suspense boundary omission breaks production build | Keep thin Suspense shell on page export; test with `npm run build`, not just `npm run dev` |
| Server-side pagination | Router Cache serves stale filter results | Use `<Link>` navigation for filter changes; verify in production preview |
| Server-side pagination | `select('*')` still used after migration | Audit query projections in the same PR as the pagination change |
| RLS hardening | Fixing open SELECT policy breaks presentation pages | Map all unauthenticated read paths before changing any RLS policy |
| RLS hardening | Testing as superuser gives false confidence | Run `SET ROLE anon` in SQL editor to simulate real access |
| Schema enrichment | `Plant` TypeScript interface drifts from DB schema | Update `lib/types.ts` in the same commit as each migration |
| Schema enrichment | New enum values silently invalid | Add CHECK constraint + `normalizeEnum()` from day one, not after backfill |
| AI enrichment pipeline | Partial failure with no resume | Add `if (plant.new_field !== null) continue` skip guard before every enrichment batch |
| AI enrichment pipeline | Enum normalization missing on new fields | Follow existing `VALID_SUN`/`normalizeEnum` pattern; do not inline string comparison |
| Companion planting data | Plant name collisions (common vs. Latin) | Store companion relationships by `plant_id` UUID, not by name string |
| Location personalization | Geolocation permission denied | Implement city/zip fallback before shipping browser geolocation |
| Location personalization | Raw coordinates stored as personal data | Store derived zone code only (e.g., "Csa"), not lat/lon |
| Drag-and-drop reorder | Bulk `sort_order` updates hit RLS subquery 50x | Use sparse sort integers or a single security-definer RPC for reorder |
| Database expansion | Test suite asserts specific plant counts | Change to `toBeGreaterThan(0)` before any bulk plant import |

---

## Sources

- Next.js App Router `useSearchParams` docs: https://nextjs.org/docs/app/api-reference/functions/use-search-params
- Next.js missing Suspense boundary error: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
- Next.js common App Router mistakes: https://vercel.com/blog/common-mistakes-with-the-next-js-app-router-and-how-to-fix-them
- Supabase RLS official docs: https://supabase.com/docs/guides/database/postgres/row-level-security
- RLS performance (subquery caching): https://supaexplorer.com/best-practices/supabase-postgres/security-rls-performance/
- Idempotent RLS migrations: https://dev.to/nareshipme/how-we-made-our-supabase-rls-migrations-idempotent-and-why-you-should-too-4d2g
- LLM JSON parsing failures: https://dev.to/the_bookmaster/the-json-parsing-problem-thats-killing-your-ai-agent-reliability-4gjg
- Claude structured outputs: https://platform.claude.com/docs/en/build-with-claude/structured-outputs
- Köppen-Geiger Climate Zone API: https://github.com/sco-tt/Climate-Zone-API
- PostgreSQL schema migration pitfalls: https://postgres.ai/blog/20220525-common-db-schema-change-mistakes
- Next.js Router Cache stale data: https://github.com/vercel/next.js/discussions/52012
- Codebase: `scripts/import-plants.ts` (enum normalization pattern, lines 94–123)
- Codebase: `supabase/migrations/20260515024609_create_plant_lists_table.sql` (RLS policy audit)
- Codebase: `.planning/codebase/CONCERNS.md` (original concern audit, 2026-05-18)
