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
- `plants` — master catalog, readable by everyone
- `plant_lists` — user-owned lists, public via `share_id`
- `plant_list_items` — join table with sort_order and notes

Run migrations with: `supabase db push` (local) or apply in Supabase dashboard.

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
- No comments unless the WHY is non-obvious
- Tailwind inline classes preferred over custom CSS
- Allowed remote image hosts (configured in `next.config.mjs`): `upload.wikimedia.org`, `*.supabase.co`, `inaturalist-open-data.s3.amazonaws.com`, `static.inaturalist.org` — adding a new image source requires adding it here or Next.js will 500 at SSR time on Server Components

## Data Import Scripts
Scripts in `scripts/` use `tsx` directly and are excluded from the Next.js TS build:
```bash
npm run import-plants        # bulk import via iNaturalist + Claude
npm run import-permaculture  # permaculture-specific batch
npm run update-plants        # re-enrich existing records
npm run retry-plants         # retry skipped records
npm run fix-images           # validate/fix image URLs
```
Rate-limited to 10 Claude API calls per 15s — don't remove the delay.

## Key Files
- [app/layout.tsx](app/layout.tsx) — root layout: HTML/body/fonts only
- [app/(app)/layout.tsx](app/(app)/layout.tsx) — nav + footer for all app pages
- [app/(app)/NavUser.tsx](app/(app)/NavUser.tsx) — auth-aware user menu
- [lib/types.ts](lib/types.ts) — Plant, PlantList, PlantListItem interfaces
- [lib/supabase/server.ts](lib/supabase/server.ts) — server Supabase client
- [lib/supabase/client.ts](lib/supabase/client.ts) — browser Supabase client
- [next.config.mjs](next.config.mjs) — image host allowlist
- [tailwind.config.ts](tailwind.config.ts) — Botanical Heritage color tokens + shadows
- [.stitch/DESIGN.md](.stitch/DESIGN.md) — full Botanical Heritage design system spec
- [playwright.config.ts](playwright.config.ts) — E2E config
- [app/api/auth/callback/route.ts](app/api/auth/callback/route.ts) — auth callback: token_hash + PKCE exchange
- [supabase/templates/](supabase/templates/) — branded email templates
