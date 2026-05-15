#!/usr/bin/env tsx
/**
 * Replaces Wikimedia Commons image URLs with iNaturalist CDN photos.
 * Targets plants whose image_url contains "wikipedia" or "wikimedia".
 *
 * Usage:
 *   npm run fix-images
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchInatPhoto(latinName: string): Promise<string | null> {
  // Strip cultivar names like 'Ray Hartman' — iNaturalist only knows species, not cultivars.
  // Also try genus-only as a final fallback.
  const baseName = latinName.replace(/'[^']*'/g, '').trim()
  const genus = baseName.split(' ')[0]
  const queries = [...new Set([latinName, baseName, genus])]

  for (const q of queries) {
    try {
      const url = new URL('https://api.inaturalist.org/v1/taxa')
      url.searchParams.set('q', q)
      url.searchParams.set('rank', 'species')
      url.searchParams.set('locale', 'en')
      url.searchParams.set('per_page', '3')
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'PlantMasterDB/1.0 (educational project; rossfischer)' },
      })
      if (!res.ok) continue
      const json = await res.json()
      // Prefer an exact name match; fall back to first result with a photo
      const exact = json.results?.find((r: { name: string }) =>
        r.name.toLowerCase().startsWith(baseName.toLowerCase())
      )
      const result = exact ?? json.results?.[0]
      const photo = result?.default_photo?.medium_url
      if (photo) return photo
    } catch {
      continue
    }
  }
  return null
}

async function main() {
  console.log('PlantMaster — Fix Wikimedia Images')
  console.log('====================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SECRET_KEY missing from .env.local')

  const { data, error } = await supabase
    .from('plants')
    .select('id, common_name, latin_name, image_url')
    .or('image_url.ilike.%wikipedia%,image_url.ilike.%wikimedia%,image_url.is.null')

  if (error) throw new Error(`DB error: ${error.message}`)

  const plants = data ?? []
  console.log(`Found ${plants.length} plants with Wikimedia or missing images.\n`)

  let fixed = 0, unchanged = 0, failed = 0

  for (const plant of plants) {
    await sleep(1100)  // iNaturalist rate limit
    const imageUrl = await fetchInatPhoto(plant.latin_name)

    if (!imageUrl) {
      console.warn(`  ⚠ No iNat photo found for ${plant.latin_name}`)
      unchanged++
      continue
    }

    const { error: updateError } = await supabase
      .from('plants')
      .update({ image_url: imageUrl })
      .eq('id', plant.id)

    if (updateError) {
      console.error(`  ✗ Failed to update ${plant.latin_name}: ${updateError.message}`)
      failed++
    } else {
      console.log(`  ✓ ${plant.common_name}`)
      fixed++
    }
  }

  console.log(`\n✓ Done.`)
  console.log(`  Fixed    : ${fixed}`)
  console.log(`  No photo : ${unchanged}`)
  console.log(`  Failed   : ${failed}`)
}

main().catch(err => { console.error('\nFatal error:', err); process.exit(1) })
