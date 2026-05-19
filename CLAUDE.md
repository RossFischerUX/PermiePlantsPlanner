# Permaculture Plant Picker — Claude Code Guide

## Project Overview
Next.js 14 (App Router) + Supabase app for landscape professionals to browse a permaculture plant database, build curated lists, and share public presentation pages. Plant data is enriched via the Claude API (claude-haiku) and iNaturalist taxonomy.

## Tech Stack
- **Framework:** Next.js 14.2, React 18, TypeScript 5 (strict)
- **Styling:** Tailwind CSS 3.4 — utility-first, no component library
- **Backend:** Supabase (PostgreSQL + RLS + Auth)
- **Testing:** Playwright E2E only (no unit/jest)
- **Data scripts:** tsx + @anthropic-ai/sdk + iNaturalist API
- **Deployment:** Vercel

## Common Commands
```bash
npm run dev          # local dev server
npm run build        # production build
npm run lint         # ESLint (Next.js built-in)
npx playwright test  # run E2E tests (hits production URL)
```

## Dev Server
Always start the dev server on port 3000. Before running `npm run dev`, kill any existing process on that port:
```bash
kill $(lsof -ti :3000) 2>/dev/null; npm run dev
```
Never let Next.js fall back to 3001, 3002, etc. — kill the stale server first.

## Architecture
- `app/layout.tsx` — root layout: HTML shell, fonts, globals only (no nav/footer)
- `app/(app)/` — route group for all app pages that need nav + footer
  - `app/(app)/layout.tsx` — sticky nav + footer, fetches auth user
  - `app/(app)/NavUser.tsx` — client component for user menu / sign-out
  - `app/(app)/page.tsx` — home / landing page
  - `app/(app)/plants/` — plant browser and detail pages
  - `app/(app)/auth/` — login, signup, signout, forgot-password, reset-password pages
  - `app/(app)/lists/` — My Lists dashboard and list editor
- `app/presents/` — public shareable pages, **outside (app) group** — no nav/footer by design (client-facing)
  - `app/presents/[shareId]/page.tsx` — plant grid presentation
  - `app/presents/[shareId]/reports/page.tsx` — water/bloom/season tables
- `lib/` — shared types (`types.ts`) and Supabase helpers
  - `lib/supabase/server.ts` — server components / route handlers
  - `lib/supabase/client.ts` — browser / client components
- `app/api/auth/callback/` — Supabase auth callback route (exchanges token_hash or PKCE code for session)
- `scripts/` — data import/enrichment pipelines (excluded from TS build)
- `supabase/migrations/` — ordered SQL migrations
- `supabase/templates/` — branded HTML email templates (confirmation, recovery)

**Route groups:** The `(app)` folder name is invisible to the URL router. Adding new pages that need the nav/footer goes in `app/(app)/`. Pages that should be standalone (e.g. future embed views) go at `app/` root level like `presents/`.

**Server vs. Client split:** Use `lib/supabase/server.ts` in RSCs and Server Actions; use `lib/supabase/client.ts` only in `'use client'` components.

**Supabase email auth:** Always use `token_hash` + `verifyOtp` for email link flows (password reset, etc.) — not PKCE `code`/`exchangeCodeForSession`. PKCE requires a `code_verifier` cookie from the originating browser; opening the link in a different browser fails with `otp_expired`. Email templates must use `{{ .TokenHash }}` not `{{ .ConfirmationURL }}` for recovery links. Chrome Safe Browsing also prefetches email URLs, which silently consumes single-use PKCE tokens.

## Database (Supabase / PostgreSQL)
Three tables with RLS:
- `plants` — master catalog, readable by everyone. Key extended columns:
  - `usda_zone_min`, `usda_zone_max` — half-zone integers (9a=18, 9b=19); encode via `lib/zones.ts`. "Zone 9" = `[2, 19]` (zones 1a–9b ceiling semantics, not a point value).
  - `native_states` — `TEXT[]`, e.g. `['CA','OR']`; used for state filter
  - `is_invasive` — `BOOLEAN`; shown as badge on detail page
  - `notable_cultivars` — `TEXT`; shown as section on detail page
