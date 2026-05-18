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

const PERMACULTURE_PLANTS: { commonName: string; latinName: string; cultivarHint?: string; isInvasive?: boolean }[] = [
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

  // ── Edible perennials ──────────────────────────────────────────────────────
  { commonName: 'Lovage',                latinName: 'Levisticum officinale' },
  { commonName: 'Skirret',               latinName: 'Sium sisarum' },
  { commonName: 'Turkish Rocket',        latinName: 'Bunias orientalis' },
  { commonName: 'Scorzonera',            latinName: 'Scorzonera hispanica' },
  { commonName: 'Cardoon',               latinName: 'Cynara cardunculus' },
  { commonName: 'Ostrich Fern',          latinName: 'Matteuccia struthiopteris' },
  { commonName: 'Ramps',                 latinName: 'Allium tricoccum' },
  { commonName: 'Groundnut',             latinName: 'Apios americana' },
  { commonName: 'Groundplum Milkvetch',  latinName: 'Astragalus crassicarpus' },
  { commonName: 'Jerusalem Artichoke',   latinName: 'Helianthus tuberosus' },
  { commonName: 'Chinese Artichoke',     latinName: 'Stachys affinis' },
  { commonName: 'Oca',                   latinName: 'Oxalis tuberosa' },
  { commonName: 'Mashua',               latinName: 'Tropaeolum tuberosum' },
  { commonName: 'Yacon',                 latinName: 'Smallanthus sonchifolius' },
  { commonName: 'American Groundnut',    latinName: 'Apios americana' },
  { commonName: 'Elephant Garlic',       latinName: 'Allium ampeloprasum' },
  { commonName: 'Bunching Onion',        latinName: 'Allium fistulosum' },
  { commonName: 'Welsh Onion',           latinName: 'Allium fistulosum' },
  { commonName: 'Tree Onion',            latinName: 'Allium proliferum' },
  { commonName: 'Bronze Fennel',         latinName: 'Foeniculum vulgare' },

  // ── Medicinal herbs ────────────────────────────────────────────────────────
  { commonName: 'Valerian',              latinName: 'Valeriana officinalis' },
  { commonName: 'Skullcap',              latinName: 'Scutellaria lateriflora' },
  { commonName: 'Motherwort',            latinName: 'Leonurus cardiaca' },
  { commonName: 'Ashwagandha',           latinName: 'Withania somnifera' },
  { commonName: 'Astragalus',            latinName: 'Astragalus membranaceus' },
  { commonName: 'Lemon Balm',            latinName: 'Melissa officinalis' },
  { commonName: 'Feverfew',              latinName: 'Tanacetum parthenium' },
  { commonName: 'Echinacea',             latinName: 'Echinacea purpurea' },
  { commonName: 'Purple Coneflower',     latinName: 'Echinacea angustifolia' },
  { commonName: 'Marshmallow',           latinName: 'Althaea officinalis' },
  { commonName: 'Elecampane',            latinName: 'Inula helenium' },
  { commonName: 'Boneset',               latinName: 'Eupatorium perfoliatum' },
  { commonName: 'Blue Vervain',          latinName: 'Verbena hastata' },
  { commonName: 'Passionflower',         latinName: 'Passiflora incarnata' },
  { commonName: 'California Poppy',      latinName: 'Eschscholzia californica' },
  { commonName: 'Milk Thistle',          latinName: 'Silybum marianum' },
  { commonName: 'Meadowsweet',           latinName: 'Filipendula ulmaria' },
  { commonName: 'Wood Betony',           latinName: 'Stachys betonica' },
  { commonName: 'Wormwood',              latinName: 'Artemisia absinthium' },
  { commonName: 'Sweet Annie',           latinName: 'Artemisia annua' },

  // ── Nitrogen fixers & food forest support ──────────────────────────────────
  { commonName: 'Goumi Berry',           latinName: 'Elaeagnus multiflora' },
  { commonName: 'Autumn Olive',          latinName: 'Elaeagnus umbellata' },
  { commonName: 'Siberian Pea Shrub',    latinName: 'Caragana arborescens' },
  { commonName: 'Tagasaste',             latinName: 'Chamaecytisus proliferus' },
  { commonName: 'Sea Buckthorn',         latinName: 'Hippophae rhamnoides' },
  { commonName: 'Wild Indigo',           latinName: 'Baptisia australis' },
  { commonName: 'Lead Plant',            latinName: 'Amorpha canescens' },
  { commonName: 'New Jersey Tea',        latinName: 'Ceanothus americanus' },
  { commonName: 'Indigofera',            latinName: 'Indigofera heterantha' },
  { commonName: 'Sweet Fern',            latinName: 'Comptonia peregrina' },
  { commonName: 'Bayberry',              latinName: 'Myrica pensylvanica' },
  { commonName: 'Pacific Wax Myrtle',    latinName: 'Morella californica' },
  { commonName: 'Mesquite',              latinName: 'Prosopis glandulosa' },

  // ── Canopy fruit & nut trees ───────────────────────────────────────────────
  { commonName: 'Pawpaw',                latinName: 'Asimina triloba' },
  { commonName: 'Cornelian Cherry',      latinName: 'Cornus mas' },
  { commonName: 'Jujube',               latinName: 'Ziziphus jujuba' },
  { commonName: 'Hardy Kiwi',            latinName: 'Actinidia arguta' },
  { commonName: 'Mayhaw',               latinName: 'Crataegus aestivalis' },
  { commonName: 'Black Haw',             latinName: 'Viburnum prunifolium' },
  { commonName: 'Nanking Cherry',        latinName: 'Prunus tomentosa' },
  { commonName: 'Sand Cherry',           latinName: 'Prunus pumila' },
  { commonName: 'American Plum',         latinName: 'Prunus americana' },
  { commonName: 'Chokecherry',           latinName: 'Prunus virginiana' },
  { commonName: 'Serviceberry',          latinName: 'Amelanchier canadensis' },
  { commonName: 'Chinese Quince',        latinName: 'Pseudocydonia sinensis' },
  { commonName: 'Medlar',               latinName: 'Mespilus germanica' },
  { commonName: 'Loquat',               latinName: 'Eriobotrya japonica' },
  { commonName: 'Feijoa',               latinName: 'Acca sellowiana' },
  { commonName: 'Pomegranate',           latinName: 'Punica granatum' },
  { commonName: 'Olive',                latinName: 'Olea europaea' },

  // ── Shrubs ─────────────────────────────────────────────────────────────────
  { commonName: 'Black Currant',         latinName: 'Ribes nigrum' },
  { commonName: 'Red Currant',           latinName: 'Ribes rubrum' },
  { commonName: 'White Currant',         latinName: 'Ribes sativum' },
  { commonName: 'Jostaberry',            latinName: 'Ribes nidigrolaria' },
  { commonName: 'Aronia',               latinName: 'Aronia melanocarpa' },
  { commonName: 'Highbush Cranberry',    latinName: 'Viburnum trilobum' },
  { commonName: 'American Beautyberry',  latinName: 'Callicarpa americana' },
  { commonName: 'Wolfberry',             latinName: 'Lycium barbarum' },
  { commonName: 'Oregon Grape',          latinName: 'Mahonia aquifolium' },
  { commonName: 'American Cranberry',    latinName: 'Vaccinium macrocarpon' },

  // ── Climbers ───────────────────────────────────────────────────────────────
  { commonName: 'American Groundnut Vine', latinName: 'Apios priceana' },
  { commonName: 'Wild Grape',            latinName: 'Vitis riparia' },
  { commonName: 'Maypop',               latinName: 'Passiflora incarnata' },
  { commonName: 'Wild Yam',              latinName: 'Dioscorea villosa' },
  { commonName: 'Chinese Yam',           latinName: 'Dioscorea polystachya' },

  // ── Herbs & ground layer ───────────────────────────────────────────────────
  { commonName: 'Sweet Cicely',          latinName: 'Myrrhis odorata' },
  { commonName: 'Wild Ginger',           latinName: 'Asarum canadense' },
  { commonName: 'Wood Sorrel',           latinName: 'Oxalis acetosella' },
  { commonName: 'Creeping Thyme',        latinName: 'Thymus serpyllum' },
  { commonName: 'Oregano',               latinName: 'Origanum vulgare' },
  { commonName: 'Winter Savory',         latinName: 'Satureja montana' },
  { commonName: 'Chives',               latinName: 'Allium schoenoprasum' },
  { commonName: 'Garlic Chives',         latinName: 'Allium tuberosum' },
  { commonName: 'French Tarragon',       latinName: 'Artemisia dracunculus' },
  { commonName: 'Salad Burnet',          latinName: 'Sanguisorba minor' },
  { commonName: 'Sorrel',               latinName: 'Rumex acetosa' },
  { commonName: 'Perennial Arugula',     latinName: 'Diplotaxis tenuifolia' },
  { commonName: 'Watercress',            latinName: 'Nasturtium officinale' },
  { commonName: 'Malabar Spinach',       latinName: 'Basella alba' },
  { commonName: 'Moringa',               latinName: 'Moringa oleifera' },
  { commonName: 'Pipicha',               latinName: 'Porophyllum ruderale' },

  // ── Nut trees (missing from earlier passes) ────────────────────────────────
  { commonName: 'Common Hazelnut',       latinName: 'Corylus avellana' },
  { commonName: 'American Hazelnut',     latinName: 'Corylus americana' },
  { commonName: 'Almond',               latinName: 'Prunus dulcis' },
  { commonName: 'Pistachio',            latinName: 'Pistacia vera' },
  { commonName: 'Stone Pine',           latinName: 'Pinus pinea' },
  { commonName: 'Sugar Maple',          latinName: 'Acer saccharum' },

  // ── Tropical & subtropical fruit trees ────────────────────────────────────
  { commonName: 'Mango',               latinName: 'Mangifera indica' },
  { commonName: 'Macadamia',           latinName: 'Macadamia integrifolia' },
  { commonName: 'Lychee',              latinName: 'Litchi chinensis' },
  { commonName: 'Custard Apple',       latinName: 'Annona squamosa' },
  { commonName: 'Cherimoya',           latinName: 'Annona cherimola' },
  { commonName: 'Ice Cream Bean',      latinName: 'Inga edulis' },
  { commonName: 'Date Palm',           latinName: 'Phoenix dactylifera' },
  { commonName: 'Curry Leaf',          latinName: 'Murraya koenigii' },
  { commonName: 'Wampee',              latinName: 'Clausena lansium' },
  { commonName: 'Natal Cherry',        latinName: 'Eugenia uniflora' },
  { commonName: 'Nashi Pear',          latinName: 'Pyrus pyrifolia' },

  // ── Beverage & stimulant shrubs ────────────────────────────────────────────
  { commonName: 'Tea',                 latinName: 'Camellia sinensis' },
  { commonName: 'Coffee',              latinName: 'Coffea arabica' },

  // ── Culinary & medicinal herbs (missing) ──────────────────────────────────
  { commonName: 'Bay Laurel',          latinName: 'Laurus nobilis' },
  { commonName: 'Common Thyme',        latinName: 'Thymus vulgaris' },
  { commonName: 'Horseradish',         latinName: 'Armoracia rusticana' },
  { commonName: 'Ginger',             latinName: 'Zingiber officinale' },
  { commonName: 'Turmeric',           latinName: 'Curcuma longa' },
  { commonName: 'Cardamom',           latinName: 'Elettaria cardamomum' },
  { commonName: 'Star Anise',         latinName: 'Illicium verum' },
  { commonName: 'Stevia',             latinName: 'Stevia rebaudiana' },
  { commonName: 'Mitsuba',            latinName: 'Cryptotaenia japonica' },
  { commonName: 'Pandan',             latinName: 'Pandanus amaryllifolius' },

  // ── Aquatic & wetland edibles ──────────────────────────────────────────────
  { commonName: 'Sacred Lotus',        latinName: 'Nelumbo nucifera' },
  { commonName: 'Wild Rice',           latinName: 'Zizania aquatica' },
  { commonName: 'Chufa',              latinName: 'Cyperus esculentus' },
  { commonName: 'Wasabi',             latinName: 'Eutrema japonicum' },
  { commonName: 'Water Chestnut',      latinName: 'Eleocharis dulcis' },
  { commonName: 'Sea Asparagus',       latinName: 'Salicornia europaea' },

  // ── Root & tuber crops ─────────────────────────────────────────────────────
  { commonName: 'Taro',               latinName: 'Colocasia esculenta' },
  { commonName: 'Cassava',            latinName: 'Manihot esculenta' },
  { commonName: 'Arrowroot',          latinName: 'Canna edulis' },
  { commonName: 'Sweet Potato',       latinName: 'Ipomoea batatas' },

  // ── Vines (edible) ─────────────────────────────────────────────────────────
  { commonName: 'Chayote',            latinName: 'Sechium edule' },
  { commonName: 'Vanilla',            latinName: 'Vanilla planifolia' },
  { commonName: 'Jicama',             latinName: 'Pachyrhizus erosus' },

  // ── Pioneer legumes & nitrogen fixers ─────────────────────────────────────
  { commonName: 'Leucaena',           latinName: 'Leucaena leucocephala' },
  { commonName: 'Calliandra',         latinName: 'Calliandra calothyrsus' },
  { commonName: 'Agati',              latinName: 'Sesbania grandiflora' },
  { commonName: 'Pinto Peanut',       latinName: 'Arachis pintoi' },
  { commonName: 'Desmodium',          latinName: 'Desmodium intortum' },

  // ── Ground covers & edible spreaders ──────────────────────────────────────
  { commonName: 'New Zealand Spinach', latinName: 'Tetragonia tetragonioides' },

  // ── Hort 12: Conifers ──────────────────────────────────────────────────────
  { commonName: 'Incense Cedar',           latinName: 'Calocedrus decurrens' },
  { commonName: 'Japanese Cryptomeria',    latinName: 'Cryptomeria japonica' },
  { commonName: 'Italian Cypress',         latinName: 'Cupressus sempervirens' },
  { commonName: 'Chinese Juniper',         latinName: 'Juniperus chinensis', cultivarHint: 'Torulosa (Hollywood Juniper) has twisted, irregular form; Kaizuka is similar' },
  { commonName: 'Creeping Juniper',        latinName: 'Juniperus horizontalis', cultivarHint: 'Blue Rug and Wiltonii are low mat-forming ground cover cultivars' },
  { commonName: 'Pfitzer Juniper',         latinName: 'Juniperus x pfitzeriana' },
  { commonName: 'Colorado Blue Spruce',    latinName: 'Picea pungens' },
  { commonName: 'Canary Island Pine',      latinName: 'Pinus canariensis' },
  { commonName: 'Mugo Pine',               latinName: 'Pinus mugo' },
  { commonName: 'Ponderosa Pine',          latinName: 'Pinus ponderosa' },
  { commonName: 'Monterey Pine',           latinName: 'Pinus radiata' },

  // ── Hort 12: Specimen / Large Trees ───────────────────────────────────────
  { commonName: 'Monkey Puzzle Tree',      latinName: 'Araucaria araucana' },
  { commonName: 'Bunya Bunya',             latinName: 'Araucaria bidwillii' },
  { commonName: 'Camphor Tree',            latinName: 'Cinnamomum camphora' },
  { commonName: 'Silk Oak',                latinName: 'Grevillea robusta' },
  { commonName: 'Saucer Magnolia',         latinName: 'Magnolia x soulangeana' },
  { commonName: 'Dawn Redwood',            latinName: 'Metasequoia glyptostroboides' },
  { commonName: 'New Zealand Christmas Tree', latinName: 'Metrosideros excelsa' },
  { commonName: 'Cork Oak',                latinName: 'Quercus suber' },
  { commonName: 'California Pepper Tree',  latinName: 'Schinus molle' },
  { commonName: 'California Bay',          latinName: 'Umbellularia californica' },

  // ── Hort 12: Dry Shade ────────────────────────────────────────────────────
  { commonName: "Dutchman's Pipevine",     latinName: 'Aristolochia californica' },
  { commonName: 'Mugwort',                 latinName: 'Artemisia douglasiana' },
  { commonName: 'Yerba Buena',             latinName: 'Clinopodium douglasii' },
  { commonName: 'Western Bleeding Heart',  latinName: 'Dicentra formosa' },
  { commonName: 'Coffeeberry',             latinName: 'Frangula californica' },
  { commonName: 'Hellebore',               latinName: 'Helleborus orientalis', cultivarHint: 'Hundreds of hybrid cultivars in white, pink, plum, and spotted forms' },
  { commonName: 'Coral Bells',             latinName: 'Heuchera sanguinea', cultivarHint: 'Modern hybrids come in bronze, purple, caramel, and lime foliage; Palace Purple and Obsidian are popular' },
  { commonName: 'Pacific Coast Iris',      latinName: 'Iris douglasiana', cultivarHint: 'Pacific Coast Hybrids blend I. douglasiana and I. innominata; available in lavender, gold, and bicolor forms' },
  { commonName: 'Blue-eyed Grass',         latinName: 'Sisyrinchium bellum' },

  // ── Hort 12: Vines and Early Flowering Shrubs ─────────────────────────────
  { commonName: 'Bougainvillea',           latinName: 'Bougainvillea spectabilis', cultivarHint: 'Hundreds of cultivars with bract colors from white and pink to orange, red, and purple' },
  { commonName: 'Evergreen Clematis',      latinName: 'Clematis armandii' },
  { commonName: 'Forsythia',               latinName: 'Forsythia x intermedia' },
  { commonName: 'Lilac Vine',              latinName: 'Hardenbergia violacea' },
  { commonName: 'Japanese Honeysuckle',    latinName: 'Lonicera japonica' },
  { commonName: 'Japanese Pieris',         latinName: 'Pieris japonica', cultivarHint: "Mountain Fire has brilliant red new growth; Valley Rose and Forest Flame are widely grown" },
  { commonName: 'Potato Vine',             latinName: 'Solanum laxum' },
  { commonName: 'Weigela',                 latinName: 'Weigela florida', cultivarHint: "Wine and Roses has dark purple foliage with pink flowers; My Monet is a compact variegated dwarf" },

  // ── Hort 12: Native Shrubs ────────────────────────────────────────────────
  { commonName: 'McMinn Manzanita',        latinName: 'Arctostaphylos densiflora', cultivarHint: 'Howard McMinn is a spreading, mounding cultivar common in California landscapes' },
  { commonName: 'Western Spicebush',       latinName: 'Calycanthus occidentalis' },
  { commonName: 'Western Redbud',          latinName: 'Cercis occidentalis' },
  { commonName: 'Mountain Mahogany',       latinName: 'Cercocarpus betuloides' },
  { commonName: 'Sticky Monkey Flower',    latinName: 'Diplacus aurantiacus' },
  { commonName: 'Flannel Bush',            latinName: 'Fremontodendron californicum', cultivarHint: 'California Glory is the most popular hybrid cultivar, with large bright-yellow flowers' },
  { commonName: 'Coast Silktassel',        latinName: 'Garrya elliptica', cultivarHint: 'James Roof is widely grown for its exceptionally long catkins' },
  { commonName: 'Western Ninebark',        latinName: 'Physocarpus capitatus' },
  { commonName: 'Lemonade Berry',          latinName: 'Rhus integrifolia' },
  { commonName: 'Golden Currant',          latinName: 'Ribes aureum' },
  { commonName: 'Pink Flowering Currant',  latinName: 'Ribes sanguineum', cultivarHint: 'King Edward VII has deep crimson flowers; White Icicle is a white-flowered selection' },
  { commonName: 'Fuchsia-flowering Gooseberry', latinName: 'Ribes speciosum' },
  { commonName: 'Evergreen Currant',       latinName: 'Ribes viburnifolium' },
  { commonName: 'Blue Elderberry',         latinName: 'Sambucus mexicana' },

  // ── Hort 12: Small to Medium Shrubs (1) ───────────────────────────────────
  { commonName: 'Flowering Maple',         latinName: 'Abutilon hybridum', cultivarHint: 'Hybrids offer flowers in white, yellow, orange, and red; Bella and Canary Bird are common series' },
  { commonName: 'Flowering Quince',        latinName: 'Chaenomeles speciosa', cultivarHint: 'Texas Scarlet, Cameo (peach), and Toyo-Nishiki (mixed) are widely grown; different from edible Quince (Cydonia oblonga)' },
  { commonName: 'Mexican Orange Blossom',  latinName: 'Choisya ternata', cultivarHint: 'Sundance has golden foliage; Aztec Pearl has finer, more aromatic leaves' },
  { commonName: 'Pink Breath of Heaven',   latinName: 'Coleonema pulchellum' },
  { commonName: 'Christmas Heather',       latinName: 'Erica canaliculata' },
  { commonName: 'Woolly Grevillea',        latinName: 'Grevillea lanigera', cultivarHint: 'Prostrata is a low ground-cover form; Mt. Tamboritha is compact and mounding' },
  { commonName: 'Bigleaf Hydrangea',       latinName: 'Hydrangea macrophylla', cultivarHint: 'Nikko Blue is classic; Endless Summer reblooms on new wood; Incrediball has huge white blooms' },
  { commonName: 'Japanese Spiraea',        latinName: 'Spiraea japonica', cultivarHint: 'Goldflame has orange-gold new growth; Little Princess is compact; Magic Carpet has red-tipped new foliage' },
  { commonName: 'Vanhoutte Spiraea',       latinName: 'Spiraea x vanhouttei' },
  { commonName: 'Coast Rosemary',          latinName: 'Westringia fruticosa', cultivarHint: 'Wynabbie Gem is a compact cultivar; Morning Light has silvery-white-edged leaves' },

  // ── Hort 12: Small-Mid Size Trees ─────────────────────────────────────────
  { commonName: 'California Buckeye',      latinName: 'Aesculus californica' },
  { commonName: 'Red Horsechestnut',       latinName: 'Aesculus x carnea', cultivarHint: 'Briotii has richer red flowers than the straight hybrid' },
  { commonName: 'Fern Pine',               latinName: 'Afrocarpus gracilior' },
  { commonName: 'Hackberry',               latinName: 'Celtis occidentalis' },
  { commonName: 'Lemon',                   latinName: 'Citrus limon', cultivarHint: 'Eureka and Lisbon are the standard commercial types; Meyer is sweeter and more cold-tolerant' },
  { commonName: 'Japanese Dogwood',        latinName: 'Cornus kousa', cultivarHint: 'Milky Way blooms heavily; Wolf Eyes has white-edged leaves; Stellar Pink is a disease-resistant hybrid' },
  { commonName: 'Smoke Tree',              latinName: 'Cotinus coggygria', cultivarHint: "Royal Purple and Grace have deep purple foliage; Golden Spirit has chartreuse leaves" },
  { commonName: 'Bronze Loquat',           latinName: 'Eriobotrya deflexa' },
  { commonName: 'Edible Fig',              latinName: 'Ficus carica', cultivarHint: 'Brown Turkey is the most common; Black Mission and Kadota are also widely grown; all produce edible fruit' },
  { commonName: 'Yew Podocarpus',          latinName: 'Podocarpus macrophyllus' },
  { commonName: 'Cherry Plum',             latinName: 'Prunus cerasifera', cultivarHint: 'Thundercloud and Krauter Vesuvius have dark purple foliage; used extensively as street trees' },
  { commonName: 'Callery Pear',            latinName: 'Pyrus calleryana', cultivarHint: 'Bradford is the classic cultivar; Aristocrat and Cleveland Select are less prone to splitting' },
  { commonName: 'African Sumac',           latinName: 'Rhus lancea' },

  // ── Hort 12: Low Growing Perennials and Groundcovers ──────────────────────
  { commonName: "Bear's Breech",           latinName: 'Acanthus mollis' },
  { commonName: 'Poppy Anemone',           latinName: 'Anemone coronaria', cultivarHint: 'Meron and Marianne series come in red, blue, pink, and white; widely used as cut flowers' },
  { commonName: 'Kangaroo Paw',            latinName: 'Anigozanthos flavidus', cultivarHint: 'Bush Gems series is compact and mildew-resistant; colors range from yellow to orange, red, and burgundy' },
  { commonName: 'Columbine',               latinName: 'Aquilegia vulgaris', cultivarHint: "McKana Giants and Songbird series are popular hybrid strains; species A. canadensis and A. formosa are native North American options" },
  { commonName: 'California Sagebrush',    latinName: 'Artemisia californica' },
  { commonName: 'Coyote Brush',            latinName: 'Baccharis pilularis', cultivarHint: 'Twin Peaks and Pigeon Point are low prostrate selections used for erosion control and fire-safe gardens' },
  { commonName: 'Bowles Mauve Wallflower', latinName: 'Erysimum linifolium', cultivarHint: 'Bowles Mauve is a long-blooming sterile hybrid that flowers almost continuously in mild climates' },
  { commonName: 'Evergreen Candytuft',     latinName: 'Iberis sempervirens', cultivarHint: 'Snowflake and Alexander White are compact mounding selections with bright white flowers' },
  { commonName: 'Red Hot Poker',           latinName: 'Kniphofia uvaria', cultivarHint: 'Little Maid is a dwarf white-and-yellow cultivar; Flamenco produces a mix of colors from a single sowing' },
  { commonName: 'Garden Geranium',         latinName: 'Pelargonium x hortorum', cultivarHint: 'Orbit and Multibloom are popular seed strains; zonal geraniums are named for the dark leaf band' },
  { commonName: 'Small Jerusalem Sage',    latinName: 'Phlomis lanata' },
  { commonName: 'English Primrose',        latinName: 'Primula polyantha', cultivarHint: 'Crescendo and Pacific Giant series offer large flowers in virtually every color including bicolors' },

  // ── Hort 12: Small to Medium Shrubs (2) ───────────────────────────────────
  { commonName: 'Sageleaf Rock Rose',      latinName: 'Cistus salviifolius' },
  { commonName: 'Orchid Rockrose',         latinName: 'Cistus x purpureus' },
  { commonName: 'Pink Rockrose',           latinName: 'Cistus x skanbergii' },
  { commonName: 'Heavenly Bamboo',         latinName: 'Nandina domestica', cultivarHint: 'Firepower has brilliant orange-red fall/winter foliage; Harbor Dwarf is compact; Gulf Stream is upright' },
  { commonName: 'Jerusalem Sage',          latinName: 'Phlomis fruticosa' },
  { commonName: 'Purple Phlomis',          latinName: 'Phlomis purpurea' },
  { commonName: 'Germander Sage',          latinName: 'Salvia chamaedryoides' },
  { commonName: 'Autumn Sage',             latinName: 'Salvia greggii', cultivarHint: 'Wild Watermelon, Cherry Chief, and Furman Red are popular named selections; extremely heat- and drought-tolerant' },
  { commonName: 'Gray Sage',               latinName: 'Salvia leucophylla', cultivarHint: 'Point Sal Spreader is a low-growing selection good for erosion control on dry slopes' },
  { commonName: 'Hot Lips Sage',           latinName: 'Salvia microphylla', cultivarHint: 'Hot Lips has bicolor red-and-white flowers that shift with temperature; Cerro Potosi has all-red flowers' },

  // ── Hort 12: McDonald Neighborhood ───────────────────────────────────────
  { commonName: 'Peruvian Lily',           latinName: 'Alstroemeria aurantiaca', cultivarHint: 'Princess and Inca series offer a wide color range; excellent long-lived cut flowers' },
  { commonName: 'European White Birch',    latinName: 'Betula pendula', cultivarHint: "Youngii is a weeping form; Purpurea has purple leaves; Fastigiata is upright and narrow" },
  { commonName: "Jupiter's Beard",         latinName: 'Centranthus ruber' },
  { commonName: 'Eastern Redbud',          latinName: 'Cercis canadensis', cultivarHint: 'Forest Pansy has deep purple heart-shaped leaves; Rising Sun has orange-to-gold new foliage; Lavender Twist is weeping' },
  { commonName: 'Flowering Crabapple',     latinName: 'Malus floribunda', cultivarHint: 'Prairie Fire has red flowers and good disease resistance; Sugar Tyme and Snowdrift are popular white-flowered types' },
  { commonName: 'Japanese Flowering Cherry', latinName: 'Prunus serrulata', cultivarHint: "Kwanzan has double deep-pink flowers; Yoshino (P. x yedoensis) is the famous white Washington D.C. cherry" },
  { commonName: 'Rhododendron / Azalea',   latinName: 'Rhododendron catawbiense', cultivarHint: 'Encore series reblooms in fall; Kurume azaleas are compact evergreen types; PJM hybrids are hardy to Zone 4' },
  { commonName: 'Common Lilac',            latinName: 'Syringa vulgaris', cultivarHint: "Charles Joly (double magenta) and Mme. Lemoine (double white) are classic cultivars; President Lincoln is pure blue" },
  { commonName: 'Calla Lily',              latinName: 'Zantedeschia aethiopica', cultivarHint: 'Crowborough is the hardiest selection; Green Goddess has green-flushed spathes' },

  // ── Hort 12: Medium to Large Shrubs ──────────────────────────────────────
  { commonName: 'Fragrant Pitcher Sage',   latinName: 'Lepechinia fragrans' },
  { commonName: 'New Zealand Tea Tree',    latinName: 'Leptospermum scoparium', cultivarHint: 'Red Damask (double crimson), Crimson Glory, and Snow White are popular; Horizontalis is a low spreading form' },
  { commonName: 'Conebush',                latinName: 'Leucadendron laureolum', cultivarHint: 'Safari Sunset is the classic bronze-red cut-flower cultivar; Wilson\'s Wonder has cream and red bracts' },
  { commonName: 'Chinese Fringe Flower',   latinName: 'Loropetalum chinense', cultivarHint: 'Purple Pixie is a dwarf weeping form; Burgundy has deep burgundy foliage; Sizzling Pink has hot-pink flowers' },
  { commonName: 'Wild Mock Orange',        latinName: 'Philadelphus lewisii' },
  { commonName: 'New Zealand Flax',        latinName: 'Phormium tenax', cultivarHint: "Jester has pink-and-green striped leaves; Sundowner has bronze with pink edges; many compact dwarf forms available" },
  { commonName: 'Catalina Island Cherry',  latinName: 'Prunus ilicifolia subsp. lyonii' },
  { commonName: 'Laurustinus',             latinName: 'Viburnum tinus', cultivarHint: 'Spring Bouquet is compact; Eve Price is smaller with pink buds; Gwenllian has pink-tinted flowers' },

  // ── Hort 12: New Trees for a Changing Climate ─────────────────────────────
  { commonName: 'Sydney Red Gum',          latinName: 'Angophora costata' },
  { commonName: 'Pink Flame Tree',         latinName: 'Brachychiton discolor' },
  { commonName: 'Sacred Fig',              latinName: 'Ficus religiosa' },
  { commonName: 'Sweet Hakea',             latinName: 'Hakea drupacea' },
  { commonName: 'Santa Cruz Island Ironwood', latinName: 'Lyonothamnus floribundus' },
  { commonName: 'Torrey Pine',             latinName: 'Pinus torreyana' },
  { commonName: 'Engleman Oak',            latinName: 'Quercus engelmannii' },
  { commonName: 'Silverleaf Oak',          latinName: 'Quercus hypoleucoides' },
  { commonName: 'Netleaf Oak',             latinName: 'Quercus rugosa' },
  { commonName: 'Island Oak',              latinName: 'Quercus tomentella' },
  { commonName: 'Soapbark Tree',           latinName: 'Quillaja saponaria' },

  // ── Hort 12: Sonoma Botanic Garden ────────────────────────────────────────
  { commonName: "David's Maple",           latinName: 'Acer davidii' },
  { commonName: 'Chinese Hackberry',       latinName: 'Celtis sinensis' },
  { commonName: 'Katsura Tree',            latinName: 'Cercidiphyllum japonicum' },
  { commonName: 'Chinese Fringe Tree',     latinName: 'Chionanthus retusus' },
  { commonName: 'Japanese Rose',           latinName: 'Kerria japonica', cultivarHint: "Pleniflora (double) and Picta (white-variegated leaves) are the two most common cultivars" },
  { commonName: 'Beauty Bush',             latinName: 'Kolkwitzia amabilis', cultivarHint: 'Pink Cloud is a selection with especially profuse pink flowers' },
  { commonName: 'Asiatic Lily',            latinName: 'Lilium asiatic', cultivarHint: 'Hundreds of named hybrids; Gran Paradiso (red), Tiny Bee (yellow), and Landini (maroon) are popular; earliest lilies to bloom' },
  { commonName: 'Empress Tree',            latinName: 'Paulownia tomentosa' },
  { commonName: "Lady Banks' Rose",        latinName: 'Rosa banksiae', cultivarHint: 'Lutea has small double yellow flowers and is the most common; Albe has white double blooms' },

  // ── Hort 12: Laguna de Santa Rosa Demonstration Garden ────────────────────
  { commonName: 'Narrow-leaf Milkweed',    latinName: 'Asclepias fascicularis' },
  { commonName: 'Showy Milkweed',          latinName: 'Asclepias speciosa' },
  { commonName: 'California Lilac',        latinName: 'Ceanothus thyrsiflorus', cultivarHint: 'Skylark is compact; Concha has rich blue flower clusters; Anchor Bay is a low ground cover selection' },
  { commonName: 'Pipestem Clematis',       latinName: 'Clematis lasiantha' },
  { commonName: 'Redtwig Dogwood',         latinName: 'Cornus sericea', cultivarHint: "Cardinal has the brightest red stems; Flaviramea has yellow-green stems; Kelseyi is a dwarf form" },
  { commonName: 'Seaside Daisy',           latinName: 'Erigeron glaucus', cultivarHint: 'Wayne Roderick has large violet-blue flowers; Cape Sebastian is compact with lavender blooms' },
  { commonName: 'Twinberry Honeysuckle',   latinName: 'Lonicera involucrata' },
  { commonName: 'Coyote Mint',             latinName: 'Monardella villosa' },
  { commonName: 'Foothill Penstemon',      latinName: 'Penstemon heterophyllus', cultivarHint: 'Margarita BOP and Blue Springs are selected forms with vivid blue-violet flowers' },
  { commonName: 'Checkerbloom',            latinName: 'Sidalcea malviflora' },
  { commonName: 'Snowberry',               latinName: 'Symphoricarpos albus' },

  // ── Hort 12: Hallberg Garden ──────────────────────────────────────────────
  { commonName: 'Western Wild Ginger',     latinName: 'Asarum caudatum' },
  { commonName: 'California Bush Sunflower', latinName: 'Encelia californica' },
  { commonName: 'Oceanspray',              latinName: 'Holodiscus discolor' },
  { commonName: 'Cliff Maids',             latinName: 'Lewisia cotyledon', cultivarHint: 'Sunset Strain has flowers in coral-to-orange tones; Rainbow Mix covers white through deep pink' },
  { commonName: 'Island Mallow',           latinName: 'Malva assurgentiflora' },
  { commonName: 'Scarlet Monardella',      latinName: 'Monardella macrantha', cultivarHint: 'Marion Sampson is a long-blooming cultivar with large scarlet hummingbird flowers' },
  { commonName: 'California Phacelia',     latinName: 'Phacelia californica' },
  { commonName: 'White Sage',              latinName: 'Salvia apiana' },
  { commonName: 'Black Sage',              latinName: 'Salvia mellifera' },
  { commonName: 'Purple Needle Grass',     latinName: 'Nassella pulchra' },
  { commonName: 'Fringe Cups',             latinName: 'Tellima grandiflora' },
  { commonName: 'Western Vervain',         latinName: 'Verbena lasiostachys' },

  // ── Hort 12: Invasive Species (flagged for identification, not recommendation) ──
  { commonName: 'Tree of Heaven',          latinName: 'Ailanthus altissima', isInvasive: true },
  { commonName: 'Giant Reed',              latinName: 'Arundo donax', isInvasive: true },
  { commonName: 'Butterfly Bush',          latinName: 'Buddleja davidii', isInvasive: true },
  { commonName: 'Pampas Grass',            latinName: 'Cortaderia selloana', isInvasive: true },
  { commonName: 'Franchet Cotoneaster',    latinName: 'Cotoneaster franchetii', isInvasive: true },
  { commonName: 'Parney Cotoneaster',      latinName: 'Cotoneaster lacteus', isInvasive: true },
  { commonName: 'Blue Gum Eucalyptus',     latinName: 'Eucalyptus globulus', isInvasive: true },
  { commonName: 'Fennel',                  latinName: 'Foeniculum vulgare', isInvasive: true },
  { commonName: 'French Broom',            latinName: 'Genista monspessulana', isInvasive: true },
  { commonName: 'English Ivy',             latinName: 'Hedera helix', isInvasive: true },
  { commonName: 'Gladwyn Iris',            latinName: 'Iris foetidissima', isInvasive: true },
  { commonName: 'Japanese Privet',         latinName: 'Ligustrum japonicum', isInvasive: true, cultivarHint: 'Texanum (Waxleaf Privet) is a common landscape cultivar with thicker, wavier leaves' },
  { commonName: 'Glossy Privet',           latinName: 'Ligustrum lucidum', isInvasive: true },
  { commonName: "Forget-Me-Not",           latinName: 'Myosotis sylvatica', isInvasive: true },
  { commonName: 'Bermuda Buttercup',       latinName: 'Oxalis pes-caprae', isInvasive: true },
  { commonName: 'Firethorn',               latinName: 'Pyracantha coccinea', isInvasive: true, cultivarHint: 'Teton (upright, orange), Mohave (red berries), and Yukon Belle (orange, hardier) are common cultivars' },
  { commonName: 'Himalayan Blackberry',    latinName: 'Rubus armeniacus', isInvasive: true },
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
  usda_zone_min: string | null
  usda_zone_max: string | null
  forest_garden_layer: string | null
  permaculture_uses: string[] | null
  notable_cultivars: string | null
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

function encodeZone(label: string): number | null {
  const match = label.trim().toLowerCase().match(/^(\d+)([ab])?$/)
  if (!match) return null
  const major = parseInt(match[1], 10)
  if (major < 1 || major > 13) return null
  return major * 2 + (match[2] === 'b' ? 1 : 0)
}

function encodeZoneLabel(label: string | null | undefined): number | null {
  if (!label) return null
  return encodeZone(label)
}

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
      headers: { 'User-Agent': 'PermaculturePlantPicker/1.0 (educational project; rossfischer)' },
    })
    if (!res.ok) return null
    const json = await res.json()
    return json.results?.[0]?.default_photo?.medium_url ?? null
  } catch {
    return null
  }
}

