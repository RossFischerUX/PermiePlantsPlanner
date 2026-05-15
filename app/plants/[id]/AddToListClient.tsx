'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PlantList } from '@/lib/types'

export default function AddToListClient({ plantId }: { plantId: string }) {
  const supabase = createClient()
  const [lists, setLists] = useState<PlantList[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [added, setAdded] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('plant_lists')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
      setLists(data ?? [])
      setReady(true)
    }
    load()
  }, [])

  if (!ready || lists.length === 0) return null

  async function handleAdd(listId: string) {
    const { data: existing } = await supabase
      .from('plant_list_items')
      .select('id')
      .eq('list_id', listId)
      .eq('plant_id', plantId)
      .single()
    if (existing) { setAdded(true); setShowMenu(false); return }
    const { data: max } = await supabase
      .from('plant_list_items')
      .select('sort_order')
      .eq('list_id', listId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    await supabase.from('plant_list_items').insert({
      list_id: listId,
      plant_id: plantId,
      sort_order: (max?.sort_order ?? -1) + 1,
    })
    setAdded(true)
    setShowMenu(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        className="text-sm font-medium bg-green-700 text-white px-5 py-2.5 rounded-lg hover:bg-green-800 transition-colors"
      >
        {added ? '✓ Added to list' : '+ Add to list'}
      </button>
      {showMenu && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
          {lists.map(list => (
            <button
              key={list.id}
              onClick={() => handleAdd(list.id)}
              className="w-full text-left text-sm px-4 py-3 hover:bg-green-50 text-gray-700 border-b last:border-0 border-gray-100"
            >
              {list.title}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
