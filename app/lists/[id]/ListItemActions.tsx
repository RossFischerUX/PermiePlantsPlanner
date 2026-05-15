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
      className="text-xs text-red-400 hover:text-red-600 font-medium px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40"
    >
      {loading ? '…' : 'Remove'}
    </button>
  )
}
