#!/usr/bin/env tsx
/**
 * Enrich functional data for all plants in the DB.
 *
 * TWO OPPOSITE SKIP SEMANTICS — intentionally different (PATTERNS Pitfall 2):
 *   permaculture_uses = ALWAYS overwrite (D-01): re-enriches every targeted row to
 *     the D-02 16-tag controlled vocabulary; legacy values are replaced.
 *   The 7 NEW fields = per-field skip-if-populated (D-17): a second run does no
 *     work for fields already filled; NULL-on-failure keeps the row targetable for reruns.
 *
 * Targeting: selects rows where ANY of the 7 new fields is null (OR-of-nulls).
 * permaculture_uses is deliberately NOT in the OR clause — it is always rewritten
 * for every row the targeting query returns.
 *
 * Usage:
 *   npm run enrich-functional-data
 *   npm run enrich-functional-data -- --verify
 *
 * Requires in .env.local:
 *   SUPABASE_SECRET_KEY=... (or SUPABASE_SERVICE_ROLE_KEY=...)
 *   ANTHROPIC_API_KEY=...
 */

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import {
  FUNCTIONAL_ROLE_OPTIONS,
  SUCCESSION_OPTIONS,
  ESTABLISHMENT_OPTIONS,
  MAINTENANCE_OPTIONS,
  PROPAGATION_OPTIONS,
  EDIBLE_PART_OPTIONS,
  MONTH_OPTIONS,
} from '../lib/plant-labels'

dotenv.config({ path: '.env.local' })

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

const CLAUDE_BATCH_SIZE = 10
// 10 calls per batch, 15s gap = 40 req/min (under the 50/min haiku limit)
// CLAUDE.md HARD RULE — do not shorten
const CLAUDE_BATCH_DELAY_MS = 15000

// ─── Clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Vocab Sets for whitelist validation (D-03 drop-invalid — array validArr + single normalizeEnum)
const FUNCTIONAL_ROLE_SET = new Set(FUNCTIONAL_ROLE_OPTIONS.map(s => s.toLowerCase()))
const SUCCESSION_SET = new Set(SUCCESSION_OPTIONS.map(s => s.toLowerCase()))
const ESTABLISHMENT_SET = new Set(ESTABLISHMENT_OPTIONS.map(s => s.toLowerCase()))
const MAINTENANCE_SET = new Set(MAINTENANCE_OPTIONS.map(s => s.toLowerCase()))
const PROPAGATION_SET = new Set(PROPAGATION_OPTIONS.map(s => s.toLowerCase()))
const EDIBLE_SET = new Set(EDIBLE_PART_OPTIONS.map(s => s.toLowerCase()))
const MONTH_SET = new Set(MONTH_OPTIONS.map(s => s.toLowerCase()))

// Enum validator — COPY VERBATIM from update-existing-plants.ts:91-94
function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  return allowed.find(a => a.toLowerCase() === value.toLowerCase()) ?? null
}

// Array vocab validator — adapted from backfill-native-states.ts:77 (Set-filter, D-03 drop-invalid)
const validArr = (arr: unknown, allow: Set<string>): string[] =>
  Array.isArray(arr)
    ? arr.filter((s): s is string => typeof s === 'string' && allow.has(s.toLowerCase()))
    : []

// ─── Types ───────────────────────────────────────────────────────────────────

interface FunctionalData {
  permaculture_uses: string[] | null
  succession_role: string[] | null
  establishment_difficulty: string | null
  maintenance_level: string | null
  years_to_bearing: number | null
  propagation_methods: string[] | null
  edible_parts: string[] | null
  harvest_months: string[] | null
}

interface PlantRow {
  id: string
  common_name: string
  latin_name: string
  permaculture_uses: string[] | null
  succession_role: string[] | null
  establishment_difficulty: string | null
  maintenance_level: string | null
  years_to_bearing: number | null
  propagation_methods: string[] | null
  edible_parts: string[] | null
  harvest_months: string[] | null
}

// ─── Claude enrichment ───────────────────────────────────────────────────────

