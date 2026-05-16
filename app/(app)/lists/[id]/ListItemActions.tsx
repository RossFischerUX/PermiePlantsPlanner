'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export default function ListItemActions({ itemId, listId }: { itemId: string; listId: string }) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRemove() {
    if (!confirm('Remove this plant from the list?')) return
    setLoading(true)
    await supabase.from('plant_list_items').delete().eq('id', itemId)
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={handleRemove}
      disabled={loading}
      aria-label="Remove"
      className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg text-warm-stone/50 hover:text-terracotta hover:bg-terracotta/10 transition-colors disabled:opacity-40 text-xl leading-none"
    >
      {loading ? '…' : '×'}
    </button>
  )
}