- `plant_lists` — user-owned lists, public via `share_id`
- `plant_list_items` — join table with sort_order and notes

Run migrations with: `supabase db push` (local) or apply in Supabase dashboard.

**Catalog scale + PostgREST 1000-row cap:** The `plants` table is ~1716 rows (not ~250 — older plan estimates are stale). Supabase/PostgREST silently caps a single `.select()` / `.or()` response at **1000 rows**. Any bulk read against `plants` (enrichment/backfill scripts, full-catalog queries) MUST paginate with `.range(from, to)` in a loop until a short page returns — an unpaginated bulk query drops every row past 1000 with no error, producing false-positive "full coverage" gates.

## Environment Variables
Required (copy from Supabase dashboard + Anthropic console):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=   # scripts only, never exposed client-side
ANTHROPIC_API_KEY=           # scripts only
```

## Testing
- Playwright config in `playwright.config.ts`; tests live in `tests/`
- Two suites: `logged-in` (uses stored auth state) and `logged-out`
- Tests run against the **production** Vercel URL — be careful with destructive ops
- Auth state cached at `tests/.auth-state.json`
- **Validating undeployed changes:** because the suite targets production, code not yet deployed cannot be verified by the configured baseURL. Validate new/changed pages against a local dev server (`npm run dev` on :3000) — it reads the **same live Supabase**, so enriched/production data is real. Do not permanently repoint `playwright.config.ts` at localhost; revert any temporary baseURL change before committing.

**Playwright gotchas:**
- **Footer link ambiguity:** `app/(app)/layout.tsx` footer always renders "Sign Up", "Sign In", and "My Lists" links regardless of auth state. Scope assertions to `nav` (e.g. `page.locator('nav').getByRole('link', { name: 'Sign up' })`) or `p` for form-footer links — never bare `page.getByRole`.
- **Overflow sidebar:** The plant browser sidebar is `overflow-y-auto max-h-[calc(100vh-7rem)]`. Elements near the bottom (USDA Zone, Native State) need `await element.scrollIntoViewIfNeeded()` before `.click()` or `.selectOption()`.
- **Filter sections start collapsed:** Click the `aside button` header before interacting with checkboxes inside a `FilterSection`.
- **Active tab class:** `text-forest border-b-2 border-forest` — assert with `toHaveClass(/text-forest/)`.
- **Plant cards:** `.bg-cream.rounded-2xl` — not `.border-gray-100`.

## Design System — Botanical Heritage
All UI uses the **Botanical Heritage** design system. Do not introduce gray/green Tailwind defaults; use these tokens exclusively:

| Token | Value | Role |
|---|---|---|
| `parchment` | `#f5f0e8` | Page background |
| `cream` | `#fdfaf4` | Card / panel surface |
| `stone-white` | `#f0ebe0` | Filter sidebar, table headers |
| `forest` | `#2d5016` | Primary buttons, active states, links |
| `forest-dark` | `#173901` | Hover on primary |
| `terracotta` | `#c4622d` | Destructive / accent (remove buttons, hover highlights) |
| `warm-stone` | `#8c7b6b` | Borders (use at 20–30% opacity), secondary text |
| `dark-bark` | `#1c1207` | Headings, high-emphasis text |
| `warm-umber` | `#5c4a35` | Body text, latin names, metadata |
| `sage-mist` | `#a8d38a` | Light accent, gradient fills |

**Shadows:** `shadow-warm` (resting) → `shadow-warm-md` (hover). Always warm-tinted, never cool gray.

**Typography:** `font-playfair` for all headings, plant names, section titles. `font-inter` (default body) for all UI labels, buttons, metadata.

**Shape language:** `rounded-2xl` (16px) for cards/images, `rounded-lg` (8px) for buttons/inputs, `rounded-full` for badges/pills.

**Reference:** Full spec in [.stitch/DESIGN.md](.stitch/DESIGN.md). Stitch project ID: `7515704749920381908`. Design screenshots in [.stitch/designs/](.stitch/designs/).

