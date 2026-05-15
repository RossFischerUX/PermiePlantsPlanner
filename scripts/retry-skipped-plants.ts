#!/usr/bin/env tsx
/**
 * Retry plants that were skipped during the bulk import due to Claude API
 * rate-limit (429) or overload (529) errors. Re-fetches the same iNaturalist
 * pages, compares against the DB, and processes only the gaps.
 *
 * Usage:
 *   npm run retry-plants
 *   npm run retry-plants -- --pages 5   (defaults to 6 if omitted)
 *
 * Requires in .env.local:
 *   SUPABASE_SECRET_KEY=... (or SUPABASE_SERVICE_ROLE_KEY=...)
 *   ANTHROPIC_API_KEY=...
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

const PLANTAE_TAXON_ID = 47126
const pagesArg = process.argv.indexOf('--pages')
const PAGES_TO_FETCH = pagesArg !== -1 ? parseInt(process.argv[pagesArg + 1], 10) : 6

// Smaller batches + longer delay to survive occasional overload spikes
const CLAUDE_BATCH_SIZE = 5
const CLAUDE_BATCH_DELAY_MS = 20000
const INAT_DELAY_MS = 1100

interface INatTaxon {
  id: number
  name: string
  preferred_common_name?: string
  default_photo?: { medium_url: string }
  is_active: boolean
}

interface HorticulturalData {
  sun: string | null
  water: string | null
  plant_type: string | null
  form: string | null
  growth_rate: string | null
  dormancy: string | null
  height_min: number | null
  height_max: number | null
  width_min: number | null
  width_max: number | null
  bloom_months: string[] | null
  season_of_interest: string[] | null
  soil: string | null
  description: string | null
  native_range: string | null
  usda_zones: string | null
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

const VALID_SUN = ['full sun', 'part shade', 'full shade'] as const
const VALID_WATER = ['low', 'moderate', 'high'] as const
const VALID_TYPE = ['shrub', 'tree', 'perennial', 'groundcover', 'vine', 'grass'] as const

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  return allowed.find(a => a.toLowerCase() === value.toLowerCase()) ?? null
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
    headers: { 'User-Agent': 'PermaculturePlantPicker/1.0 (educational project; rossfischer)' },
  })
  if (!res.ok) throw new Error(`iNaturalist error: ${res.status} ${res.statusText}`)
  const json = await res.json()
  return (json.results ?? []) as INatTaxon[]
}

async function enrichWithClaude(commonName: string, latinName: string): Promise<HorticulturalData | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
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
      }],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) { console.warn(`  ⚠ No JSON for ${latinName}`); return null }
    return JSON.parse(match[0]) as HorticulturalData
  } catch (err) {
    console.warn(`  ⚠ Claude error for ${latinName}:`, (err as Error).message)
    return null
  }
}

async function main() {
  console.log('Permaculture Plant Picker — Retry Skipped Plants')
  console.log('====================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SECRET_KEY missing from .env.local')
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing from .env.local')

  // Load existing latin names to find gaps
  const { data: existing, error: dbErr } = await supabase.from('plants').select('latin_name')
  if (dbErr) throw new Error(`DB error: ${dbErr.message}`)
  const inDB = new Set((existing ?? []).map(p => p.latin_name).filter(Boolean) as string[])
  console.log(`Plants currently in DB: ${inDB.size}`)

  // Re-fetch the same iNaturalist pages
  console.log(`\nRe-fetching ${PAGES_TO_FETCH} pages from iNaturalist to find gaps...\n`)
  const missing: INatTaxon[] = []

  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    const taxa = await fetchINatPage(page)
    const gaps = taxa.filter(t =>
      t.preferred_common_name &&
      t.default_photo?.medium_url &&
      !inDB.has(t.name),
    )
    missing.push(...gaps)
    console.log(`  Page ${page}: ${gaps.length} missing plants found`)
    await sleep(INAT_DELAY_MS)
  }

  // Deduplicate across pages
  const seen = new Set<string>()
  const toRetry = missing.filter(t => { if (seen.has(t.name)) return false; seen.add(t.name); return true })

  console.log(`\nTotal to retry: ${toRetry.length}\n`)
  if (toRetry.length === 0) { console.log('Nothing to retry — DB is complete.'); return }

  let inserted = 0, skipped = 0, failed = 0

  for (let i = 0; i < toRetry.length; i += CLAUDE_BATCH_SIZE) {
    const batch = toRetry.slice(i, i + CLAUDE_BATCH_SIZE)

    const rows = await Promise.all(
      batch.map(async taxon => {
        const hort = await enrichWithClaude(taxon.preferred_common_name!, taxon.name)
        if (!hort || (!hort.description && !hort.sun && !hort.water)) return null

        return {
          common_name: taxon.preferred_common_name!,
          latin_name: taxon.name,
          image_url: taxon.default_photo!.medium_url,
          sun: normalizeEnum(hort.sun, VALID_SUN),
          water: normalizeEnum(hort.water, VALID_WATER),
          plant_type: normalizeEnum(hort.plant_type, VALID_TYPE),
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
      if (error) { console.error(`  ✗ Insert error: ${error.message}`); failed += valid.length }
      else inserted += valid.length
    }

    const processed = Math.min(i + CLAUDE_BATCH_SIZE, toRetry.length)
    console.log(`  [${processed}/${toRetry.length}] inserted ${inserted} · skipped ${skipped} · failed ${failed}`)

    if (processed < toRetry.length) await sleep(CLAUDE_BATCH_DELAY_MS)
  }

  console.log(`\n✓ Done.`)
  console.log(`  Inserted : ${inserted}`)
  console.log(`  Skipped  : ${skipped}`)
  console.log(`  Failed   : ${failed}`)
}

main().catch(err => { console.error('\nFatal error:', err); process.exit(1) })
