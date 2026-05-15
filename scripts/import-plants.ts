#!/usr/bin/env tsx
/**
 * Bulk plant import script
 *
 * Sources:
 *   - iNaturalist API  → latin name, common name, photo URL (CC-licensed)
 *   - Claude claude-haiku → horticultural fields (sun, water, type, form, etc.)
 *
 * Usage:
 *   npm run import-plants
 *
 * Requires in .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   ANTHROPIC_API_KEY=...
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

// iNaturalist taxon ID for kingdom Plantae — filters results to plant species only
const PLANTAE_TAXON_ID = 47126

// How many pages to fetch from iNaturalist (200 candidates per page).
// Override with --pages N: e.g. `npm run import-plants -- --pages 1` for a test run.
// 6 pages = 1,200 candidates → ~900–1,100 inserted after filtering.
const pagesArg = process.argv.indexOf('--pages')
const PAGES_TO_FETCH = pagesArg !== -1 ? parseInt(process.argv[pagesArg + 1], 10) : 6

// Max concurrent Claude calls per batch (stay within rate limits)
const CLAUDE_BATCH_SIZE = 10

// Delay between Claude batches: 10 calls per batch, 15s gap = 40 req/min (well under the 50/min haiku limit)
const CLAUDE_BATCH_DELAY_MS = 15000

// iNaturalist asks for 1 request/second in their API terms
const INAT_DELAY_MS = 1100

// ─── Types ───────────────────────────────────────────────────────────────────

interface INatTaxon {
  id: number
  name: string                        // latin/scientific name
  preferred_common_name?: string      // English common name (absent for many taxa)
  default_photo?: {
    medium_url: string                // direct CDN URL, no redirect needed
    attribution: string
  }
  observations_count: number
  is_active: boolean
  iconic_taxon_name?: string          // "Plantae", "Animalia", etc.
}

interface HorticulturalData {
  sun: 'full sun' | 'part shade' | 'full shade' | null
  water: 'low' | 'moderate' | 'high' | null
  plant_type: 'shrub' | 'tree' | 'perennial' | 'groundcover' | 'vine' | 'grass' | null
  form: string | null
  growth_rate: 'slow' | 'moderate' | 'fast' | null
  dormancy: 'evergreen' | 'deciduous' | 'semi-evergreen' | null
  height_min: number | null           // feet
  height_max: number | null           // feet
  width_min: number | null            // feet
  width_max: number | null            // feet
  bloom_months: string[] | null       // e.g. ["March", "April", "May"]
  season_of_interest: string[] | null // e.g. ["Spring", "Winter"]
  soil: string | null
  description: string | null
  native_range: string | null
  usda_zones: string | null
}

// ─── Clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Normalize enum fields against DB CHECK constraints.
// Claude might return "partial shade" instead of "part shade", "annual" instead
// of a valid plant_type, etc. Invalid values cause the entire batch insert to
// fail with a constraint violation, so we null them out rather than guess.
const VALID_SUN = ['full sun', 'part shade', 'full shade'] as const
const VALID_WATER = ['low', 'moderate', 'high'] as const
const VALID_TYPE = ['shrub', 'tree', 'perennial', 'groundcover', 'vine', 'grass'] as const

function normalizeEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | null {
  if (typeof value !== 'string') return null
  const match = allowed.find(a => a.toLowerCase() === value.toLowerCase())
  return match ?? null
}

async function fetchINatPage(page: number): Promise<INatTaxon[]> {
  const url = new URL('https://api.inaturalist.org/v1/taxa')
  url.searchParams.set('taxon_id', String(PLANTAE_TAXON_ID))
  url.searchParams.set('rank', 'species')
  url.searchParams.set('locale', 'en')
  url.searchParams.set('per_page', '200')
  url.searchParams.set('page', String(page))
  url.searchParams.set('order_by', 'observations_count')
  url.searchParams.set('order', 'desc')
  url.searchParams.set('is_active', 'true')

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'PlantMasterDB/1.0 (educational project; rossfischer)' },
  })

  if (!res.ok) throw new Error(`iNaturalist API error: ${res.status} ${res.statusText}`)
  const json = await res.json()
  return (json.results ?? []) as INatTaxon[]
}

async function enrichWithClaude(
  commonName: string,
  latinName: string,
): Promise<HorticulturalData | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `You are a horticultural database. For the plant "${commonName}" (${latinName}), return horticultural data as a single JSON object. Use null for any field you are not confident about. Do not explain anything — only return valid JSON.

{
  "sun": "full sun" | "part shade" | "full shade" | null,
  "water": "low" | "moderate" | "high" | null,
  "plant_type": "shrub" | "tree" | "perennial" | "groundcover" | "vine" | "grass" | null,
  "form": "Rounded" | "Pyramidal" | "Spreading" | "Upright" | "Mounding" | "Weeping" | other string | null,
  "growth_rate": "slow" | "moderate" | "fast" | null,
  "dormancy": "evergreen" | "deciduous" | "semi-evergreen" | null,
  "height_min": number in feet | null,
  "height_max": number in feet | null,
  "width_min": number in feet | null,
  "width_max": number in feet | null,
  "bloom_months": ["January","February",...] | null,
  "season_of_interest": ["Spring","Summer","Fall","Winter"] subset | null,
  "soil": short string e.g. "Well-drained" or "Moist, fertile" | null,
  "description": "1–2 sentence plain-English description for a home gardener" | null,
  "native_range": short string e.g. "California native" or "Mediterranean" or "Eastern Asia" | null,
  "usda_zones": string e.g. "7–10" or "4–8" | null
}`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.warn(`  ⚠ No JSON in Claude response for ${latinName}`)
      return null
    }
    return JSON.parse(match[0]) as HorticulturalData
  } catch (err) {
    console.warn(`  ⚠ Claude error for ${latinName}:`, (err as Error).message)
    return null
  }
}

async function getExistingLatinNames(): Promise<Set<string>> {
  const { data, error } = await supabase.from('plants').select('latin_name')
  if (error) throw new Error(`Could not fetch existing plants: ${error.message}`)
  return new Set((data ?? []).map(p => p.latin_name).filter(Boolean) as string[])
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('PlantMaster — Bulk Import Script')
  console.log('=================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) missing from .env.local')
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing from .env.local')

  // Fetch existing latin names so we can skip duplicates
  const existing = await getExistingLatinNames()
  console.log(`Existing plants in DB: ${existing.size}`)

  // ── Step 1: Fetch candidates from iNaturalist ─────────────────────────────
  console.log(`\nFetching ${PAGES_TO_FETCH} pages from iNaturalist (200/page, sorted by observation count)...\n`)

  const candidates: INatTaxon[] = []

  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    const taxa = await fetchINatPage(page)

    // Keep only species that have:
    //   • an English common name
    //   • a photo with a usable URL
    //   • are flagged as plants by iNaturalist (iconic_taxon_name check is a safety net;
    //     taxon_id=47126 in the query already restricts to Plantae descendants)
    const usable = taxa.filter(
      t =>
        t.preferred_common_name &&
        t.default_photo?.medium_url &&
        !existing.has(t.name),
    )

    candidates.push(...usable)
    console.log(`  Page ${page}: ${taxa.length} results, ${usable.length} usable new plants`)
    await sleep(INAT_DELAY_MS)
  }

  // Deduplicate within the fetched pages (same species can appear on multiple pages)
  const seen = new Set<string>()
  const unique = candidates.filter(t => {
    if (seen.has(t.name)) return false
    seen.add(t.name)
    return true
  })

  console.log(`\nTotal candidates to enrich: ${unique.length} (${candidates.length - unique.length} cross-page duplicates removed)\n`)
  const toProcess = unique

  // ── Step 2: Enrich with Claude + insert ───────────────────────────────────
  let inserted = 0
  let skipped = 0  // Claude returned too little data to be useful
  let failed = 0   // DB insert error

  for (let i = 0; i < toProcess.length; i += CLAUDE_BATCH_SIZE) {
    const batch = toProcess.slice(i, i + CLAUDE_BATCH_SIZE)

    const rows = await Promise.all(
      batch.map(async taxon => {
        const hort = await enrichWithClaude(taxon.preferred_common_name!, taxon.name)

        // Require at least a description or sun+water before inserting.
        // This filters out highly obscure species Claude genuinely doesn't know.
        if (!hort || (!hort.description && !hort.sun && !hort.water)) {
          return null
        }

        return {
          common_name: taxon.preferred_common_name!,
          latin_name: taxon.name,
          image_url: taxon.default_photo!.medium_url,
          // Normalize enum fields against DB CHECK constraints before inserting.
          // Claude might return "partial shade", "annual", etc. — null is safer than a failed insert.
          sun: normalizeEnum(hort.sun, VALID_SUN),
          water: normalizeEnum(hort.water, VALID_WATER),
          plant_type: normalizeEnum(hort.plant_type, VALID_TYPE),
          // Free-text fields pass through as-is
          form: hort.form ?? null,
          growth_rate: hort.growth_rate ?? null,
          dormancy: hort.dormancy ?? null,
          height_min: hort.height_min ?? null,
          height_max: hort.height_max ?? null,
          width_min: hort.width_min ?? null,
          width_max: hort.width_max ?? null,
          bloom_months: hort.bloom_months ?? null,
          season_of_interest: hort.season_of_interest ?? null,
          soil: hort.soil ?? null,
          description: hort.description ?? null,
          native_range: hort.native_range ?? null,
          usda_zones: hort.usda_zones ?? null,
        }
      }),
    )

    const valid = rows.filter(Boolean)
    skipped += rows.length - valid.length

    if (valid.length > 0) {
      const { error } = await supabase.from('plants').insert(valid)
      if (error) {
        console.error(`  ✗ Insert error: ${error.message}`)
        failed += valid.length
      } else {
        inserted += valid.length
      }
    }

    const processed = Math.min(i + CLAUDE_BATCH_SIZE, toProcess.length)
    console.log(
      `  [${processed}/${toProcess.length}] ` +
        `inserted ${inserted} · skipped ${skipped} · failed ${failed}`,
    )

    // Rate-limit guard: pause between batches so we stay under 50 req/min for Claude haiku.
    // Skip the delay after the final batch.
    if (processed < toProcess.length) {
      await sleep(CLAUDE_BATCH_DELAY_MS)
    }
  }

  console.log(`\n✓ Done.`)
  console.log(`  Inserted : ${inserted}`)
  console.log(`  Skipped  : ${skipped}  (too little horticultural data)`)
  console.log(`  Failed   : ${failed}   (DB insert errors)`)
}

main().catch(err => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