async function enrichWithClaude(commonName: string, latinName: string): Promise<FunctionalData | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 900, // raised from 600 — ~8-field schema is larger (Pitfall 5)
      messages: [
        {
          role: 'user',
          content: `You are a permaculture plant database. For the plant "${commonName}" (${latinName}), return functional data as a single JSON object. Use null for scalar fields you are not confident about; use [] for unknown arrays (not null). Do not explain anything — only return valid JSON.

{
  "permaculture_uses": array of zero or more tags from: ["nitrogen fixer","dynamic accumulator","insectary plant","chop-and-drop","wildlife benefit","medicinal","fiber","groundcover","windbreak","pollinator nectary","bee forage","living mulch","biomass producer","erosion control","hedgerow","edible"] — use [] if none apply,
  "succession_role": array from ["pioneer","early successional","mid successional","climax"] — use [] if unknown,
  "establishment_difficulty": "easy" | "moderate" | "challenging" | null,
  "maintenance_level": "low" | "moderate" | "high" | null,
  "years_to_bearing": integer (earliest year to first harvest for food plants) | null (non-food or unknown),
  "propagation_methods": array from ["seed","cutting","division","layering","grafting","root cutting","tuber","sucker"] — use [] if unknown,
  "edible_parts": array from ["leaf","fruit","nut","seed","root","flower","bark","sap","shoot","pod"] — use [] if not edible,
  "harvest_months": array of month names ["January","February",...] — use [] if not applicable
}`,
        },
      ],
    })

    const block = response.content[0]
    const text = block && block.type === 'text' ? block.text.trim() : ''
    if (!text) {
      console.warn(`  ⚠ Truncated or empty content block from Claude for ${latinName}`)
      return null
    }
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) {
      console.warn(`  ⚠ No JSON in Claude response for ${latinName}`)
      return null
    }
    return JSON.parse(match[0]) as FunctionalData
  } catch (err) {
    console.warn(`  ⚠ Claude error for ${latinName}:`, (err as Error).message)
    return null
  }
}

// ─── Targeting ───────────────────────────────────────────────────────────────

