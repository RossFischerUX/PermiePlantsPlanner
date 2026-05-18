#!/usr/bin/env tsx
/**
 * Back-fill usda_zone_min and usda_zone_max from the existing usda_zones TEXT field.
 *
 * Pass 1: parse usda_zones text with regex (handles "7-10", "9a-10b", "Zone 9", etc.)
 * Pass 2: for rows where parsing failed, ask Claude Haiku to return structured zone labels.
 *
 * Usage:
 *   npm run backfill-zones
 *
 * Requires in .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=... (or SUPABASE_SECRET_KEY=...)
 *   ANTHROPIC_API_KEY=...   (only needed for Claude fallback pass)
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

// ─── Zone encoding (inlined from lib/zones.ts) ───────────────────────────────

function encodeZone(label: string): number | null {
  const match = label.trim().toLowerCase().match(/^(\d+)([ab])?$/)
  if (!match) return null
  const major = parseInt(match[1], 10)
  if (major < 1 || major > 13) return null
  const half = match[2] === 'b' ? 1 : 0
  return major * 2 + half
}

function parseZoneRange(text: string): [number, number] | null {
  const clean = text.replace(/zones?\s*/gi, '').trim()
  const parts = clean.split(/[–—-]/).map(s => s.trim()).filter(Boolean)

  if (parts.length === 1) {
    // "Zone 9" means "suitable for zone 9 and all colder zones (1–9)"
    // zone N is the warmth ceiling, not a point value — min is always 1a
    const hasLetter = /[ab]$/i.test(parts[0])
    const max = encodeZone(hasLetter ? parts[0] : parts[0] + 'b')
    if (max === null) return null
    return [2, max] // 2 = zone 1a (coldest possible)
  }

  if (parts.length === 2) {
    const minLabel = /[ab]$/i.test(parts[0]) ? parts[0] : parts[0] + 'a'
    const maxLabel = /[ab]$/i.test(parts[1]) ? parts[1] : parts[1] + 'b'
    const minEnc = encodeZone(minLabel)
    const maxEnc = encodeZone(maxLabel)
    if (minEnc === null || maxEnc === null) return null
    return [minEnc, maxEnc]
  }

  return null
}

// ─── Clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

interface PlantRow {
  id: string
  common_name: string
  latin_name: string
  usda_zones: string
}

async function askClaudeForZones(
  commonName: string,
  latinName: string,
): Promise<[number, number] | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 80,
      messages: [
        {
          role: 'user',
          content: `What are the USDA hardiness zones for "${commonName}" (${latinName})? Return only a JSON object like {"min":"7a","max":"10b"} using half-zone labels (e.g. 3a, 9b). Use null if unknown.`,
        },
      ],
    })
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return null
    const { min, max } = JSON.parse(m[0])
    if (!min || !max) return null
    const minEnc = encodeZone(String(min))
    const maxEnc = encodeZone(String(max))
    if (minEnc === null || maxEnc === null) return null
    return [minEnc, maxEnc]
  } catch {
    return null
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Permaculture Plant Picker — Backfill USDA Zone Integers')
  console.log('======================================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing from .env.local')

  const { data, error } = await supabase
    .from('plants')
    .select('id, common_name, latin_name, usda_zones')
    .not('usda_zones', 'is', null)
    .is('usda_zone_min', null)
    .order('common_name')

  if (error) throw new Error(`Could not fetch plants: ${error.message}`)

  const plants = (data ?? []) as PlantRow[]
  console.log(`Found ${plants.length} plants with usda_zones text but no usda_zone_min.\n`)

  if (plants.length === 0) { console.log('Nothing to do.'); return }

  let regexParsed = 0
  let claudeFallback = 0
  let failed = 0
  const needsClaude: PlantRow[] = []

  // Pass 1: parse via regex
  for (const plant of plants) {
    const range = parseZoneRange(plant.usda_zones)
    if (range) {
      const { error: upErr } = await supabase
        .from('plants')
        .update({ usda_zone_min: range[0], usda_zone_max: range[1] })
        .eq('id', plant.id)
      if (upErr) {
        console.error(`  ✗ ${plant.latin_name}: ${upErr.message}`)
        failed++
      } else {
        console.log(`  ✓ ${plant.common_name}: "${plant.usda_zones}" → [${range[0]}, ${range[1]}]`)
        regexParsed++
      }
    } else {
      needsClaude.push(plant)
    }
  }

  console.log(`\nPass 1 complete: ${regexParsed} parsed, ${needsClaude.length} need Claude fallback.\n`)

  if (needsClaude.length === 0 || !ANTHROPIC_API_KEY) {
    if (needsClaude.length > 0) {
      console.log(`Skipping Claude pass (ANTHROPIC_API_KEY not set). ${needsClaude.length} plants left unresolved:`)
      needsClaude.forEach(p => console.log(`  - ${p.common_name}: "${p.usda_zones}"`))
    }
  } else {
    // Pass 2: Claude fallback for unparseable zone strings
    for (let i = 0; i < needsClaude.length; i += CLAUDE_BATCH_SIZE) {
      const batch = needsClaude.slice(i, i + CLAUDE_BATCH_SIZE)
      await Promise.all(batch.map(async plant => {
        const range = await askClaudeForZones(plant.common_name, plant.latin_name)
        if (!range) {
          console.warn(`  ⚠ Claude couldn't resolve zones for ${plant.common_name} ("${plant.usda_zones}")`)
          failed++
          return
        }
        const { error: upErr } = await supabase
          .from('plants')
          .update({ usda_zone_min: range[0], usda_zone_max: range[1] })
          .eq('id', plant.id)
        if (upErr) {
          console.error(`  ✗ ${plant.latin_name}: ${upErr.message}`)
          failed++
        } else {
          console.log(`  ✓ (Claude) ${plant.common_name}: [${range[0]}, ${range[1]}]`)
          claudeFallback++
        }
      }))
      if (i + CLAUDE_BATCH_SIZE < needsClaude.length) await sleep(CLAUDE_BATCH_DELAY_MS)
    }
  }

  console.log(`\n✓ Done.`)
  console.log(`  Regex parsed : ${regexParsed}`)
  console.log(`  Claude filled: ${claudeFallback}`)
  console.log(`  Failed/skipped: ${failed}`)
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
