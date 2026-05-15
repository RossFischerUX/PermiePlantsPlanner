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
- `app/` — all pages and page-specific components (App Router)
- `lib/` — shared types (`types.ts`) and Supabase helpers
  - `lib/supabase/server.ts` — server components / route handlers
  - `lib/supabase/client.ts` — browser / client components
- `scripts/` — data import/enrichment pipelines (excluded from TS build)
- `supabase/migrations/` — ordered SQL migrations

**Server vs. Client split:** Use `lib/supabase/server.ts` in RSCs and Server Actions; use `lib/supabase/client.ts` only in `'use client'` components.

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

## Code Conventions
- TypeScript strict mode; no `any` unless unavoidable
- Path alias `@/*` maps to project root
- No Prettier config — rely on `next lint` for style checks
- No comments unless the WHY is non-obvious
- Tailwind inline classes preferred over custom CSS; use CSS variables for theme tokens (`--background`, `--foreground`)
- Supabase image CDN and Wikimedia are the only allowed remote image hosts (configured in `next.config.mjs`)

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
- [app/layout.tsx](app/layout.tsx) — root layout, Nav, global auth
- [lib/types.ts](lib/types.ts) — Plant, PlantList, PlantListItem interfaces
- [lib/supabase/server.ts](lib/supabase/server.ts) — server Supabase client
- [lib/supabase/client.ts](lib/supabase/client.ts) — browser Supabase client
- [next.config.mjs](next.config.mjs) — image host allowlist
- [playwright.config.ts](playwright.config.ts) — E2E config
