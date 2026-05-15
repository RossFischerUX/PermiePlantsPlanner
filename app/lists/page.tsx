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
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Lists</h1>
      </div>

      <NewListForm />

      {lists && lists.length > 0 ? (
        <div className="grid sm:grid-cols-2 gap-4 mt-8">
          {lists.map((list) => {
            const count = (list.plant_list_items as { count: number }[])?.[0]?.count ?? 0
            return (
              <div key={list.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg">{list.title}</h2>
                    {list.description && <p className="text-gray-500 text-sm mt-0.5">{list.description}</p>}
                    <p className="text-xs text-gray-400 mt-1">{count} plant{count !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <Link
                    href={`/lists/${list.id}`}
                    className="text-sm font-medium text-green-700 hover:text-green-800 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 transition-colors"
                  >
                    Edit list
                  </Link>
                  <Link
                    href={`/presents/${list.share_id}`}
                    className="text-sm font-medium text-gray-600 hover:text-gray-800 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
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
        <div className="mt-8 text-center py-20 bg-white rounded-2xl border border-gray-100">
          <span className="text-4xl">🌱</span>
          <p className="text-gray-500 mt-4">No lists yet. Create your first one above.</p>
        </div>
      )}
    </div>
  )
}
