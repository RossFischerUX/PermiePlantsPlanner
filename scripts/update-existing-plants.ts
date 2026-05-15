#!/usr/bin/env tsx
/**
 * Back-fill horticultural data for plants already in the DB.
 *
 * Targets plants where the new detail fields (native_range, usda_zones, form,
 * growth_rate, dormancy) are all null — i.e. plants seeded before the schema
 * extension. Uses Claude claude-haiku to generate the full field set and UPDATEs
 * each row in place, preserving common_name / latin_name / image_url.
 *
 * Usage:
 *   npm run update-plants
 *
 * Requires in .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=... (or SUPABASE_SECRET_KEY=...)
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

const CLAUDE_BATCH_SIZE = 10
// 10 calls per batch, 15s gap = 40 req/min (under the 50/min haiku limit)
const CLAUDE_BATCH_DELAY_MS = 15000

// ─── Types ───────────────────────────────────────────────────────────────────

interface HorticulturalData {
  sun: 'full sun' | 'part shade' | 'full shade' | null
  water: 'low' | 'moderate' | 'high' | null
  plant_type: 'shrub' | 'tree' | 'perennial' | 'groundcover' | 'vine' | 'grass' | null
  form: string | null
  growth_rate: 'slow' | 'moderate' | 'fast' | null
  dormancy: 'evergreen' | 'deciduous' | 'semi-evergreen' | null
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

interface PlantRow {
  id: string
  common_name: string
  latin_name: string
}

// ─── Clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const VALID_SUN = ['full sun', 'part shade', 'full shade'] as const
const VALID_WATER = ['low', 'moderate', 'high'] as const
const VALID_TYPE = ['shrub', 'tree', 'perennial', 'groundcover', 'vine', 'grass'] as const

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  return allowed.find(a => a.toLowerCase() === value.toLowerCase()) ?? null
}

async function enrichWithClaude(commonName: string, latinName: string): Promise<HorticulturalData | null> {
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Permaculture Plant Picker — Back-fill Existing Plants')
  console.log('========================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) missing from .env.local')
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing from .env.local')

  // Fetch plants that are missing the new detail fields
  const { data, error } = await supabase
    .from('plants')
    .select('id, common_name, latin_name')
    .is('native_range', null)
    .is('usda_zones', null)
    .is('form', null)
    .is('growth_rate', null)
    .is('dormancy', null)
    .order('created_at', { ascending: true })

  if (error) throw new Error(`Could not fetch plants: ${error.message}`)

  const plants = (data ?? []) as PlantRow[]
  console.log(`Found ${plants.length} plants to back-fill.\n`)

  if (plants.length === 0) {
    console.log('Nothing to do.')
    return
  }

  let updated = 0
  let skipped = 0
  let failed = 0

  for (let i = 0; i < plants.length; i += CLAUDE_BATCH_SIZE) {
    const batch = plants.slice(i, i + CLAUDE_BATCH_SIZE)

    await Promise.all(
      batch.map(async plant => {
        const hort = await enrichWithClaude(plant.common_name, plant.latin_name)

        if (!hort || (!hort.description && !hort.sun && !hort.water)) {
          console.warn(`  ⚠ Skipping ${plant.latin_name} (insufficient data)`)
          skipped++
          return
        }

        const { error: updateError } = await supabase
          .from('plants')
          .update({
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
          })
          .eq('id', plant.id)

        if (updateError) {
          console.error(`  ✗ Update failed for ${plant.latin_name}: ${updateError.message}`)
          failed++
        } else {
          console.log(`  ✓ ${plant.common_name} (${plant.latin_name})`)
          updated++
        }
      }),
    )

    const processed = Math.min(i + CLAUDE_BATCH_SIZE, plants.length)
    console.log(`  [${processed}/${plants.length}] updated ${updated} · skipped ${skipped} · failed ${failed}\n`)

    if (processed < plants.length) {
      await sleep(CLAUDE_BATCH_DELAY_MS)
    }
  }

  console.log(`\n✓ Done.`)
  console.log(`  Updated : ${updated}`)
  console.log(`  Skipped : ${skipped}  (insufficient data from Claude)`)
  console.log(`  Failed  : ${failed}   (DB update errors)`)
}

main().catch(err => {
  console.error('\nFatal error:', err)
  process.exit(1)
})
