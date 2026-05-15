import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import AddToListClient from './AddToListClient'

const SUN_ICONS: Record<string, string> = {
  'full sun': '☀️',
  'part shade': '⛅',
  'full shade': '🌥️',
}
const WATER_ICONS: Record<string, string> = {
  'low': '💧',
  'moderate': '💧💧',
  'high': '💧💧💧',
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-sm text-gray-800 capitalize">{value}</p>
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
    plant.usda_zones && { label: 'USDA Zones', value: plant.usda_zones },
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
      {/* Hero image */}
      {plant.image_url && (
        <div className="relative w-full h-80 rounded-2xl overflow-hidden bg-green-50 mb-8">
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

      {/* Back link */}
      <Link href="/plants" className="text-sm text-gray-400 hover:text-gray-600">
        ← Plant Database
      </Link>

      {/* Name + Add to list */}
      <div className="flex items-start justify-between mt-4 mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{plant.common_name}</h1>
          <p className="text-base italic text-gray-400 mt-1">
            {plant.latin_name}
            {plant.plant_type && (
              <span className="not-italic text-gray-300"> · </span>
            )}
            {plant.plant_type && (
              <span className="not-italic capitalize text-gray-500">{plant.plant_type}</span>
            )}
          </p>
        </div>
        <AddToListClient plantId={plant.id} />
      </div>

      {/* Plant Overview */}
      {overviewCells.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Plant Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {overviewCells.map(cell => (
              <InfoCell key={cell.label} label={cell.label} value={cell.value} />
            ))}
          </div>
        </section>
      )}

      {/* Description */}
      {plant.description && (
        <p className="text-gray-600 leading-relaxed mb-8">{plant.description}</p>
      )}

      {/* Landscaping */}
      {landscapingCells.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Landscaping</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {landscapingCells.map(cell => (
              <InfoCell key={cell.label} label={cell.label} value={cell.value} />
            ))}
          </div>
        </section>
      )}

      {/* Permaculture */}
      {(plant.forest_garden_layer || plant.permaculture_uses?.length) && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Permaculture</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
            {plant.forest_garden_layer && (
              <InfoCell label="Forest Garden Layer" value={plant.forest_garden_layer} />
            )}
          </div>
          {plant.permaculture_uses?.length && (
            <div className="flex flex-wrap gap-2">
              {plant.permaculture_uses.map(use => (
                <span key={use} className="text-xs bg-green-50 text-green-800 px-3 py-1.5 rounded-full border border-green-100 capitalize">
                  {use}
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
