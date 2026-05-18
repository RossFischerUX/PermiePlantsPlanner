#!/usr/bin/env tsx
/**
 * Back-fill plant_native_counties from Flora API.
 *
 * DEFERRED — requires a Flora API subscription ($19/month, one-time run is sufficient).
 * Subscribe at https://floraapi.com, get your API key, add it to .env.local:
 *   FLORA_API_KEY=...
 *
 * This script is idempotent — safe to re-run. It skips plants already in
 * plant_native_counties. Subscribe for one month, run this script against all
 * plants, then cancel — the data is stored permanently in the DB.
 *
 * Usage:
 *   npm run backfill-native-counties
 *
 * Requires in .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   FLORA_API_KEY=...
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const FLORA_API_KEY = process.env.FLORA_API_KEY

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface CountyEntry {
  state_code: string
  county_name: string
}

async function fetchCountiesFromFlora(latinName: string): Promise<CountyEntry[]> {
  const url = `https://floraapi.com/api/v1/species?name=${encodeURIComponent(latinName)}&fields=county_distribution`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${FLORA_API_KEY}` },
  })

  if (res.status === 429) {
    console.warn('  ⚠ Flora API rate limit hit — waiting 60s')
    await sleep(60000)
    return fetchCountiesFromFlora(latinName)
  }

  if (!res.ok) {
    if (res.status === 404) return []
    throw new Error(`Flora API error ${res.status} for ${latinName}`)
  }

  const json = await res.json()
  // Expected shape: { county_distribution: [{ state: "CA", county: "Marin" }, ...] }
  const dist: { state?: string; county?: string }[] = json?.county_distribution ?? []
  return dist
    .filter(d => d.state && d.county)
    .map(d => ({ state_code: d.state!.toUpperCase(), county_name: d.county! }))
}

async function main() {
  console.log('Permaculture Plant Picker — Backfill Native Counties (Flora API)')
  console.log('================================================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing from .env.local')

  if (!FLORA_API_KEY) {
    console.error('FLORA_API_KEY is not set in .env.local.')
    console.error('Subscribe at https://floraapi.com ($19/month), run this script, then cancel.')
    console.error('One month is sufficient to backfill all plants in the DB.')
    process.exit(1)
  }

  // Fetch plants that have native_states but haven't been county-backfilled yet
  const { data: allPlants, error: plantsErr } = await supabase
    .from('plants')
    .select('id, latin_name, common_name')
    .not('native_states', 'is', null)
    .order('common_name')

  if (plantsErr) throw new Error(`Could not fetch plants: ${plantsErr.message}`)

  // Find which plant_ids already have county rows
  const { data: existing } = await supabase
    .from('plant_native_counties')
    .select('plant_id')

  const alreadyDone = new Set((existing ?? []).map(r => r.plant_id))
  const plants = (allPlants ?? []).filter(p => !alreadyDone.has(p.id))

  console.log(`${allPlants?.length ?? 0} plants with native_states, ${plants.length} not yet county-backfilled.\n`)

  if (plants.length === 0) { console.log('Nothing to do.'); return }

  let inserted = 0
  let notFound = 0
  let failed = 0

  for (const plant of plants) {
    try {
      const counties = await fetchCountiesFromFlora(plant.latin_name)
      if (counties.length === 0) {
        console.log(`  – ${plant.common_name}: no county data`)
        notFound++
        // Insert a sentinel row so we don't re-query this plant
        await supabase.from('plant_native_counties').upsert({
          plant_id: plant.id,
          state_code: '__',
          county_name: '__none__',
        })
      } else {
        const rows = counties.map(c => ({
          plant_id: plant.id,
          state_code: c.state_code,
          county_name: c.county_name,
        }))
        const { error: insErr } = await supabase.from('plant_native_counties').upsert(rows)
        if (insErr) {
          console.error(`  ✗ ${plant.latin_name}: ${insErr.message}`)
          failed++
        } else {
          console.log(`  ✓ ${plant.common_name}: ${counties.length} counties`)
          inserted++
        }
      }
    } catch (err) {
      console.error(`  ✗ ${plant.latin_name}:`, (err as Error).message)
      failed++
    }

    // Stay well within Flora API rate limits
    await sleep(300)
  }

  console.log(`\n✓ Done.`)
  console.log(`  Inserted : ${inserted} plants with county data`)
  console.log(`  Not found: ${notFound} (no Flora API match)`)
  console.log(`  Failed   : ${failed}`)
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
