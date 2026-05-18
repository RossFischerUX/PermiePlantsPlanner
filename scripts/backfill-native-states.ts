#!/usr/bin/env tsx
/**
 * Back-fill native_states[] from existing native_range text + Claude knowledge.
 *
 * For each plant missing native_states, asks Claude Haiku to return an array
 * of 2-letter US state codes where the plant is native (or an empty array if
 * it's not native to the US). Non-US plants get an empty array, not null,
 * so they don't get re-queried on future runs.
 *
 * Usage:
 *   npm run backfill-native-states
 *
 * Requires in .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=...
 *   ANTHROPIC_API_KEY=...
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

const CLAUDE_BATCH_SIZE = 10
const CLAUDE_BATCH_DELAY_MS = 15000

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface PlantRow {
  id: string
  common_name: string
  latin_name: string
  native_range: string | null
}

const VALID_STATE_CODES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
])

async function getNativeStates(
  commonName: string,
  latinName: string,
  nativeRangeText: string | null,
): Promise<string[]> {
  try {
    const context = nativeRangeText ? ` Known native range description: "${nativeRangeText}".` : ''
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [
        {
          role: 'user',
          content: `Which US states is "${commonName}" (${latinName}) native to?${context}

Return only a JSON array of 2-letter state codes, e.g. ["CA","OR","WA"]. Return [] if not native to any US state. Use only these valid codes: AL,AK,AZ,AR,CA,CO,CT,DE,FL,GA,HI,ID,IL,IN,IA,KS,KY,LA,ME,MD,MA,MI,MN,MS,MO,MT,NE,NV,NH,NJ,NM,NY,NC,ND,OH,OK,OR,PA,RI,SC,SD,TN,TX,UT,VT,VA,WA,WV,WI,WY,DC`,
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const m = text.match(/\[[\s\S]*\]/)
    if (!m) return []
    const parsed = JSON.parse(m[0])
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is string => typeof s === 'string' && VALID_STATE_CODES.has(s.toUpperCase())).map(s => s.toUpperCase())
  } catch {
    return []
  }
}

async function main() {
  console.log('Permaculture Plant Picker — Backfill Native States')
  console.log('==================================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing from .env.local')
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing from .env.local')

  const { data, error } = await supabase
    .from('plants')
    .select('id, common_name, latin_name, native_range')
    .is('native_states', null)
    .order('common_name')

  if (error) throw new Error(`Could not fetch plants: ${error.message}`)

  const plants = (data ?? []) as PlantRow[]
  console.log(`Found ${plants.length} plants missing native_states.\n`)

  if (plants.length === 0) { console.log('Nothing to do.'); return }

  let updated = 0
  let failed = 0

  for (let i = 0; i < plants.length; i += CLAUDE_BATCH_SIZE) {
    const batch = plants.slice(i, i + CLAUDE_BATCH_SIZE)

    await Promise.all(batch.map(async plant => {
      const states = await getNativeStates(plant.common_name, plant.latin_name, plant.native_range)

      const { error: upErr } = await supabase
        .from('plants')
        .update({ native_states: states })
        .eq('id', plant.id)

      if (upErr) {
        console.error(`  ✗ ${plant.latin_name}: ${upErr.message}`)
        failed++
      } else {
        const label = states.length > 0 ? states.join(', ') : '(not US native)'
        console.log(`  ✓ ${plant.common_name}: [${label}]`)
        updated++
      }
    }))

    const processed = Math.min(i + CLAUDE_BATCH_SIZE, plants.length)
    console.log(`  [${processed}/${plants.length}] updated ${updated} · failed ${failed}\n`)

    if (processed < plants.length) await sleep(CLAUDE_BATCH_DELAY_MS)
  }

  console.log(`\n✓ Done.`)
  console.log(`  Updated: ${updated}`)
  console.log(`  Failed : ${failed}`)
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
