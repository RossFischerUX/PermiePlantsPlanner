'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PlantList } from '@/lib/types'

export default function AddToListClient({ plantId }: { plantId: string }) {
  const supabase = createClient()
  const [lists, setLists] = useState<PlantList[]>([])
  const [showMenu, setShowMenu] = useState(false)
  const [memberListIds, setMemberListIds] = useState<Set<string>>(new Set())
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

  useEffect(() => {
    if (!showMenu || lists.length === 0) return
    supabase
      .from('plant_list_items')
      .select('list_id')
      .eq('plant_id', plantId)
      .then(({ data }) => {
        setMemberListIds(new Set(data?.map(r => r.list_id) ?? []))
      })
  }, [showMenu, plantId, lists.length])

  if (!ready || lists.length === 0) return null

  async function handleToggle(listId: string) {
    if (memberListIds.has(listId)) {
      await supabase.from('plant_list_items').delete().eq('list_id', listId).eq('plant_id', plantId)
      setMemberListIds(prev => { const next = new Set(prev); next.delete(listId); return next })
    } else {
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
      setMemberListIds(prev => new Set(prev).add(listId))
    }
  }

  const inAnyList = memberListIds.size > 0

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        className="text-sm font-medium bg-forest text-white px-5 py-2.5 rounded-lg hover:bg-forest-dark transition-colors whitespace-nowrap"
      >
        {inAnyList ? '✓ In a list' : '+ Add to list'}
      </button>
      {showMenu && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-cream border border-warm-stone/30 rounded-xl shadow-warm z-10 overflow-hidden">
          {lists.map(list => {
            const isMember = memberListIds.has(list.id)
            return (
              <button
                key={list.id}
                onClick={() => handleToggle(list.id)}
                className="w-full flex items-center gap-3 text-left text-sm px-4 py-3 hover:bg-stone-white border-b last:border-0 border-warm-stone/20 transition-colors"
              >
                <span className="w-4 flex-shrink-0 text-forest">{isMember ? '✓' : ''}</span>
                <span className={isMember ? 'text-forest font-medium' : 'text-dark-bark'}>{list.title}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
