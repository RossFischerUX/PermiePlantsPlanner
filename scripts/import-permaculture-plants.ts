#!/usr/bin/env tsx
/**
 * Permaculture plant import script
 *
 * Sources:
 *   - Curated list from permies.com "Permaculture Plants Super List" + Edible Forest Gardens Vol. 2
 *   - iNaturalist API  → photo URL (CC-licensed)
 *   - Claude claude-haiku → horticultural + permaculture fields
 *
 * For plants already in the DB (matched by latin_name), only the permaculture
 * fields (forest_garden_layer, permaculture_uses) are updated so existing
 * horticultural data isn't overwritten. New plants get the full treatment.
 *
 * Usage:
 *   npm run import-permaculture
 *
 * Requires in .env.local:
 *   SUPABASE_SECRET_KEY=... (or SUPABASE_SERVICE_ROLE_KEY=...)
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

const CLAUDE_BATCH_SIZE = 5
const CLAUDE_BATCH_DELAY_MS = 20000
const INAT_DELAY_MS = 300  // lower than bulk import — small targeted list

// ─── Curated plant list ───────────────────────────────────────────────────────
// Sources: permies.com/t/46850 + Edible Forest Gardens Vol. 2 (Jacke & Toensmeier)

const PERMACULTURE_PLANTS: { commonName: string; latinName: string }[] = [
  // ── Canopy trees ───────────────────────────────────────────────────────────
  { commonName: 'English Walnut',        latinName: 'Juglans regia' },
  { commonName: 'Black Walnut',          latinName: 'Juglans nigra' },
  { commonName: 'Chinese Chestnut',      latinName: 'Castanea mollissima' },
  { commonName: 'Pecan',                 latinName: 'Carya illinoinensis' },
  { commonName: 'Shagbark Hickory',      latinName: 'Carya ovata' },
  { commonName: 'Black Locust',          latinName: 'Robinia pseudoacacia' },
  { commonName: 'Honey Locust',          latinName: 'Gleditsia triacanthos' },
  { commonName: 'European Alder',        latinName: 'Alnus glutinosa' },
  { commonName: 'Red Alder',             latinName: 'Alnus rubra' },
  { commonName: 'Silk Tree',             latinName: 'Albizia julibrissin' },
  { commonName: 'Ginkgo',               latinName: 'Ginkgo biloba' },
  { commonName: 'Littleleaf Linden',     latinName: 'Tilia cordata' },
  { commonName: 'American Basswood',     latinName: 'Tilia americana' },
  { commonName: 'Red Mulberry',          latinName: 'Morus rubra' },
  { commonName: 'White Mulberry',        latinName: 'Morus alba' },
  { commonName: 'American Persimmon',    latinName: 'Diospyros virginiana' },
  { commonName: 'Eastern Cottonwood',    latinName: 'Populus deltoides' },
  { commonName: 'Carob',                 latinName: 'Ceratonia siliqua' },
  { commonName: 'Sweet Cherry',          latinName: 'Prunus avium' },

  // ── Sub-canopy / small trees ───────────────────────────────────────────────
  { commonName: 'Pawpaw',               latinName: 'Asimina triloba' },
  { commonName: 'Serviceberry',          latinName: 'Amelanchier canadensis' },
  { commonName: 'Cornelian Cherry',      latinName: 'Cornus mas' },
  { commonName: 'Quince',               latinName: 'Cydonia oblonga' },
  { commonName: 'Japanese Persimmon',    latinName: 'Diospyros kaki' },
  { commonName: 'Autumn Olive',          latinName: 'Elaeagnus umbellata' },
  { commonName: 'Russian Olive',         latinName: 'Elaeagnus angustifolia' },
  { commonName: 'Sea Buckthorn',         latinName: 'Hippophae rhamnoides' },
  { commonName: 'Black Elderberry',      latinName: 'Sambucus nigra' },
  { commonName: 'American Elderberry',   latinName: 'Sambucus canadensis' },
  { commonName: 'Common Hawthorn',       latinName: 'Crataegus monogyna' },
  { commonName: 'Blackthorn',            latinName: 'Prunus spinosa' },
  { commonName: 'Chickasaw Plum',        latinName: 'Prunus angustifolia' },
  { commonName: 'Neem',                  latinName: 'Azadirachta indica' },
  { commonName: 'Moringa',              latinName: 'Moringa oleifera' },

  // ── Shrubs ─────────────────────────────────────────────────────────────────
  { commonName: 'Siberian Pea Shrub',    latinName: 'Caragana arborescens' },
  { commonName: 'Black Currant',         latinName: 'Ribes nigrum' },
  { commonName: 'Red Currant',           latinName: 'Ribes rubrum' },
  { commonName: 'Gooseberry',            latinName: 'Ribes uva-crispa' },
  { commonName: 'Rugosa Rose',           latinName: 'Rosa rugosa' },
  { commonName: 'Dog Rose',              latinName: 'Rosa canina' },
  { commonName: 'Raspberry',             latinName: 'Rubus idaeus' },
  { commonName: 'Blackberry',            latinName: 'Rubus fruticosus' },
  { commonName: 'Highbush Blueberry',    latinName: 'Vaccinium corymbosum' },
  { commonName: 'Bilberry',              latinName: 'Vaccinium myrtillus' },
  { commonName: 'Black Chokeberry',      latinName: 'Aronia melanocarpa' },
  { commonName: 'Oregon Grape',          latinName: 'Mahonia aquifolium' },
  { commonName: 'Japanese Quince',       latinName: 'Chaenomeles japonica' },
  { commonName: 'Northern Bayberry',     latinName: 'Myrica pensylvanica' },
  { commonName: 'Goji Berry',            latinName: 'Lycium barbarum' },
  { commonName: 'Common Gorse',          latinName: 'Ulex europaeus' },
  { commonName: 'Bearberry',             latinName: 'Arctostaphylos uva-ursi' },
  { commonName: 'Flowering Dogwood',     latinName: 'Cornus florida' },

  // ── Climbers / vines ───────────────────────────────────────────────────────
  { commonName: 'Hops',                  latinName: 'Humulus lupulus' },
  { commonName: 'Grape',                 latinName: 'Vitis vinifera' },
  { commonName: 'Fox Grape',             latinName: 'Vitis labrusca' },
  { commonName: 'Chocolate Vine',        latinName: 'Akebia quinata' },
  { commonName: 'Five Flavor Berry',     latinName: 'Schisandra chinensis' },
  { commonName: 'Chinese Wisteria',      latinName: 'Wisteria sinensis' },
  { commonName: 'American Wisteria',     latinName: 'Wisteria frutescens' },

  // ── Herbaceous perennials ──────────────────────────────────────────────────
  { commonName: 'Comfrey',              latinName: 'Symphytum officinale' },
  { commonName: 'Stinging Nettle',       latinName: 'Urtica dioica' },
  { commonName: 'Garden Sorrel',         latinName: 'Rumex acetosa' },
  { commonName: 'Asparagus',            latinName: 'Asparagus officinalis' },
  { commonName: 'Daylily',              latinName: 'Hemerocallis fulva' },
  { commonName: 'Wild Garlic',           latinName: 'Allium ursinum' },
  { commonName: 'Garlic Chives',         latinName: 'Allium tuberosum' },
  { commonName: 'Chives',               latinName: 'Allium schoenoprasum' },
  { commonName: 'Fennel',               latinName: 'Foeniculum vulgare' },
  { commonName: 'Lovage',               latinName: 'Levisticum officinale' },
  { commonName: 'Sweet Cicely',          latinName: 'Myrrhis odorata' },
  { commonName: 'Yarrow',               latinName: 'Achillea millefolium' },
  { commonName: 'Elecampane',            latinName: 'Inula helenium' },
  { commonName: 'Valerian',             latinName: 'Valeriana officinalis' },
  { commonName: 'Burdock',              latinName: 'Arctium lappa' },
  { commonName: 'Jerusalem Artichoke',   latinName: 'Helianthus tuberosus' },
  { commonName: 'Pokeweed',             latinName: 'Phytolacca americana' },
  { commonName: 'Bee Balm',             latinName: 'Monarda didyma' },
  { commonName: 'Chicory',              latinName: 'Cichorium intybus' },
  { commonName: 'Scorzonera',            latinName: 'Scorzonera hispanica' },
  { commonName: 'Skirret',              latinName: 'Sium sisarum' },
  { commonName: 'Groundnut',            latinName: 'Apios americana' },
  { commonName: 'Camas',               latinName: 'Camassia quamash' },
  { commonName: 'Chinese Yam',          latinName: 'Dioscorea polystachya' },
  { commonName: 'Wild Yam',             latinName: 'Dioscorea villosa' },
  { commonName: 'Ashitaba',             latinName: 'Angelica keiskei' },
  { commonName: 'Angelica',             latinName: 'Angelica archangelica' },
  { commonName: 'Black Cohosh',          latinName: 'Actaea racemosa' },
  { commonName: 'Mullein',              latinName: 'Verbascum thapsus' },
  { commonName: 'Broadleaf Plantain',    latinName: 'Plantago major' },
  { commonName: 'Dandelion',            latinName: 'Taraxacum officinale' },
  { commonName: 'Field Horsetail',       latinName: 'Equisetum arvense' },
  { commonName: 'Common Cattail',        latinName: 'Typha latifolia' },
  { commonName: 'Rhubarb',              latinName: 'Rheum rhabarbarum' },
  { commonName: 'Sea Kale',             latinName: 'Crambe maritima' },
  { commonName: 'Peppermint',            latinName: 'Mentha x piperita' },
  { commonName: 'Holy Basil',            latinName: 'Ocimum tenuiflorum' },
  { commonName: 'Aloe Vera',             latinName: 'Aloe vera' },
  { commonName: 'Lemongrass',            latinName: 'Cymbopogon citratus' },
  { commonName: 'Society Garlic',        latinName: 'Tulbaghia violacea' },
  { commonName: 'Miner\'s Lettuce',      latinName: 'Claytonia perfoliata' },
  { commonName: 'Good King Henry',       latinName: 'Chenopodium bonus-henricus' },
  { commonName: 'Lamb\'s Quarters',      latinName: 'Chenopodium album' },

  // ── Ground covers ──────────────────────────────────────────────────────────
  { commonName: 'Wild Strawberry',       latinName: 'Fragaria vesca' },
  { commonName: 'White Clover',          latinName: 'Trifolium repens' },
  { commonName: 'Red Clover',            latinName: 'Trifolium pratense' },
  { commonName: 'Alfalfa',              latinName: 'Medicago sativa' },
  { commonName: 'Ajuga',               latinName: 'Ajuga reptans' },
  { commonName: 'Sweet Violet',          latinName: 'Viola odorata' },
  { commonName: 'Hog Peanut',            latinName: 'Amphicarpaea bracteata' },

  // ── Annuals commonly used in permaculture ──────────────────────────────────
  { commonName: 'German Chamomile',      latinName: 'Matricaria chamomilla' },
  { commonName: 'Buckwheat',            latinName: 'Fagopyrum esculentum' },
  { commonName: 'Cowpea',              latinName: 'Vigna unguiculata' },
  { commonName: 'Pigeon Pea',            latinName: 'Cajanus cajan' },
  { commonName: 'Tufted Vetch',          latinName: 'Vicia cracca' },
  { commonName: 'Lupine',              latinName: 'Lupinus perennis' },
]

// ─── Types ───────────────────────────────────────────────────────────────────

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
  forest_garden_layer: string | null
  permaculture_uses: string[] | null
}

// ─── Clients ─────────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

const VALID_SUN = ['full sun', 'part shade', 'full shade'] as const
const VALID_WATER = ['low', 'moderate', 'high'] as const
const VALID_TYPE = ['shrub', 'tree', 'perennial', 'groundcover', 'vine', 'grass'] as const
const VALID_LAYER = ['canopy', 'sub-canopy', 'shrub', 'herb', 'ground cover', 'rhizosphere', 'climber'] as const

function normalizeEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== 'string') return null
  return allowed.find(a => a.toLowerCase() === value.toLowerCase()) ?? null
}

async function fetchInatPhoto(latinName: string): Promise<string | null> {
  try {
    const url = new URL('https://api.inaturalist.org/v1/taxa')
    url.searchParams.set('q', latinName)
    url.searchParams.set('rank', 'species')
    url.searchParams.set('locale', 'en')
    url.searchParams.set('per_page', '1')
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'PlantMasterDB/1.0 (educational project; rossfischer)' },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.results?.[0]?.default_photo?.medium_url ?? null
  } catch {
    return null
  }
}

async function enrichWithClaude(commonName: string, latinName: string): Promise<HorticulturalData | null> {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      messages: [{
        role: 'user',
        content: `You are a permaculture and horticultural database. For the plant "${commonName}" (${latinName}), return data as a single JSON object. Use null for any field you are not confident about. Only return valid JSON — no explanation.

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
  "bloom_months": ["January",...] | null,
  "season_of_interest": ["Spring","Summer","Fall","Winter"] subset | null,
  "soil": short string e.g. "Well-drained" or "Moist, fertile" | null,
  "description": "1–2 sentence plain-English description for a home gardener or permaculturist" | null,
  "native_range": short string e.g. "Eastern North America" or "Mediterranean" | null,
  "usda_zones": string e.g. "4–9" | null,
  "forest_garden_layer": "canopy" | "sub-canopy" | "shrub" | "herb" | "ground cover" | "rhizosphere" | "climber" | null,
  "permaculture_uses": array from ["nitrogen fixer","dynamic accumulator","edible","medicinal","pollinator","biomass","ground cover","windbreak","wildlife habitat","fiber","pioneer","insectary"] | null
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('PlantMaster — Permaculture Plant Import')
  console.log('========================================\n')

  if (!SERVICE_ROLE_KEY) throw new Error('SUPABASE_SECRET_KEY missing from .env.local')
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing from .env.local')

  // Load existing plants so we can decide insert vs. update
  const { data: existing, error: dbErr } = await supabase
    .from('plants')
    .select('id, latin_name, image_url')
  if (dbErr) throw new Error(`DB error: ${dbErr.message}`)

  const existingByLatinName = new Map(
    (existing ?? []).map(p => [p.latin_name as string, p as { id: string; image_url: string | null }])
  )
  console.log(`Existing plants in DB: ${existingByLatinName.size}`)
  console.log(`Permaculture plants to process: ${PERMACULTURE_PLANTS.length}\n`)

  let inserted = 0, updated = 0, skipped = 0, failed = 0

  for (let i = 0; i < PERMACULTURE_PLANTS.length; i += CLAUDE_BATCH_SIZE) {
    const batch = PERMACULTURE_PLANTS.slice(i, i + CLAUDE_BATCH_SIZE)

    await Promise.all(batch.map(async ({ commonName, latinName }) => {
      const hort = await enrichWithClaude(commonName, latinName)

      if (!hort || (!hort.description && !hort.sun && !hort.water)) {
        console.warn(`  ⚠ Skipping ${latinName} (insufficient data)`)
        skipped++
        return
      }

      const existing = existingByLatinName.get(latinName)

      if (existing) {
        // Plant already in DB — patch only the permaculture fields
        const { error } = await supabase
          .from('plants')
          .update({
            forest_garden_layer: normalizeEnum(hort.forest_garden_layer, VALID_LAYER),
            permaculture_uses: hort.permaculture_uses ?? null,
          })
          .eq('id', existing.id)

        if (error) {
          console.error(`  ✗ Update failed for ${latinName}: ${error.message}`)
          failed++
        } else {
          console.log(`  ↻ Updated  ${commonName}`)
          updated++
        }
      } else {
        // New plant — fetch photo from iNaturalist and do full insert
        await sleep(INAT_DELAY_MS)
        const imageUrl = await fetchInatPhoto(latinName)

        const { error } = await supabase.from('plants').insert({
          common_name: commonName,
          latin_name: latinName,
          image_url: imageUrl,
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
          forest_garden_layer: normalizeEnum(hort.forest_garden_layer, VALID_LAYER),
          permaculture_uses: hort.permaculture_uses ?? null,
        })

        if (error) {
          console.error(`  ✗ Insert failed for ${latinName}: ${error.message}`)
          failed++
        } else {
          console.log(`  ✓ Inserted ${commonName}`)
          inserted++
        }
      }
    }))

    const processed = Math.min(i + CLAUDE_BATCH_SIZE, PERMACULTURE_PLANTS.length)
    console.log(`  [${processed}/${PERMACULTURE_PLANTS.length}] inserted ${inserted} · updated ${updated} · skipped ${skipped} · failed ${failed}\n`)

    if (processed < PERMACULTURE_PLANTS.length) await sleep(CLAUDE_BATCH_DELAY_MS)
  }

  console.log(`\n✓ Done.`)
  console.log(`  Inserted : ${inserted}  (new plants)`)
  console.log(`  Updated  : ${updated}  (permaculture fields added to existing plants)`)
  console.log(`  Skipped  : ${skipped}  (insufficient data)`)
  console.log(`  Failed   : ${failed}   (DB errors)`)
}

main().catch(err => { console.error('\nFatal error:', err); process.exit(1) })
