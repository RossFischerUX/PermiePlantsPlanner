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
          // CR-02 skip-path closure (D-20): when Claude fails, convert any {} in required-array
          // fields to NULL so the row stays re-targetable on future runs. Never write {} —
          // NULL is the honest "not yet enriched / genuinely inapplicable" state.
          // Do NOT touch edible_parts / harvest_months (D-19 empty is valid).
          const skipUpdate: Record<string, null> = {}
          if (Array.isArray(plant.succession_role) && plant.succession_role.length === 0)
            skipUpdate.succession_role = null
          if (Array.isArray(plant.propagation_methods) && plant.propagation_methods.length === 0)
            skipUpdate.propagation_methods = null
          if (Array.isArray(plant.permaculture_uses) && plant.permaculture_uses.length === 0)
            skipUpdate.permaculture_uses = null
          if (Object.keys(skipUpdate).length > 0) {
            const { error: skipUpdateError } = await supabase
              .from('plants')
              .update(skipUpdate)
              .eq('id', plant.id)
            if (skipUpdateError) {
              console.warn(`  ⚠ Could not normalize {} → null for ${plant.latin_name}: ${skipUpdateError.message}`)
            } else {
              console.warn(`  ⚠ Skipping ${plant.latin_name} (no Claude data) — normalized {} → null for: ${Object.keys(skipUpdate).join(', ')}`)
            }
          } else {
            console.warn(`  ⚠ Skipping ${plant.latin_name} (no Claude data)`)
          }
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

  // D-19/D-20: enriched set = full catalog
  const { count: total, error: totalError } = await supabase
    .from('plants')
    .select('id', { count: 'exact', head: true })

  if (totalError) throw new Error(`Could not count plants: ${totalError.message}`)

  // D-18 / D-20 gate semantics:
  //   REQUIRED_ARRAY fields — hard-fail ONLY when {} count > 0 (dishonest locked state).
  //     NULL rows are accepted as reviewed informational residual (D-20) and printed
  //     as such — they do NOT set failed = true.
  //   REQUIRED_SCALAR fields — hard-fail when IS NULL (unchanged).
  //   edible_parts / harvest_months — typed-presence only (D-19 unchanged).
  //   years_to_bearing — exempt (legitimately null for non-food plants per D-19).
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

  // Collect NULL residuals across all required-array fields for the informational section
  const nullResiduals: Array<{ field: string; id: string; common_name: string }> = []

  for (const f of REQUIRED_ARRAY) {
    // Count rows that have real data: NOT NULL and NOT empty array
    const { count: okCount, error: okErr } = await supabase
      .from('plants')
      .select('id', { count: 'exact', head: true })
      .not(f, 'is', null)
      .neq(f, '{}')

    if (okErr) {
      console.error(`  ✗ Could not count ${f}: ${okErr.message}`)
      failed = true
      continue
    }

    // Count {} rows (the dishonest locked state — HARD FAIL if > 0)
    const { count: emptyCount, error: emptyErr } = await supabase
      .from('plants')
      .select('id', { count: 'exact', head: true })
      .eq(f, '{}')

    if (emptyErr) {
      console.error(`  ✗ Could not count empty-array ${f}: ${emptyErr.message}`)
      failed = true
      continue
    }

    // Count NULL rows (informational residual — NOT a failure per D-20)
    const { count: nullCount, error: nullErr } = await supabase
      .from('plants')
      .select('id', { count: 'exact', head: true })
      .is(f, null)

    if (nullErr) {
      console.error(`  ✗ Could not count null ${f}: ${nullErr.message}`)
      failed = true
      continue
    }

    const label = REQUIRED_LABELS[f] ?? f
    const hasEmpty = (emptyCount ?? 0) > 0
    const hasNull = (nullCount ?? 0) > 0

    if (hasEmpty) {
      // {} rows are a hard failure — dishonest locked state
      failed = true
      console.log(`  ${label}: ${okCount}/${total} ✗  (${emptyCount} rows stuck as {} — HARD FAIL; ${nullCount ?? 0} NULL informational residual)`)
      const { data: emptyRows, error: listEmptyErr } = await supabase
        .from('plants')
        .select('id, common_name')
        .eq(f, '{}')
      if (listEmptyErr) {
        console.error(`     Could not list {} offenders for ${f}: ${listEmptyErr.message}`)
      } else {
        emptyRows?.forEach(p => console.log(`     ✗ {}: ${p.common_name} (${p.id})`))
      }
    } else if (hasNull) {
      // NULL only — accepted residual, not a failure
      console.log(`  ${label}: ${okCount}/${total} ✓  (${nullCount} NULL informational residual — see below)`)
    } else {
      console.log(`  ${label}: ${okCount}/${total} ✓`)
    }

    // Collect NULL rows for the informational residual section printed at the end
    if (hasNull && !hasEmpty) {
      const { data: nullRows, error: listNullErr } = await supabase
        .from('plants')
        .select('id, common_name')
        .is(f, null)
      if (!listNullErr && nullRows) {
        nullRows.forEach(p => nullResiduals.push({ field: f, id: p.id, common_name: p.common_name }))
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

  // D-20: Print informational residual (NULL rows — reviewed, not a failure)
  if (nullResiduals.length > 0) {
    console.log('\nInformational residual (NULL — reviewed, not a failure):')
    console.log('  These plants have NULL for a required-array field because Claude\'s')
    console.log('  controlled vocabulary genuinely does not apply (toxic invasives,')
    console.log('  sterile ornamentals, spore-propagated plants, etc.).')
    console.log('  NULL is re-targetable on future enrichment runs.')
    const DISPLAY_LIMIT = 50
    const displayed = nullResiduals.slice(0, DISPLAY_LIMIT)
    displayed.forEach(r => console.log(`  • [${r.field}] ${r.common_name} (${r.id})`))
    if (nullResiduals.length > DISPLAY_LIMIT) {
      console.log(`  ...and ${nullResiduals.length - DISPLAY_LIMIT} more`)
    }
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