## Code Conventions
- TypeScript strict mode; no `any` unless unavoidable
- Path alias `@/*` maps to project root
- No Prettier config — rely on `next lint` for style checks
- ESLint is pinned to `eslint@^8` + `eslint-config-next@^14` deliberately — **do NOT upgrade ESLint to 9**; v9's flat-config breaks the `next lint` bridge on Next 14. A `.eslintrc.json` must exist or bare `npm run lint` launches an interactive setup wizard that blocks automated runs.
- No comments unless the WHY is non-obvious
- Tailwind inline classes preferred over custom CSS
- Allowed remote image hosts (configured in `next.config.mjs`): `upload.wikimedia.org`, `*.supabase.co`, `inaturalist-open-data.s3.amazonaws.com`, `static.inaturalist.org` — adding a new image source requires adding it here or Next.js will 500 at SSR time on Server Components

## Data Import Scripts
Scripts in `scripts/` use `tsx` directly and are excluded from the Next.js TS build:
```bash
npm run import-plants           # bulk import via iNaturalist + Claude
npm run import-permaculture     # permaculture-specific batch
npm run update-plants           # re-enrich existing records
npm run retry-plants            # retry skipped records
npm run fix-images              # validate/fix image URLs
npm run backfill-zones          # parse usda_zones text → usda_zone_min/max integers (idempotent)
npm run backfill-native-states  # Claude-inferred native_states arrays (idempotent)
npm run backfill-native-counties  # Flora API county data — needs FLORA_API_KEY (deferred)
```
Rate-limited to 10 Claude API calls per 15s — don't remove the delay.

## Key Files
- [app/layout.tsx](app/layout.tsx) — root layout: HTML/body/fonts only
- [app/(app)/layout.tsx](app/(app)/layout.tsx) — nav + footer for all app pages
- [app/(app)/NavUser.tsx](app/(app)/NavUser.tsx) — auth-aware user menu
- [lib/types.ts](lib/types.ts) — Plant, PlantList, PlantListItem interfaces
- [lib/zones.ts](lib/zones.ts) — encodeZone / decodeZone / ZONE_LABELS (half-zone integer helpers)
- [lib/supabase/server.ts](lib/supabase/server.ts) — server Supabase client
- [lib/supabase/client.ts](lib/supabase/client.ts) — browser Supabase client
- [next.config.mjs](next.config.mjs) — image host allowlist
- [tailwind.config.ts](tailwind.config.ts) — Botanical Heritage color tokens + shadows
- [.stitch/DESIGN.md](.stitch/DESIGN.md) — full Botanical Heritage design system spec
- [playwright.config.ts](playwright.config.ts) — E2E config
- [app/api/auth/callback/route.ts](app/api/auth/callback/route.ts) — auth callback: token_hash + PKCE exchange
- [supabase/templates/](supabase/templates/) — branded email templates

<!-- GSD:project-start source:PROJECT.md -->
## Project

**Permaculture Plant Picker**

A deep-database platform for homesteaders and garden designers to discover, research, and assemble plant palettes for regenerative landscapes. Plants are surfaced with region-aware relevance — the system infers a user's Köppen-Geiger climate classification from their location and adjusts which data dimensions are most prominently surfaced (drought tolerance matters in a Mediterranean climate; it's background noise in the tropics). Design tools and community features are on the horizon; the database is the foundation everything else is built on.

**Core Value:** A user with a site to plant can find the right plants for their specific place, understand what each plant contributes to the ecosystem, and assemble a palette — faster and with more confidence than any other tool.

### Constraints

