import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import NewListForm from './NewListForm'

export default async function ListsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: lists } = await supabase
    .from('plant_lists')
    .select('*, plant_list_items(count)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="bg-parchment min-h-screen">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warm-stone mb-2">Dashboard</p>
          <h1 className="font-playfair text-3xl font-bold text-dark-bark">My Lists</h1>
        </div>

        <NewListForm />

        {lists && lists.length > 0 ? (
          <div className="grid sm:grid-cols-2 gap-4 mt-8">
            {lists.map((list) => {
              const count = (list.plant_list_items as { count: number }[])?.[0]?.count ?? 0
              return (
                <div key={list.id} className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm p-6 hover:shadow-warm-md transition-shadow">
                  <div className="mb-3">
                    <h2 className="font-playfair font-semibold text-dark-bark text-lg">{list.title}</h2>
                    {list.description && <p className="text-warm-umber text-sm mt-0.5">{list.description}</p>}
                    <p className="text-xs text-warm-stone mt-1">{count} plant{count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Link
                      href={`/lists/${list.id}`}
                      className="text-sm font-medium text-forest border border-forest/30 px-3 py-1.5 rounded-lg hover:bg-forest hover:text-white transition-colors"
                    >
                      Edit list
                    </Link>
                    <Link
                      href={`/presents/${list.share_id}`}
                      className="text-sm font-medium text-warm-umber border border-warm-stone/30 px-3 py-1.5 rounded-lg hover:bg-warm-stone/10 transition-colors"
                      target="_blank"
                    >
                      View presentation ↗
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-8 text-center py-20 bg-cream rounded-2xl border border-warm-stone/20">
            <div className="w-14 h-14 bg-forest/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🌱</span>
            </div>
            <p className="font-playfair text-lg font-semibold text-dark-bark">No lists yet</p>
            <p className="text-warm-umber text-sm mt-1 mb-5">Create your first one above, or browse the plant database.</p>
            <Link
              href="/plants"
              className="inline-flex items-center gap-2 text-sm font-semibold text-forest border border-forest/40 px-5 py-2.5 rounded-lg hover:bg-forest hover:text-white transition-colors"
            >
              Browse Plants →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
