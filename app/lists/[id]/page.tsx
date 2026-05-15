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
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/lists" className="text-sm text-gray-400 hover:text-gray-600">← My Lists</Link>
      </div>
      <div className="flex items-start justify-between mb-8 mt-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{list.title}</h1>
          {list.description && <p className="text-gray-500 text-sm mt-1">{list.description}</p>}
          <p className="text-xs text-gray-400 mt-1">{items?.length ?? 0} plants</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <CopyShareUrl url={shareUrl} />
          <Link
            href={`/presents/${list.share_id}`}
            target="_blank"
            className="text-sm font-medium bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors"
          >
            View presentation ↗
          </Link>
        </div>
      </div>

      {!items || items.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <span className="text-4xl">🌱</span>
          <p className="text-gray-500 mt-4">No plants yet.</p>
          <Link href="/plants" className="inline-block mt-4 text-sm font-medium text-green-700 hover:underline">
            Browse the plant database →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const plant = item.plant as Plant
            if (!plant) return null
            return (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
                <div className="relative w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden bg-green-50">
                  {plant.image_url ? (
                    <Image src={plant.image_url} alt={plant.common_name} fill className="object-cover" unoptimized sizes="64px" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-2xl">🌿</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">{plant.common_name}</p>
                  {plant.latin_name && <p className="text-xs italic text-gray-400">{plant.latin_name}</p>}
                  <div className="flex gap-2 mt-1">
                    {plant.sun && <span className="text-xs text-gray-500 capitalize">{plant.sun}</span>}
                    {plant.water && <span className="text-xs text-gray-400">· {plant.water} water</span>}
                  </div>
                </div>
                <ListItemActions itemId={item.id} listId={list.id} />
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/plants" className="text-sm font-medium text-green-700 hover:underline">
          + Add more plants from the database
        </Link>
      </div>
    </div>
  )
}