async function enrichWithClaude(commonName: string, latinName: string, cultivarHint?: string): Promise<HorticulturalData | null> {
  try {
    const cultivarContext = cultivarHint
      ? `\nCultivar context: ${cultivarHint}`
      : ''
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `You are a permaculture and horticultural database. For the plant "${commonName}" (${latinName}), return data as a single JSON object. Use null for any field you are not confident about. Only return valid JSON — no explanation.${cultivarContext}

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
  "usda_zone_min": half-zone label e.g. "3a" or "7b" | null,
  "usda_zone_max": half-zone label e.g. "10b" or "11a" | null,
  "forest_garden_layer": "canopy" | "sub-canopy" | "shrub" | "herb" | "ground cover" | "rhizosphere" | "climber" | null,
  "permaculture_uses": array from ["nitrogen fixer","dynamic accumulator","edible","medicinal","pollinator","biomass","ground cover","windbreak","wildlife habitat","fiber","pioneer","insectary"] | null,
  "notable_cultivars": "1–2 sentence description of the most widely grown cultivars and what they are known for" | null
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
  console.log('Permaculture Plant Picker — Permaculture Plant Import')
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

    await Promise.all(batch.map(async ({ commonName, latinName, cultivarHint, isInvasive }) => {
      const hort = await enrichWithClaude(commonName, latinName, cultivarHint)

      if (!hort || (!hort.description && !hort.sun && !hort.water)) {
        console.warn(`  ⚠ Skipping ${latinName} (insufficient data)`)
        skipped++
        return
      }

      const existing = existingByLatinName.get(latinName)

      if (existing) {
        // Plant already in DB — patch permaculture fields and new metadata
        const updatePayload: Record<string, unknown> = {
          forest_garden_layer: normalizeEnum(hort.forest_garden_layer, VALID_LAYER),
          permaculture_uses: hort.permaculture_uses ?? null,
          notable_cultivars: hort.notable_cultivars ?? null,
        }
        if (isInvasive) updatePayload.is_invasive = true
        const { error } = await supabase
          .from('plants')
          .update(updatePayload)
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
          usda_zone_min: encodeZoneLabel(hort.usda_zone_min),
          usda_zone_max: encodeZoneLabel(hort.usda_zone_max),
          forest_garden_layer: normalizeEnum(hort.forest_garden_layer, VALID_LAYER),
          permaculture_uses: hort.permaculture_uses ?? null,
          notable_cultivars: hort.notable_cultivars ?? null,
          is_invasive: isInvasive ?? false,
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