// permaculture_uses = ALWAYS overwrite (D-01); the 7 new fields = per-field skip-if-populated (D-17).
// These are intentionally opposite — see PATTERNS Pitfall 2.
// permaculture_uses is deliberately NOT in TARGET_FIELDS and NOT in the .or() clause.
// years_to_bearing is deliberately NOT a targeting trigger: per D-19 it is legitimately
// null for non-food plants, so including it in the OR-of-nulls would re-target those
// rows forever (breaking D-17's "second run is a no-op"). It is still backfilled by the
// per-field merge whenever a row is targeted for a genuine gap in the other 6 fields.
const TARGET_FIELDS = [
  'succession_role',
  'establishment_difficulty',
  'maintenance_level',
  'propagation_methods',
  'edible_parts',
  'harvest_months',
] as const

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Permaculture Plant Picker — Enrich Functional Data')
  console.log('==================================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) missing from .env.local')
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing from .env.local')

  // Select rows where ANY of the 7 new fields is null (OR-of-nulls on new fields only).
  // Also re-selects rows where required array fields are empty ({}) — not null but carrying
  // no data. These were permanently stuck before ([] is not null, OR-of-nulls missed them).
  // permaculture_uses empty-array rows are explicitly included so those 8 stuck rows can
  // be re-enriched, even though permaculture_uses is excluded from TARGET_FIELDS (D-01).
  // Paginate via .range(): PostgREST caps a single response at 1000 rows, and the
  // live catalog exceeds that — without paging, rows beyond 1000 are silently dropped.
  const PAGE_SIZE = 1000
  const plants: PlantRow[] = []
  const emptyArrayTerms = [
    'succession_role.eq.{}',
    'propagation_methods.eq.{}',
    'permaculture_uses.eq.{}',
  ]
  const orClause = [
    ...TARGET_FIELDS.map(f => `${f}.is.null`),
    ...emptyArrayTerms,
  ].join(',')
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('plants')
      .select('id, common_name, latin_name, permaculture_uses, succession_role, establishment_difficulty, maintenance_level, years_to_bearing, propagation_methods, edible_parts, harvest_months')
      .or(orClause)
      .order('common_name')
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (error) throw new Error(`Could not fetch plants: ${error.message}`)

    const rows = (data ?? []) as PlantRow[]
    plants.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  console.log(`Found ${plants.length} plants to enrich.\n`)

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
        const raw = await enrichWithClaude(plant.common_name, plant.latin_name)

        if (!raw) {
          console.warn(`  ⚠ Skipping ${plant.latin_name} (no Claude data)`)
          skipped++
          return
        }

        // Build the update payload.
        //
        // permaculture_uses: ALWAYS overwrite (D-01 re-enrich — not behind a skip guard).
        // The 7 new fields: per-field skip-if-populated (D-17 — only write when currently null).
        //
        // Empty-array convention (Pitfall 3): write [] only after a deliberate enrichment pass
        // (non-edible plant → edible_parts = []); keep NULL on Claude failure so the row
        // remains in the OR-of-nulls target and is retried on the next run.
        // CR-02: for required array fields, treat an all-invalid array the same as a Claude
        // failure — write null (not []) so the row stays targetable on reruns. Mirror the
        // normalizeEnum precedent (null on out-of-vocab) for array fields.
        // edible_parts / harvest_months keep [] semantics (D-19: empty is valid for non-edible).
        const puArr = validArr(raw.permaculture_uses, FUNCTIONAL_ROLE_SET)
        const update: Record<string, unknown> = {
          permaculture_uses: puArr.length ? puArr : null, // D-01: ALWAYS overwrite; null if all-invalid
        }

        if (plant.succession_role == null || (Array.isArray(plant.succession_role) && plant.succession_role.length === 0)) {
          const v = validArr(raw.succession_role, SUCCESSION_SET)
          update.succession_role = v.length ? v : null
        }
        if (plant.establishment_difficulty == null)
          update.establishment_difficulty = normalizeEnum(raw.establishment_difficulty, ESTABLISHMENT_OPTIONS as readonly string[])
        if (plant.maintenance_level == null)
          update.maintenance_level = normalizeEnum(raw.maintenance_level, MAINTENANCE_OPTIONS as readonly string[])
        if (plant.years_to_bearing == null) {
          const y = raw.years_to_bearing
          update.years_to_bearing =
            typeof y === 'number' && Number.isInteger(y) && y > 0 && y <= 200 ? y : null
        }
        if (plant.propagation_methods == null || (Array.isArray(plant.propagation_methods) && plant.propagation_methods.length === 0)) {
          const v = validArr(raw.propagation_methods, PROPAGATION_SET)
          update.propagation_methods = v.length ? v : null
        }
        if (plant.edible_parts == null)
          update.edible_parts = validArr(raw.edible_parts, EDIBLE_SET) // [] if non-edible — deliberate, idempotent
        if (plant.harvest_months == null)
          update.harvest_months = validArr(raw.harvest_months, MONTH_SET) // [] if no harvest months

        // permaculture_uses is always present so Object.keys(update).length > 0 is always true
        const { error: updateError } = await supabase
          .from('plants')
          .update(update)
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
  console.log(`  Skipped : ${skipped}  (no Claude data)`)
  console.log(`  Failed  : ${failed}   (DB update errors)`)
}

// ─── Verify ──────────────────────────────────────────────────────────────────

