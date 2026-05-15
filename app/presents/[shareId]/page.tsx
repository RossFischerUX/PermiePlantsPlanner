import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Plant } from '@/lib/types'

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

export default async function PresentationPage({ params }: { params: { shareId: string } }) {
  const supabase = await createClient()
  const { shareId } = await params

  const { data: list } = await supabase
    .from('plant_lists')
    .select('*')
    .eq('share_id', shareId)
    .single()

  if (!list) notFound()

  const { data: items } = await supabase
    .from('plant_list_items')
    .select('*, plant:plants(*)')
    .eq('list_id', list.id)
    .order('sort_order')

  const plants: Plant[] = (items ?? []).map((i: { plant: Plant }) => i.plant).filter(Boolean)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Presentation header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{list.title}</h1>
              {list.description && <p className="text-gray-500 mt-1 text-sm">{list.description}</p>}
              <p className="text-xs text-gray-400 mt-1">{plants.length} plants</p>
            </div>
            <Link href="/" className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
              <span>🌿</span> Permaculture Plant Picker
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-6 border-b border-gray-200 -mb-px">
            <span className="pb-3 text-sm font-semibold text-green-700 border-b-2 border-green-700">
              Plants
            </span>
            <Link
              href={`/presents/${shareId}/reports`}
              className="pb-3 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent"
            >
              Reports
            </Link>
          </div>
        </div>
      </div>

      {/* Plant grid */}
      <div className="max-w-5xl mx-auto px-6 py-10">
        {plants.length === 0 ? (
          <p className="text-gray-400 text-center py-20">No plants in this list yet.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {plants.map(plant => {
              const sizeLabel = plant.height_min && plant.height_max
                ? `${plant.height_min}–${plant.height_max}′ tall`
                : null
              return (
                <div key={plant.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="relative h-48 bg-green-50">
                    {plant.image_url ? (
                      <Image
                        src={plant.image_url}
                        alt={plant.common_name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        unoptimized
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-5xl">🌿</div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-gray-900 text-base mb-0.5">{plant.common_name}</h3>
                    {plant.latin_name && (
                      <p className="text-xs italic text-gray-400 mb-3">{plant.latin_name}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {plant.sun && (
                        <span className="text-xs bg-yellow-50 text-yellow-800 px-2 py-1 rounded-full border border-yellow-100">
                          {SUN_ICONS[plant.sun]} {plant.sun}
                        </span>
                      )}
                      {plant.water && (
                        <span className="text-xs bg-blue-50 text-blue-800 px-2 py-1 rounded-full border border-blue-100">
                          {WATER_ICONS[plant.water]} {plant.water}
                        </span>
                      )}
                      {sizeLabel && (
                        <span className="text-xs bg-gray-50 text-gray-600 px-2 py-1 rounded-full border border-gray-100">
                          📏 {sizeLabel}
                        </span>
                      )}
                    </div>
                    {plant.description && (
                      <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">{plant.description}</p>
                    )}
                    {plant.bloom_months && plant.bloom_months.length > 0 && (
                      <p className="text-xs text-gray-400 mt-3">
                        🌸 Blooms: {plant.bloom_months.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
