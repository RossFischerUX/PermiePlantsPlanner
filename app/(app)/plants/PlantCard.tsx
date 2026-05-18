'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Plant, PlantList } from '@/lib/types'
import { SUN_ICONS, WATER_ICONS } from '@/lib/plant-labels'

export default function PlantCard({ plant, lists, onAddToList, onRemoveFromList, onOpenCreateList }: {
  plant: Plant
  lists: PlantList[]
  onAddToList: (plantId: string, listId: string) => void
  onRemoveFromList: (plantId: string, listId: string) => void
  onOpenCreateList: (plantId: string) => void
}) {
  const [showMenu, setShowMenu] = useState(false)
  const [added, setAdded] = useState(false)
  const [memberListIds, setMemberListIds] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  useEffect(() => {
    if (!showMenu || lists.length === 0) return
    const supabase = createClient()
    supabase
      .from('plant_list_items')
      .select('list_id')
      .eq('plant_id', plant.id)
      .then(({ data }) => {
        setMemberListIds(new Set(data?.map(r => r.list_id) ?? []))
      })
  }, [showMenu, plant.id, lists.length])

  const sizeLabel = plant.height_min && plant.height_max
    ? `${plant.height_min}–${plant.height_max}′ tall`
    : null

  return (
    <div className="bg-cream rounded-2xl border border-warm-stone/30 shadow-warm overflow-hidden hover:shadow-warm-md transition-shadow duration-200">
      <div className="relative h-52 bg-stone-white">
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
          <div className="flex items-center justify-center h-full text-5xl opacity-30">🌿</div>
        )}
      </div>
      <div className="p-5">
        <h3 className="font-playfair text-xl font-semibold text-dark-bark mb-0.5 leading-snug">{plant.common_name}</h3>
        {plant.latin_name && (
          <p className="text-sm italic text-warm-umber mb-3">{plant.latin_name}</p>
        )}

        <div className="flex flex-wrap gap-1.5 mb-3">
          {plant.sun && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full border border-amber-200 whitespace-nowrap">
              {SUN_ICONS[plant.sun]} {plant.sun}
            </span>
          )}
          {plant.water && (
            <span className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-800 px-2.5 py-1 rounded-full border border-teal-200 whitespace-nowrap">
              {WATER_ICONS[plant.water]} water
            </span>
          )}
          {sizeLabel && (
            <span className="inline-flex items-center text-xs bg-stone-white text-warm-umber px-2.5 py-1 rounded-full border border-warm-stone/20 whitespace-nowrap">
              {sizeLabel}
            </span>
          )}
        </div>

        {plant.description && (
          <p className="text-sm text-warm-stone leading-relaxed line-clamp-3 mb-4">{plant.description}</p>
        )}

        {lists.length > 0 && (
          <div ref={menuRef} className="relative" onClick={e => e.preventDefault()}>
            <button
              onClick={e => { e.preventDefault(); setShowMenu(v => !v) }}
              className="w-full text-sm font-medium border border-forest text-forest py-2 rounded-lg hover:bg-forest hover:text-white transition-colors duration-150"
            >
              {added ? '✓ Added' : '+ Add to list'}
            </button>
            {showMenu && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-cream border border-warm-stone/30 rounded-xl shadow-warm-md z-10 overflow-hidden">
                {lists.map(list => {
                  const isMember = memberListIds.has(list.id)
                  return (
                    <button
                      key={list.id}
                      onClick={e => {
                        e.preventDefault()
                        if (isMember) {
                          onRemoveFromList(plant.id, list.id)
                          setMemberListIds(prev => { const next = new Set(prev); next.delete(list.id); return next })
                        } else {
                          onAddToList(plant.id, list.id)
                          setMemberListIds(prev => { const next = new Set(prev); next.add(list.id); return next })
                          setAdded(true)
                        }
                        setTimeout(() => setShowMenu(false), 550)
                      }}
                      className="w-full flex items-center gap-3 text-left text-sm px-4 py-3 hover:bg-stone-white border-b border-warm-stone/20 transition-colors"
                    >
                      <span className="w-4 flex-shrink-0 text-forest">{isMember ? '✓' : ''}</span>
                      <span className={isMember ? 'text-forest font-medium' : 'text-dark-bark'}>{list.title}</span>
                    </button>
                  )
                })}
                <button
                  onClick={e => {
                    e.preventDefault()
                    setShowMenu(false)
                    onOpenCreateList(plant.id)
                  }}
                  className="w-full text-left text-sm px-4 py-3 hover:bg-stone-white text-forest font-medium transition-colors"
                >
                  + New list…
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