async function verify() {
  console.log('Permaculture Plant Picker — Verify Functional Data Coverage')
  console.log('============================================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) missing from .env.local')

  // D-19: enriched set = full ~250 catalog
  const { count: total, error: totalError } = await supabase
    .from('plants')
    .select('id', { count: 'exact', head: true })

  if (totalError) throw new Error(`Could not count plants: ${totalError.message}`)

  // D-18: REQUIRED fields that must have non-null, non-empty coverage across all plants.
  // D-19 exemptions:
  //   years_to_bearing — legitimately null for non-food plants (EXEMPT)
  //   edible_parts / harvest_months — empty {} arrays are valid; assert typed presence only
  //
  // REQUIRED_ARRAY fields use a two-condition count: NOT NULL AND NOT empty-array.
  // An empty {} array is no data — it must not count as covered (CR-02 fix).
  // REQUIRED_SCALAR fields use the existing .not(f,'is',null) check (no empty-array concept).
  const REQUIRED_ARRAY = ['permaculture_uses', 'succession_role', 'propagation_methods'] as const
  const REQUIRED_SCALAR = ['establishment_difficulty', 'maintenance_level'] as const

  const REQUIRED_LABELS: Record<string, string> = {
    permaculture_uses: 'functional_roles (permaculture_uses)',
    succession_role: 'succession_role',
    establishment_difficulty: 'establishment_difficulty',
    maintenance_level: 'maintenance_level',
    propagation_methods: 'propagation_methods',
  }

  let failed = false

  for (const f of REQUIRED_ARRAY) {
    // Count rows that have real data: NOT NULL and NOT empty array
    const { count: ok, error: countError } = await supabase
      .from('plants')
      .select('id', { count: 'exact', head: true })
      .not(f, 'is', null)
      .neq(f, '{}')

    if (countError) {
      console.error(`  ✗ Could not count ${f}: ${countError.message}`)
      failed = true
      continue
    }

    const label = REQUIRED_LABELS[f] ?? f
    const mark = ok === total ? '✓' : '✗'
    console.log(`  ${label}: ${ok}/${total} ${mark}`)

    if (ok !== total) {
      failed = true
      // Surface both NULL offenders and empty-array offenders
      const { data: nullBad, error: nullErr } = await supabase
        .from('plants')
        .select('id, common_name')
        .is(f, null)
      const { data: emptyBad, error: emptyErr } = await supabase
        .from('plants')
        .select('id, common_name')
        .eq(f, '{}')

      if (nullErr) {
        console.error(`     Could not list null offenders for ${f}: ${nullErr.message}`)
      } else {
        nullBad?.forEach(p => console.log(`     ✗ null: ${p.common_name} (${p.id})`))
      }
      if (emptyErr) {
        console.error(`     Could not list empty-array offenders for ${f}: ${emptyErr.message}`)
      } else {
        emptyBad?.forEach(p => console.log(`     ✗ {}: ${p.common_name} (${p.id})`))
      }
    }
  }

  for (const f of REQUIRED_SCALAR) {
    const { count: ok, error: countError } = await supabase
      .from('plants')
      .select('id', { count: 'exact', head: true })
      .not(f, 'is', null)

    if (countError) {
      console.error(`  ✗ Could not count ${f}: ${countError.message}`)
      failed = true
      continue
    }

    const label = REQUIRED_LABELS[f] ?? f
    const mark = ok === total ? '✓' : '✗'
    console.log(`  ${label}: ${ok}/${total} ${mark}`)

    if (ok !== total) {
      failed = true
      const { data: bad, error: badError } = await supabase
        .from('plants')
        .select('id, common_name')
        .is(f, null)

      if (badError) {
        console.error(`     Could not list offenders for ${f}: ${badError.message}`)
      } else {
        bad?.forEach(p => console.log(`     ✗ ${p.common_name} (${p.id})`))
      }
    }
  }

  // D-19: typed-presence check for edible_parts / harvest_months
  // A successful .limit(1) select proves the columns exist and are typed correctly.
  // Empty {} arrays are valid (non-edible plants); this is NOT a non-null assertion.
  const { error: presenceError } = await supabase
    .from('plants')
    .select('edible_parts, harvest_months')
    .limit(1)

  if (presenceError) {
    console.error(`  ✗ edible_parts / harvest_months column presence check failed: ${presenceError.message}`)
    failed = true
  } else {
    console.log(`  edible_parts / harvest_months: typed columns present ✓`)
  }

  console.log('')
  process.exit(failed ? 1 : 0)
}

// ─── Entry point ─────────────────────────────────────────────────────────────

if (process.argv.includes('--verify')) {
  verify().catch(err => { console.error('\nFatal error:', err); process.exit(1) })
} else {
  main().catch(err => { console.error('\nFatal error:', err); process.exit(1) })
}
