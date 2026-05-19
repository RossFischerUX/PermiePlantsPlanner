#!/usr/bin/env tsx
/**
 * De-duplicate the live `plants` table.
 *
 * DRY-RUN by default (no writes). Pass --apply to run the destructive path.
 * Pass --report-json <path> to additionally write the full computed plan as JSON.
 *
 * Species identity key: normalized latin_name (trim + collapse whitespace + lowercase).
 * Fallback to normalized common_name when latin_name is null/empty.
 *
 * Canonical row = highest enrichment score across 9 functional fields.
 * Tiebreak 1: oldest created_at. Tiebreak 2: lexicographically smallest id.
 *
 * FK safety: plant_list_items.plant_id → plants(id) has NO ON DELETE CASCADE.
 * References must be repointed (or deleted if list already has the canonical plant)
 * before any plant row deletion.
 *
 * Usage:
 *   npm run dedupe-plants
 *   npm run dedupe-plants -- --report-json /tmp/dedupe-plan.json
 *   npm run dedupe-plants -- --apply
 *
 * Requires in .env.local:
 *   SUPABASE_SECRET_KEY=... (or SUPABASE_SERVICE_ROLE_KEY=...)
 *   NEXT_PUBLIC_SUPABASE_URL=...
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as fs from 'fs'

dotenv.config({ path: '.env.local' })

// ─── Config ──────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL) throw new Error('NEXT_PUBLIC_SUPABASE_URL missing from .env.local')
if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) missing from .env.local')

const PAGE_SIZE = 1000

// ─── Client ───────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlantRow {
  id: string
  common_name: string
  latin_name: string | null
  created_at: string
  permaculture_uses: string[] | null
  succession_role: string[] | null
  establishment_difficulty: string | null
  maintenance_level: string | null
  propagation_methods: string[] | null
  edible_parts: string[] | null
  harvest_months: string[] | null
  years_to_bearing: number | null
  forest_garden_layer: string | null
}

interface JoinRow {
  id: string
  list_id: string
  plant_id: string
}

interface DupeGroupReference {
  joinRowId: string
  listId: string
  dupePlantId: string
}

interface DupeGroup {
  key: string
  canonicalId: string
  canonicalName: string
  dupeIds: string[]
  references: DupeGroupReference[]
}

interface ReportJson {
  generatedAt: string
  totalRows: number
  groups: DupeGroup[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeSpeciesKey(latinName: string | null, commonName: string): string {
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  const latin = latinName != null ? latinName.trim() : ''
  return latin.length > 0 ? normalize(latin) : normalize(commonName)
}

function enrichmentScore(row: PlantRow): number {
  let score = 0
  // Array fields: present if non-empty array
  if (Array.isArray(row.permaculture_uses) && row.permaculture_uses.length > 0) score++
  if (Array.isArray(row.succession_role) && row.succession_role.length > 0) score++
  if (Array.isArray(row.propagation_methods) && row.propagation_methods.length > 0) score++
  if (Array.isArray(row.edible_parts) && row.edible_parts.length > 0) score++
  if (Array.isArray(row.harvest_months) && row.harvest_months.length > 0) score++
  // Scalar fields: present if non-null and non-empty string
  if (row.establishment_difficulty != null && row.establishment_difficulty.trim() !== '') score++
  if (row.maintenance_level != null && row.maintenance_level.trim() !== '') score++
  if (row.years_to_bearing != null) score++
  if (row.forest_garden_layer != null && row.forest_garden_layer.trim() !== '') score++
  return score
}

function pickCanonical(rows: PlantRow[]): PlantRow {
  return rows.slice().sort((a, b) => {
    const scoreDiff = enrichmentScore(b) - enrichmentScore(a)
    if (scoreDiff !== 0) return scoreDiff
    // Tiebreak 1: oldest created_at (ascending)
    const dateA = new Date(a.created_at).getTime()
    const dateB = new Date(b.created_at).getTime()
    if (dateA !== dateB) return dateA - dateB
    // Tiebreak 2: lexicographically smallest id
    return a.id.localeCompare(b.id)
  })[0]
}

// ─── Fetch helpers ───────────────────────────────────────────────────────────

async function fetchAllPlants(): Promise<PlantRow[]> {
  const plants: PlantRow[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('plants')
      .select('id, common_name, latin_name, created_at, permaculture_uses, succession_role, establishment_difficulty, maintenance_level, propagation_methods, edible_parts, harvest_months, years_to_bearing, forest_garden_layer')
      .order('latin_name')
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (error) throw new Error(`Could not fetch plants: ${error.message}`)
    const rows = (data ?? []) as PlantRow[]
    plants.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return plants
}

async function fetchAllJoinRows(): Promise<JoinRow[]> {
  const items: JoinRow[] = []
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from('plant_list_items')
      .select('id, list_id, plant_id')
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
    if (error) throw new Error(`Could not fetch plant_list_items: ${error.message}`)
    const rows = (data ?? []) as JoinRow[]
    items.push(...rows)
    if (rows.length < PAGE_SIZE) break
  }
  return items
}

// ─── Core grouping logic ─────────────────────────────────────────────────────

function buildGroups(plants: PlantRow[], joinRows: JoinRow[]): {
  groups: DupeGroup[]
  totalRows: number
  singletonCount: number
} {
  const byKey = new Map<string, PlantRow[]>()
  for (const row of plants) {
    const key = normalizeSpeciesKey(row.latin_name, row.common_name)
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(row)
  }

  // Build a lookup: plant_id → join rows
  const joinByPlant = new Map<string, JoinRow[]>()
  for (const j of joinRows) {
    if (!joinByPlant.has(j.plant_id)) joinByPlant.set(j.plant_id, [])
    joinByPlant.get(j.plant_id)!.push(j)
  }

  const groups: DupeGroup[] = []
  let singletonCount = 0

  for (const [key, rows] of byKey) {
    if (rows.length < 2) {
      singletonCount++
      continue
    }
    const canonical = pickCanonical(rows)
    const dupeRows = rows.filter(r => r.id !== canonical.id)
    const references: DupeGroupReference[] = []
    for (const dupe of dupeRows) {
      const jrs = joinByPlant.get(dupe.id) ?? []
      for (const j of jrs) {
        references.push({ joinRowId: j.id, listId: j.list_id, dupePlantId: dupe.id })
      }
    }
    groups.push({
      key,
      canonicalId: canonical.id,
      canonicalName: `${canonical.common_name}${canonical.latin_name ? ` (${canonical.latin_name})` : ''}`,
      dupeIds: dupeRows.map(r => r.id),
      references,
    })
  }

  return { groups, totalRows: plants.length, singletonCount }
}

// ─── Dry-run report ──────────────────────────────────────────────────────────

async function dryRun(reportJsonPath: string | null) {
  console.log('Permaculture Plant Picker — De-dupe Plants (DRY-RUN)')
  console.log('=====================================================\n')

  const [plants, joinRows] = await Promise.all([fetchAllPlants(), fetchAllJoinRows()])
  const { groups, totalRows } = buildGroups(plants, joinRows)

  const totalDupeRows = groups.reduce((acc, g) => acc + g.dupeIds.length, 0)
  const referencedDupeRows = groups.reduce(
    (acc, g) => acc + new Set(g.references.map(r => r.dupePlantId)).size,
    0,
  )
  const totalJoinRowsAffected = groups.reduce((acc, g) => acc + g.references.length, 0)

  console.log(`Total plant rows        : ${totalRows}`)
  console.log(`Total species groups    : ${groups.length + (totalRows - totalDupeRows - groups.length)}`)
  console.log(`Duplicate group count   : ${groups.length}`)
  console.log(`Total dupe rows         : ${totalDupeRows}  (rows that would be deleted)`)
  console.log(`Dupe rows in user lists : ${referencedDupeRows}  (have plant_list_items refs)`)
  console.log(`Affected join rows      : ${totalJoinRowsAffected}  (refs that would be repointed or deleted)`)
  console.log('')

  const sample = groups.slice(0, 15)
  if (sample.length > 0) {
    console.log(`Sample duplicate groups (up to 15):`)
    console.log('─'.repeat(60))
    for (const g of sample) {
      console.log(`  Key      : ${g.key}`)
      console.log(`  Canonical: ${g.canonicalId}  ${g.canonicalName}`)
      console.log(`  Dupes    : ${g.dupeIds.join(', ')}`)
      if (g.references.length > 0) {
        console.log(`  Refs     : ${g.references.length} join row(s) referencing dupe(s)`)
        for (const r of g.references) {
          console.log(`    join_row=${r.joinRowId}  list=${r.listId}  dupe_plant=${r.dupePlantId}`)
        }
      } else {
        console.log(`  Refs     : none`)
      }
      console.log('')
    }
  } else {
    console.log('No duplicate groups found.')
  }

  if (reportJsonPath) {
    const report: ReportJson = {
      generatedAt: new Date().toISOString(),
      totalRows,
      groups,
    }
    fs.writeFileSync(reportJsonPath, JSON.stringify(report, null, 2))
    console.log(`Report JSON written to: ${reportJsonPath}`)
  }

  console.log('\nDRY-RUN complete. No writes made. Pass --apply to run the destructive path.')
}

// ─── Apply (destructive path) ────────────────────────────────────────────────

async function apply() {
  console.log('Permaculture Plant Picker — De-dupe Plants (--apply)')
  console.log('=====================================================\n')
  console.log('WARNING: This will permanently DELETE duplicate plant rows from production.\n')

  // Step 1: Fresh read — do not trust any stale plan file
  console.log('Step 1: Recomputing dedupe plan from live DB...')
  const [plants, joinRows] = await Promise.all([fetchAllPlants(), fetchAllJoinRows()])
  const { groups, totalRows } = buildGroups(plants, joinRows)

  if (groups.length === 0) {
    console.log(`Total plant rows : ${totalRows}`)
    console.log('\nNo duplicate groups found — nothing to do. (Already clean or already applied.)')
    return
  }

  console.log(`Total plant rows        : ${totalRows}`)
  console.log(`Duplicate groups        : ${groups.length}`)
  const totalDupeRows = groups.reduce((acc, g) => acc + g.dupeIds.length, 0)
  const totalRefRows = groups.reduce((acc, g) => acc + g.references.length, 0)
  console.log(`Duplicate rows to delete: ${totalDupeRows}`)
  console.log(`Join rows to process    : ${totalRefRows}`)
  console.log('')

  // Build an in-memory set of (list_id, plant_id) pairs for fast canonical-presence checks.
  // We'll update this set as we repoint rows, so subsequent groups see current state.
  const listPlantSet = new Set<string>(joinRows.map(j => `${j.list_id}:${j.plant_id}`))

  let refsRepointed = 0
  let refsDeletedRedundant = 0
  let plantRowsDeleted = 0
  let groupErrors = 0

  // Step 2: Process each group — repoint/delete join rows FIRST, then delete dupe plants
  for (let gi = 0; gi < groups.length; gi++) {
    const group = groups[gi]
    let groupOk = true

    // Process each dupe plant's join rows
    for (const dupeId of group.dupeIds) {
      const dupeRefs = group.references.filter(r => r.dupePlantId === dupeId)
      for (const ref of dupeRefs) {
        const canonicalKey = `${ref.listId}:${group.canonicalId}`
        if (listPlantSet.has(canonicalKey)) {
          // The canonical plant is already in this list — DELETE the redundant join row
          const { error } = await supabase
            .from('plant_list_items')
            .delete()
            .eq('id', ref.joinRowId)
          if (error) {
            console.error(`  ERROR deleting redundant join row ${ref.joinRowId}: ${error.message}`)
            groupOk = false
          } else {
            // Remove the dupe-key from the set (no longer exists)
            listPlantSet.delete(`${ref.listId}:${dupeId}`)
            refsDeletedRedundant++
          }
        } else {
          // Repoint: UPDATE plant_id from dupe to canonical
          const { error } = await supabase
            .from('plant_list_items')
            .update({ plant_id: group.canonicalId })
            .eq('id', ref.joinRowId)
          if (error) {
            console.error(`  ERROR repointing join row ${ref.joinRowId}: ${error.message}`)
            groupOk = false
          } else {
            // Update in-memory set: remove old dupe-key, add canonical-key
            listPlantSet.delete(`${ref.listId}:${dupeId}`)
            listPlantSet.add(canonicalKey)
            refsRepointed++
          }
        }
      }
    }

    if (!groupOk) {
      console.error(`  Skipping plant deletion for group "${group.key}" due to join-row errors (FK safety).`)
      groupErrors++
      continue
    }

    // Step 3: All references cleared for this group — now safe to DELETE dupe plant rows
    const { error } = await supabase
      .from('plants')
      .delete()
      .in('id', group.dupeIds)
    if (error) {
      console.error(`  ERROR deleting dupe plants for group "${group.key}": ${error.message}`)
      groupErrors++
    } else {
      plantRowsDeleted += group.dupeIds.length
    }

    if ((gi + 1) % 25 === 0 || gi === groups.length - 1) {
      console.log(`  Processed ${gi + 1}/${groups.length} groups...`)
    }
  }

  console.log('\nApply complete.\n')

  // Step 4: Post-apply verification — fresh read, expect 0 dupe groups
  console.log('Step 4: Post-apply verification (fresh read)...')
  const [plantsAfter] = await Promise.all([fetchAllPlants(), fetchAllJoinRows()])
  const { groups: groupsAfter, totalRows: totalRowsAfter } = buildGroups(plantsAfter, [])
  const dupeGroupsRemaining = groupsAfter.length

  console.log('\n══════════════════════════════════════════')
  console.log('  FINAL SUMMARY')
  console.log('══════════════════════════════════════════')
  console.log(`  Plant rows before        : ${totalRows}`)
  console.log(`  Plant rows after         : ${totalRowsAfter}`)
  console.log(`  Plant rows deleted       : ${plantRowsDeleted}`)
  console.log(`  References repointed     : ${refsRepointed}`)
  console.log(`  Redundant join rows del  : ${refsDeletedRedundant}`)
  console.log(`  Groups with errors       : ${groupErrors}`)
  console.log(`  Duplicate groups remaining: ${dupeGroupsRemaining}`)
  console.log('══════════════════════════════════════════\n')

  if (dupeGroupsRemaining > 0) {
    console.error(`FAIL: ${dupeGroupsRemaining} duplicate group(s) remain after apply!`)
    process.exit(1)
  } else {
    console.log('PASS: Zero duplicate groups remain. Catalog is clean.')
  }
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const isApply = args.includes('--apply')
const reportJsonIndex = args.indexOf('--report-json')
const reportJsonPath = reportJsonIndex !== -1 ? (args[reportJsonIndex + 1] ?? null) : null

if (isApply) {
  apply().catch(err => { console.error('\nFatal error:', err); process.exit(1) })
} else {
  dryRun(reportJsonPath).catch(err => { console.error('\nFatal error:', err); process.exit(1) })
}
