'use client'

import { useState, useTransition, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import PlantCard from './PlantCard'
import ActiveFilterChips from './ActiveFilterChips'
import { fetchMorePlants } from './actions'
import type { Plant, PlantList } from '@/lib/types'
import type { PlantSearchParams } from './searchParams'

type Props = {
  initialPlants: Plant[]
  totalCount: number
  filterParams: PlantSearchParams
  lists: PlantList[]
}

export default function PlantsGrid({ initialPlants, totalCount, filterParams, lists }: Props) {
  const [plants, setPlants] = useState(initialPlants)
  const [isPending, startTransition] = useTransition()
  const [createModalPlantId, setCreateModalPlantId] = useState<string | null>(null)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])
  const [newListName, setNewListName] = useState('')
  const [newListDesc, setNewListDesc] = useState('')
  const [creatingList, setCreatingList] = useState(false)
  const [localLists, setLocalLists] = useState(lists)

  const hasMore = plants.length < totalCount

  async function handleLoadMore() {
    startTransition(async () => {
      const next = await fetchMorePlants(filterParams, plants.length)
      setPlants(prev => [...prev, ...next])
    })
  }

  async function handleRemoveFromList(plantId: string, listId: string) {
    const supabase = createClient()
    await supabase.from('plant_list_items').delete().eq('list_id', listId).eq('plant_id', plantId)
  }

  async function handleAddToList(plantId: string, listId: string) {
    const supabase = createClient()
    const { data: existing } = await supabase
      .from('plant_list_items')
      .select('id')
      .eq('list_id', listId)
      .eq('plant_id', plantId)
      .single()
    if (existing) return
    const { data: max } = await supabase
      .from('plant_list_items')
      .select('sort_order')
      .eq('list_id', listId)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()
    const nextOrder = (max?.sort_order ?? -1) + 1
    await supabase
      .from('plant_list_items')
      .insert({ list_id: listId, plant_id: plantId, sort_order: nextOrder })
  }

  async function handleCreateList() {
    const plantId = createModalPlantId
    if (!newListName.trim() || !plantId) return
    setCreatingList(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setCreatingList(false); return }
    const { data: newList } = await supabase
      .from('plant_lists')
      .insert({ owner_id: user.id, title: newListName.trim(), description: newListDesc.trim() || null })
      .select()
      .single()
    if (newList) {
      await handleAddToList(plantId, newList.id)
      setLocalLists(prev => [newList, ...prev])
    }
    setCreateModalPlantId(null)
    setNewListName('')
    setNewListDesc('')
    setCreatingList(false)
  }

  return (
    <>
      {createModalPlantId && (
        <div
          className="fixed inset-0 bg-dark-bark/40 z-50 flex items-center justify-center p-4"
          onClick={() => { setCreateModalPlantId(null); setNewListName(''); setNewListDesc('') }}
        >
          <div
            className="bg-cream rounded-2xl p-6 w-full max-w-sm shadow-warm-md border border-warm-stone/30"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="font-playfair text-xl font-semibold text-dark-bark mb-4">New Plant List</h2>
            <div className="mb-3">
              <label className="block text-[11px] font-semibold text-warm-stone uppercase tracking-[0.05em] mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                placeholder="My garden plan"
                autoFocus
                className="w-full px-3 py-2 border border-warm-stone/40 rounded-lg text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest"
              />
            </div>
            <div className="mb-5">
              <label className="block text-[11px] font-semibold text-warm-stone uppercase tracking-[0.05em] mb-1.5">
                Description{' '}
                <span className="text-warm-stone/60 font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <textarea
                value={newListDesc}
                onChange={e => setNewListDesc(e.target.value)}
                placeholder="What is this list for?"
                rows={2}
                className="w-full px-3 py-2 border border-warm-stone/40 rounded-lg text-sm text-dark-bark bg-stone-white focus:outline-none focus:ring-2 focus:ring-forest/30 focus:border-forest resize-none"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setCreateModalPlantId(null); setNewListName(''); setNewListDesc('') }}
                className="flex-1 text-sm font-medium text-warm-umber py-2 rounded-lg border border-warm-stone/40 hover:bg-stone-white transition-colors"
              >
                Discard Changes
              </button>
              <button
                onClick={handleCreateList}
                disabled={!newListName.trim() || creatingList}
                className="flex-1 text-sm font-medium bg-forest text-white py-2 rounded-lg hover:bg-forest-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creatingList ? 'Creating…' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ActiveFilterChips />

      {plants.length > 0 && (
        <p className="text-sm font-normal text-warm-umber mb-5">
          Showing {plants.length} of {totalCount} plant{totalCount !== 1 ? 's' : ''}
        </p>
      )}

      {plants.length === 0 ? (
        <div className="py-20 text-center flex flex-col items-center gap-4">
          <p className="text-base text-warm-umber">No plants match your filters.</p>
          <p className="text-sm text-warm-stone">Try removing a filter to broaden your search.</p>
          <ActiveFilterChips />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
          {plants.map(plant => (
            <Link key={plant.id} href={`/plants/${plant.id}`} className="block">
              <PlantCard
                plant={plant}
                lists={localLists}
                onAddToList={handleAddToList}
                onRemoveFromList={handleRemoveFromList}
                onOpenCreateList={setCreateModalPlantId}
              />
            </Link>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="mt-10 text-center">
          <button
            onClick={handleLoadMore}
            disabled={isPending}
            className="text-sm font-medium border border-warm-stone/40 text-warm-umber py-2 px-6 rounded-lg hover:bg-stone-white transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? 'Loading…' : 'Load more plants'}
          </button>
        </div>
      ) : totalCount > 24 ? (
        <p className="text-sm text-warm-stone text-center mt-10">All {totalCount} plants loaded</p>
      ) : null}
    </>
  )
}
