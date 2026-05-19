#!/usr/bin/env tsx
/**
 * Verify the plant_relationships seed: probe tomato relationships and assert D-06 coverage.
 *
 * Usage:
 *   npx tsx scripts/verify-relationships.ts
 *
 * Requires in .env.local:
 *   SUPABASE_SERVICE_ROLE_KEY=... (or SUPABASE_SECRET_KEY=...)
 *   NEXT_PUBLIC_SUPABASE_URL=...
 *
 * Note: .or() and global confidence queries return a small filtered set well under the
 * PostgREST 1000-row cap at ~15-pair seed scale — no .range() pagination needed.
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import type { PlantRelationship } from '../lib/types'

dotenv.config({ path: '.env.local' })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVICE_ROLE_KEY missing from .env.local')

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  // 1. Resolve the probe plant (tomato) by name.
  const { data: tomato, error: tErr } = await supabase
    .from('plants')
    .select('id, common_name')
    .ilike('common_name', 'tomato')
    .single()
  if (tErr || !tomato) throw new Error(`Probe plant "tomato" not found: ${tErr?.message}`)

  // 2. Fetch every relationship where tomato is subject OR object.
  const { data, error } = await supabase
    .from('plant_relationships')
    .select('*')
    .or(`subject_plant_id.eq.${tomato.id},object_plant_id.eq.${tomato.id}`)
    .returns<PlantRelationship[]>()
  if (error) throw new Error(`Query failed: ${error.message}`)

  const rows = data ?? []

  // 3. Honest-gate assertions (D-06 coverage requirements).
  const fails: string[] = []
  if (rows.length < 2) fails.push(`expected ≥2 tomato relationships, got ${rows.length}`)
  if (!rows.some(r => r.relationship_type === 'HELPS')) fails.push('no HELPS row for tomato')
  if (!rows.some(r => r.relationship_type === 'AVOIDS')) fails.push('no AVOIDS row for tomato')
  for (const r of rows) {
    if (!r.subject_plant_id || !r.object_plant_id) fails.push(`row ${r.id}: missing plant id`)
    if (!r.relationship_type) fails.push(`row ${r.id}: missing relationship_type`)
    if (!r.confidence) fails.push(`row ${r.id}: missing confidence`)
    if (r.mechanism !== null && r.mechanism.trim() === '')
      fails.push(`row ${r.id}: empty (non-null) mechanism`)
  }

  // D-06: all three confidence levels appear somewhere in the full seed (global check).
  const { data: allConf, error: confErr } = await supabase
    .from('plant_relationships')
    .select('confidence')
    .returns<{ confidence: string }[]>()
  if (confErr) throw new Error(`Confidence query failed: ${confErr.message}`)
  const levels = new Set((allConf ?? []).map(r => r.confidence))
  for (const lvl of ['verified', 'traditional', 'anecdotal']) {
    if (!levels.has(lvl)) fails.push(`confidence level "${lvl}" never used in seed`)
  }

  if (fails.length) {
    console.error('VERIFICATION FAILED:')
    fails.forEach(f => console.error('  ✗ ' + f))
    process.exit(1)
  }
  console.log(`✓ ${rows.length} tomato relationships, all fields populated, D-06 coverage met.`)
}

main().catch(err => { console.error('\nFatal:', err); process.exit(1) })
