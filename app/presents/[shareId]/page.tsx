import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Plant } from '@/lib/types'

const SUN_LABELS: Record<string, string> = {
  'full sun': '☀️ Full Sun',
  'part shade': '⛅ Part Shade',
  'full shade': '🌥️ Full Shade',
}
const WATER_LABELS: Record<string, string> = {
  'low': '💧 Low',
  'moderate': '💧💧 Moderate',
  'high': '💧💧💧 High',
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
    <div className="min-h-screen bg-parchment">
      {/* Presentation header */}
      <header className="bg-parchment border-b border-warm-stone/20 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="font-playfair text-2xl font-bold text-dark-bark leading-snug">{list.title}</h1>
              {list.description && <p className="text-warm-umber text-sm mt-1">{list.description}</p>}
              <p className="text-xs text-warm-stone mt-1">{plants.length} plant{plants.length !== 1 ? 's' : ''}</p>
            </div>
            <Link href="/" className="flex-shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-forest hover:text-forest-dark transition-colors mt-1">
              🌿 Permaculture Plant Picker
            </Link>
          </div>
          {/* Tabs */}
          <div className="flex gap-6 mt-4 border-b border-warm-stone/20 -mb-px">
            <span className="pb-3 text-sm font-semibold text-forest border-b-2 border-forest">
              Plants
            </span>
            <Link
              href={`/presents/${shareId}/reports`}
              className="pb-3 text-sm font-medium text-warm-umber hover:text-dark-bark border-b-2 border-transparent transition-colors"
            >
              Reports
            </Link>
          </div>
        </div>
      </header>

      {/* Plant grid */}
      <main className="max-w-5xl mx-auto px-6 py-10">
        {plants.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-warm-umber">No plants in this list yet.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {plants.map(plant => {
              const sizeLabel = plant.height_min && plant.height_max
                ? `${plant.height_min}–${plant.height_max}′`
                : null
              return (
                <div key={plant.id} className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm overflow-hidden flex flex-col">
                  {/* Image */}
                  <div className="relative h-48 flex-shrink-0 bg-gradient-to-br from-forest/10 to-sage-mist/20">
                    {plant.image_url && (
                      <Image
                        src={plant.image_url}
                        alt={plant.common_name}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 33vw"
                        unoptimized
                      />
                    )}
                  </div>
                  {/* Card body */}
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="font-playfair font-semibold text-dark-bark text-lg leading-snug">{plant.common_name}</h3>
                    {plant.latin_name && (
                      <p className="text-xs italic text-warm-umber mt-0.5 mb-3">{plant.latin_name}</p>
                    )}
                    {/* Badges */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {plant.sun && (
                        <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">
                          {SUN_LABELS[plant.sun] ?? plant.sun}
                        </span>
                      )}
                      {plant.water && (
                        <span className="text-xs font-medium bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full border border-teal-100">
                          {WATER_LABELS[plant.water] ?? plant.water}
                        </span>
                      )}
                      {sizeLabel && (
                        <span className="text-xs font-medium bg-stone-100 text-warm-umber px-2.5 py-1 rounded-full border border-warm-stone/20">
                          {sizeLabel} tall
                        </span>
                      )}
                    </div>
                    {/* Description */}
                    {plant.description && (
                      <p className="text-xs text-warm-umber leading-relaxed line-clamp-4 flex-1">{plant.description}</p>
                    )}
                    {/* Bloom months */}
                    {plant.bloom_months && plant.bloom_months.length > 0 && (
                      <p className="text-xs text-warm-stone mt-3 pt-3 border-t border-warm-stone/15">
                        🌸 Blooms: {plant.bloom_months.join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <footer className="border-t border-warm-stone/20 mt-10">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <p className="text-xs text-warm-stone">© 2026 Permaculture Plant Picker. All rights reserved.</p>
          <Link href="/" className="text-xs font-semibold text-forest hover:underline">
            Permaculture Plant Picker
          </Link>
        </div>
      </footer>
    </div>
  )
}
