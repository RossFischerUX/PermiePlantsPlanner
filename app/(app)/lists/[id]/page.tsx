import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import ListItemActions from './ListItemActions'
import CopyShareUrl from './CopyShareUrl'
import type { Plant } from '@/lib/types'

export default async function ListEditorPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { id } = await params
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: list } = await supabase
    .from('plant_lists')
    .select('*')
    .eq('id', id)
    .eq('owner_id', user.id)
    .single()

  if (!list) notFound()

  const { data: items } = await supabase
    .from('plant_list_items')
    .select('*, plant:plants(*)')
    .eq('list_id', list.id)
    .order('sort_order')

  const shareUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/presents/${list.share_id}`

  return (
    <div className="bg-parchment min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Breadcrumb */}
        <Link href="/lists" className="text-sm text-warm-stone hover:text-warm-umber transition-colors">
          ← My Lists
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between mt-4 mb-8 gap-6">
          <div>
            <h1 className="font-playfair text-3xl font-bold text-dark-bark leading-tight">{list.title}</h1>
            {list.description && <p className="text-warm-umber text-sm mt-1">{list.description}</p>}
            <p className="text-xs text-warm-stone mt-1.5">{items?.length ?? 0} plants</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <CopyShareUrl url={shareUrl} />
            <Link
              href={`/presents/${list.share_id}`}
              target="_blank"
              className="text-sm font-semibold bg-forest text-white px-4 py-2 rounded-lg hover:bg-forest-dark transition-colors whitespace-nowrap"
            >
              View presentation ↗
            </Link>
          </div>
        </div>

        {/* Plant list */}
        {!items || items.length === 0 ? (
          <div className="text-center py-20 bg-cream rounded-2xl border border-warm-stone/20">
            <div className="w-14 h-14 bg-forest/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🌱</span>
            </div>
            <p className="font-playfair text-lg font-semibold text-dark-bark">No plants yet</p>
            <p className="text-warm-umber text-sm mt-1 mb-5">Add plants from the database to build your list.</p>
            <Link href="/plants" className="inline-flex items-center gap-2 text-sm font-semibold text-forest border border-forest/40 px-5 py-2.5 rounded-lg hover:bg-forest hover:text-white transition-colors">
              Browse Plants →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const plant = item.plant as Plant
              if (!plant) return null
              return (
                <div key={item.id} className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm p-4 flex items-center gap-4">
                  {/* Drag handle */}
                  <div className="text-warm-stone/40 flex-shrink-0 select-none leading-none text-lg cursor-grab">⠿</div>
                  {/* Thumbnail */}
                  <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-gradient-to-br from-forest/10 to-sage-mist/20">
                    {plant.image_url && (
                      <Image src={plant.image_url} alt={plant.common_name} fill className="object-cover" unoptimized sizes="64px" />
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-dark-bark text-sm leading-snug">{plant.common_name}</p>
                    {plant.latin_name && <p className="text-xs italic text-warm-umber mt-0.5">{plant.latin_name}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {plant.sun && (
                        <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full capitalize">
                          {plant.sun}
                        </span>
                      )}
                      {plant.water && (
                        <span className="text-xs font-medium bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full capitalize">
                          {plant.water} water
                        </span>
                      )}
                    </div>
                  </div>
                  <ListItemActions itemId={item.id} listId={list.id} />
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Link href="/plants" className="text-sm font-medium text-forest hover:underline">
            + Add more plants from the database
          </Link>
        </div>
      </div>
    </div>
  )
}