- **Tech stack:** Next.js 14 + Supabase + Tailwind — established, no changes
- **Design system:** Botanical Heritage tokens only — no gray/green Tailwind defaults
- **Testing:** Playwright E2E only, targets production URL — be careful with destructive ops
- **Image hosts:** Only `upload.wikimedia.org`, `*.supabase.co`, `inaturalist-open-data.s3.amazonaws.com`, `static.inaturalist.org` — new sources require `next.config.mjs` update
- **Data enrichment rate:** Max 10 Claude API calls per 15s in import scripts
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Summary
## Languages
- TypeScript 5.9.3 — all application code (`app/`, `lib/`, `scripts/`)
- SQL — Supabase migrations in `supabase/migrations/`
- HTML — Supabase branded email templates in `supabase/templates/`
## Runtime
- Node.js — no version pinned (no `.nvmrc` / `.node-version`); dev environment runs v22.22.2
- npm
- Lockfile: `package-lock.json` present (lockfile version 3)
## Frameworks
- Next.js 14.2.35 — App Router, RSC-first, server actions and server components throughout `app/`
- React 18.3.1 — UI rendering; client components gated with `'use client'` directive
- Playwright 1.60.0 — E2E only; config at `playwright.config.ts`; tests in `tests/`; targets `https://permacultureplantpicker.com` (production)
- Next.js built-in bundler (webpack / Turbopack-compatible via `next dev` / `next build`)
- PostCSS 8 — CSS processing for Tailwind; config at `postcss.config.mjs`
- tsx 4.22.0 — TypeScript script runner for `scripts/` data pipeline (bypasses TS build)
- dotenv 17.4.2 — env file loading inside `scripts/`
## Key Dependencies
- `next` 14.2.35 — full-stack framework; routing, rendering, image optimization, middleware
- `react` / `react-dom` 18.3.1 — UI layer
- `@supabase/supabase-js` 2.105.4 — database client, auth, RLS
- `@supabase/ssr` 0.10.3 — SSR-safe Supabase client helpers; used in `lib/supabase/server.ts` and `lib/supabase/client.ts`
- `@anthropic-ai/sdk` 0.96.0 — Claude API client; used exclusively in `scripts/` for data enrichment
- `@playwright/test` 1.60.0 — E2E test runner
- `@types/node` ^20, `@types/react` ^18, `@types/react-dom` ^18 — TypeScript type definitions
- `tsx` 4.22.0 — runs `scripts/*.ts` directly without a build step
- `tailwindcss` 3.4.19 — utility-first CSS; custom Botanical Heritage design tokens in `tailwind.config.ts`
- `postcss` ^8 — required Tailwind peer dependency
## Configuration
- App env vars loaded by Next.js from `.env.local` (not committed)
- Scripts load `.env.local` explicitly via `dotenv.config({ path: '.env.local' })`
- Required vars:
- `next.config.mjs` — image remote pattern allowlist (Wikimedia, Supabase, iNaturalist CDNs)
- `tsconfig.json` — incremental compilation, `bundler` module resolution, `@/*` alias
- `tailwind.config.ts` — Botanical Heritage color tokens + custom warm box shadows
- `postcss.config.mjs` — Tailwind plugin only
## Supabase Local Development
- PostgreSQL major version 17
- Local API port 54321, DB port 54322, Studio port 54323
- Auth configured for email/password only (SMS disabled, all OAuth providers disabled)
- Email templates registered: `supabase/templates/confirm.html`, `supabase/templates/reset-password.html`
- Migrations: `supabase/migrations/` (11 files); apply with `supabase db push`
## Platform Requirements
- Node.js (v20+ recommended based on `@types/node ^20`)
- npm (lockfile v3)
- Supabase CLI (for local dev / migrations)
- Vercel (Next.js deployment)
- Supabase hosted project (PostgreSQL + Auth)
- Domain: `permacultureplantpicker.com`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Summary
## Naming Patterns
- Page files: always `page.tsx` (Next.js App Router convention)
- Layout files: always `layout.tsx`
- Client components extracted from pages: `PascalCase.tsx`, co-located in the same route directory (e.g., `NavUser.tsx`, `NewListForm.tsx`, `CopyShareUrl.tsx`, `ListItemActions.tsx`, `AddToListClient.tsx`)
- Lib utilities: lowercase with hyphens — `types.ts`, `zones.ts`, `us-states.ts`
- Supabase clients: `lib/supabase/server.ts`, `lib/supabase/client.ts`
- Exported page/layout components: `PascalCase` named exports matching the file's role (e.g., `export default function ListsPage()`, `export default function AppLayout()`)
- Internal sub-components defined in the same file: `PascalCase` (e.g., `FilterSection`, `PlantCard`, `PlantsPageInner`, `InfoCell`)
- Event handlers: `handle` prefix — `handleSubmit`, `handleSignOut`, `handleRemove`, `handleAddToList`, `handleCreateList`
- Boolean state: descriptive noun — `loading`, `copied`, `drawerOpen`, `showMenu`, `creatingList`
- `camelCase` throughout
- Filter state arrays named for the property they filter: `sun`, `water`, `types`, `months`, `zones`, `nativeState`
- Supabase data destructured immediately: `const { data: list }`, `const { data: { user } }`
- Domain types defined as `interface` in `lib/types.ts`: `Plant`, `PlantList`, `PlantListItem`
- Enum-like string unions defined as `type` aliases: `Sun`, `Water`, `PlantType`, `ForestGardenLayer`
- Lookup maps typed as `Record<string, string>`: `SUN_ICONS`, `WATER_ICONS`, `SUN_LABELS`, `WATER_LABELS`
- Constants: `SCREAMING_SNAKE_CASE` arrays for filter option lists (e.g., `SUN_OPTIONS`, `ZONE_LABELS`, `PERM_USE_OPTIONS`)
## TypeScript Usage
## Component Patterns
| Pattern | When | Example |
|---------|------|---------|
| Async server component (no directive) | Data fetching, auth guards, static rendering | `app/(app)/lists/page.tsx`, `app/(app)/plants/[id]/page.tsx` |
| `'use client'` component | Browser state, event handlers, `useRouter`, `useSearchParams` | `app/(app)/plants/page.tsx`, `NavUser.tsx`, `NewListForm.tsx` |
## Styling Approach
- Colors: `parchment`, `cream`, `stone-white`, `forest` / `forest-dark`, `terracotta`, `warm-stone`, `dark-bark`, `warm-umber`, `sage-mist`
- Shadows: `shadow-warm` (resting), `shadow-warm-md` (hover/elevation)
- Fonts: `font-playfair` (headings, plant names), `font-inter` (default body, buttons, metadata)
- Cards and images: `rounded-2xl` (16px)
- Buttons and inputs: `rounded-lg` (8px)
- Badges and pills: `rounded-full`
- Hover on primary buttons: `hover:bg-forest-dark`
- Hover on secondary elements: `hover:text-dark-bark` or `hover:bg-stone-white`
- Destructive/remove hover: `hover:text-terracotta hover:bg-terracotta/10`
- Opacity-based disabling: `disabled:opacity-50 disabled:cursor-not-allowed`
- Transitions: `transition-colors duration-150` or `transition-colors duration-200`
- Section label / eyebrow: `text-[11px] font-semibold uppercase tracking-[0.06em] text-warm-stone`
- Body text: `text-sm text-warm-umber`
- Plant card heading: `font-playfair text-xl font-semibold text-dark-bark`
- Page heading: `font-playfair text-3xl font-semibold text-dark-bark`
## Import Organization
## Error Handling
## Comments
- Block comments in `app/(app)/plants/page.tsx` marking major JSX sections (`{/* Filter Sidebar */}`, `{/* Main content */}`)
- Explanatory comments in `lib/zones.ts` for the encoding scheme
- Comments in test files explaining test data setup rationale
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Summary
## System Overview
```
```
## Route Groups and Their Roles
- `app/(app)/layout.tsx` — sticky nav (fetches `auth.getUser()` server-side), footer. The route group name is invisible to the URL router.
- `app/(app)/page.tsx` — marketing/home page (RSC, fetches hero plants from Supabase)
- `app/(app)/plants/page.tsx` — plant browser (`'use client'`, loads all plants client-side, filters in memory)
- `app/(app)/plants/[id]/page.tsx` — plant detail (RSC, single Supabase fetch)
- `app/(app)/lists/page.tsx` — My Lists dashboard (RSC, redirects unauthenticated users)
- `app/(app)/lists/[id]/page.tsx` — list editor (RSC, guards by `owner_id`)
- `app/(app)/auth/` — login, signup, forgot-password, reset-password, signout pages (all `'use client'`)
- `app/presents/[shareId]/page.tsx` — plant grid presentation (RSC, fetches by `share_id`)
- `app/presents/[shareId]/reports/page.tsx` — water/bloom/season report tables (RSC)
- Handles both `token_hash` + `verifyOtp` (email links) and PKCE `code` + `exchangeCodeForSession` flows.
- Token-hash path is preferred; PKCE is a fallback.
## Server vs. Client Split
| Component | Render Mode | Supabase client |
|-----------|-------------|-----------------|
| `app/(app)/layout.tsx` | RSC | `server.ts` |
| `app/(app)/page.tsx` | RSC | `server.ts` |
| `app/(app)/plants/page.tsx` | Client (`'use client'`) | `client.ts` |
| `app/(app)/plants/[id]/page.tsx` | RSC | `server.ts` |
| `app/(app)/plants/[id]/AddToListClient.tsx` | Client | `client.ts` |
| `app/(app)/lists/page.tsx` | RSC | `server.ts` |
| `app/(app)/lists/[id]/page.tsx` | RSC | `server.ts` |
| `app/(app)/lists/[id]/ListItemActions.tsx` | Client | `client.ts` |
| `app/(app)/lists/[id]/CopyShareUrl.tsx` | Client | none (clipboard API) |
| `app/(app)/lists/NewListForm.tsx` | Client | `client.ts` |
| `app/(app)/NavUser.tsx` | Client | `client.ts` |
| `app/(app)/auth/*` pages | Client | `client.ts` |
| `app/presents/[shareId]/page.tsx` | RSC | `server.ts` |
| `app/presents/[shareId]/reports/page.tsx` | RSC | `server.ts` |
| `app/api/auth/callback/route.ts` | Route Handler | `server.ts` |
## Data Flow
### Public plant browse (RSC path)
### Plant browser (client-side filter path)
### List mutation (client component path)
### Auth flow
### Public presentation flow
## State Management
- **URL query params** — plant browser filter state (`/plants?sun=full+sun&zones=9a,9b`), synced via `router.replace`
- **React `useState`** — local component state (filter toggles, modal visibility, form inputs, loading flags)
- **Supabase session cookies** — auth state, managed by `@supabase/ssr`; read server-side in layouts/RSCs, set via the auth callback route
- **`router.refresh()`** — triggers RSC re-render after client mutations to re-sync server-fetched data
## Database Schema
- `id UUID`, `common_name TEXT`, `latin_name TEXT`, `description TEXT`
- `sun TEXT` — enum: `full sun | part shade | full shade`
- `water TEXT` — enum: `low | moderate | high`
- `plant_type TEXT` — enum: `shrub | tree | perennial | groundcover | vine | grass`
- `bloom_months TEXT[]`, `season_of_interest TEXT[]`, `permaculture_uses TEXT[]`
- `native_states TEXT[]` — e.g. `['CA', 'OR']`
- `usda_zone_min INTEGER`, `usda_zone_max INTEGER` — half-zone encoding (9a=18, 9b=19); see `lib/zones.ts`
- `usda_zones TEXT` — raw text, kept for backward compat
- `is_invasive BOOLEAN`, `notable_cultivars TEXT`
- RLS: SELECT policy `USING (true)` — fully public
- `id UUID`, `owner_id UUID → auth.users(id)`, `title TEXT`, `description TEXT`
- `share_id TEXT UNIQUE DEFAULT substring(md5(random()::text), 1, 13)` — auto-generated 13-char share token
- RLS: SELECT public; INSERT/UPDATE/DELETE scoped to `auth.uid() = owner_id`
- `id UUID`, `list_id UUID → plant_lists(id)`, `plant_id UUID → plants(id)`
- `sort_order INTEGER`, `notes TEXT`
- RLS: SELECT public; write ops verify list ownership via sub-select
## Auth Architecture
## Error Handling
- **RSCs:** `notFound()` from `next/navigation` for missing records; `redirect('/auth/login')` for unauthenticated access to protected pages
- **Client components:** local `useState` error string, displayed as `<p className="text-red-600 text-sm">` inline below forms
- **Auth callback:** on failure, redirects to `/auth/login?error=auth`
## Anti-Patterns
### Client-side full-table load in plant browser
### Duplicate display constants across files
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
