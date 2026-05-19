import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import AddToListClient from './AddToListClient'
import { decodeZone } from '@/lib/zones'
import { SUN_ICONS, WATER_ICONS, MONTH_OPTIONS, FUNCTIONAL_INFO_LABELS } from '@/lib/plant-labels'

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-stone-white rounded-xl p-4">
      <p className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.05em] mb-1">{label}</p>
      <p className="text-sm text-dark-bark capitalize">{value}</p>
    </div>
  )
}

export default async function PlantDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params

  const { data: plant } = await supabase
    .from('plants')
    .select('*')
    .eq('id', id)
    .single()

  if (!plant) notFound()

  const sizeLabel = plant.height_min && plant.height_max
    ? `${plant.height_min}–${plant.height_max}′ tall${plant.width_min && plant.width_max ? ` × ${plant.width_min}–${plant.width_max}′ wide` : ''}`
    : null

  const overviewCells = [
    plant.plant_type && { label: 'Type', value: plant.plant_type },
    plant.form && { label: 'Form', value: plant.form },
    plant.growth_rate && { label: 'Growth Rate', value: plant.growth_rate },
    sizeLabel && { label: 'Size', value: sizeLabel },
    plant.dormancy && { label: 'Dormancy', value: plant.dormancy },
    (plant.usda_zone_min !== null && plant.usda_zone_max !== null)
      ? { label: 'USDA Zones', value: `${decodeZone(plant.usda_zone_min)}–${decodeZone(plant.usda_zone_max)}` }
      : plant.usda_zones
        ? { label: 'USDA Zones', value: plant.usda_zones }
        : null,
  ].filter(Boolean) as { label: string; value: string }[]

  const landscapingCells = [
    plant.sun && { label: 'Sun', value: `${SUN_ICONS[plant.sun] ?? ''} ${plant.sun}`.trim() },
    plant.water && { label: 'Water', value: `${WATER_ICONS[plant.water] ?? ''} ${plant.water}`.trim() },
    plant.soil && { label: 'Soil', value: plant.soil },
    plant.native_range && { label: 'Native Range', value: plant.native_range },
    plant.bloom_months?.length && { label: 'Bloom Season', value: plant.bloom_months.join(' · ') },
    plant.season_of_interest?.length && { label: 'Season of Interest', value: plant.season_of_interest.join(', ') },
  ].filter(Boolean) as { label: string; value: string }[]

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      {/* Back link */}
      <Link href="/plants" className="inline-flex items-center gap-1.5 text-sm text-warm-stone hover:text-warm-umber transition-colors mb-6">
        ← Plant Database
      </Link>

      <div className="bg-cream rounded-2xl border border-warm-stone/30 shadow-warm overflow-hidden">
        {/* Hero image */}
        {plant.image_url && (
          <div className="relative w-full h-96 bg-stone-white">
            <Image
              src={plant.image_url}
              alt={plant.common_name}
              fill
              className="object-cover"
              unoptimized
              sizes="(max-width: 896px) 100vw, 896px"
              priority
            />
          </div>
        )}

        <div className="p-8 sm:p-10">
        {/* Name + Add to list */}
        <div className="flex items-start justify-between mb-3 gap-6">
        <div>
          <h1 className="font-playfair text-4xl font-semibold text-dark-bark leading-tight">{plant.common_name}</h1>
          {plant.latin_name && (
            <p className="text-base italic text-warm-umber mt-1.5">{plant.latin_name}</p>
          )}
        </div>
        <div className="flex-shrink-0 mt-1">
          <AddToListClient plantId={plant.id} />
        </div>
      </div>

      {/* Quick badges */}
      {(plant.sun || plant.water || plant.plant_type || plant.is_invasive) && (
        <div className="flex flex-wrap gap-2 mb-8">
          {plant.is_invasive && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-red-50 text-red-700 px-3 py-1.5 rounded-full border border-red-200">
              ⚠ Invasive Species
            </span>
          )}
          {plant.plant_type && (
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-terracotta bg-terracotta/10 border border-terracotta/20 px-3 py-1.5 rounded-full capitalize">
              {plant.plant_type}
            </span>
          )}
          {plant.sun && (
            <span className="inline-flex items-center gap-1.5 text-sm bg-amber-50 text-amber-800 px-3 py-1.5 rounded-full border border-amber-200">
              {SUN_ICONS[plant.sun]} {plant.sun}
            </span>
          )}
          {plant.water && (
            <span className="inline-flex items-center gap-1.5 text-sm bg-teal-50 text-teal-800 px-3 py-1.5 rounded-full border border-teal-200">
              {WATER_ICONS[plant.water]} {plant.water} water
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {plant.description && (
        <p className="text-warm-umber text-base leading-relaxed mb-8">{plant.description}</p>
      )}

      <hr className="border-warm-stone/20 mb-8" />

      {/* Plant Overview */}
      {overviewCells.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">Plant Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {overviewCells.map(cell => (
              <InfoCell key={cell.label} label={cell.label} value={cell.value} />
            ))}
          </div>
        </section>
      )}

      {/* Landscaping */}
      {landscapingCells.length > 0 && (
        <section className="mb-8">
          <h2 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">Landscaping</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {landscapingCells.map(cell => (
              <InfoCell key={cell.label} label={cell.label} value={cell.value} />
            ))}
          </div>
        </section>
      )}

      {/* Functional Roles */}
      {plant.permaculture_uses?.length ? (
        <section className="mb-8">
          <h2 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">Functional Roles</h2>
          <div className="flex flex-wrap gap-2">
            {plant.permaculture_uses.map((use: string) => (
              <span key={use} className="text-xs bg-terracotta/10 text-terracotta px-3 py-1.5 rounded-full border border-terracotta/20 capitalize">{use}</span>
            ))}
          </div>
        </section>
      ) : null}

      {/* Forest Layer & Succession */}
      {(plant.forest_garden_layer || plant.succession_role?.length) ? (
        <section className="mb-8">
          <h2 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">Forest Layer & Succession</h2>
          {plant.forest_garden_layer && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <InfoCell label={FUNCTIONAL_INFO_LABELS.forest_garden_layer} value={plant.forest_garden_layer} />
            </div>
          )}
          {plant.succession_role?.length ? (
            <div className="flex flex-wrap gap-2">
              {plant.succession_role.map((role: string) => (
                <span key={role} className="text-xs bg-terracotta/10 text-terracotta px-3 py-1.5 rounded-full border border-terracotta/20 capitalize">{role}</span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Establishment & Care */}
      {(() => {
        const careCells = [
          plant.establishment_difficulty && { label: FUNCTIONAL_INFO_LABELS.establishment_difficulty, value: plant.establishment_difficulty },
          plant.maintenance_level && { label: FUNCTIONAL_INFO_LABELS.maintenance_level, value: plant.maintenance_level },
          plant.years_to_bearing != null && { label: FUNCTIONAL_INFO_LABELS.years_to_bearing, value: `${plant.years_to_bearing} years` },
        ].filter(Boolean) as { label: string; value: string }[]
        const hasCare = careCells.length > 0 || plant.propagation_methods?.length
        return hasCare ? (
          <section className="mb-8">
            <h2 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">Establishment & Care</h2>
            {careCells.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {careCells.map(cell => (
                  <InfoCell key={cell.label} label={cell.label} value={cell.value} />
                ))}
              </div>
            )}
            {plant.propagation_methods?.length ? (
              <div className="flex flex-wrap gap-2">
                {plant.propagation_methods.map((method: string) => (
                  <span key={method} className="text-xs bg-terracotta/10 text-terracotta px-3 py-1.5 rounded-full border border-terracotta/20 capitalize">{method}</span>
                ))}
              </div>
            ) : null}
          </section>
        ) : null
      })()}

      {/* Harvest */}
      {(plant.edible_parts?.length || plant.harvest_months?.length) ? (
        <section className="mb-8">
          <h2 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-4">Harvest</h2>
          {plant.edible_parts?.length ? (
            <div className="flex flex-wrap gap-2 mb-4">
              {plant.edible_parts.map((part: string) => (
                <span key={part} className="text-xs bg-terracotta/10 text-terracotta px-3 py-1.5 rounded-full border border-terracotta/20 capitalize">{part}</span>
              ))}
            </div>
          ) : null}
          {plant.harvest_months?.length ? (
            <div className="flex flex-wrap gap-2">
              {[...plant.harvest_months].sort((a: string, b: string) => MONTH_OPTIONS.indexOf(a) - MONTH_OPTIONS.indexOf(b)).map((month: string) => (
                <span key={month} className="text-xs bg-terracotta/10 text-terracotta px-3 py-1.5 rounded-full border border-terracotta/20 capitalize">{month}</span>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Notable Cultivars */}
      {plant.notable_cultivars && (
        <section className="mt-8 pt-8 border-t border-warm-stone/20">
          <h2 className="text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] mb-3">Notable Cultivars</h2>
          <p className="text-sm text-warm-umber leading-relaxed">{plant.notable_cultivars}</p>
        </section>
      )}
        </div>{/* end padding */}
      </div>{/* end card */}
    </div>
  )
}
