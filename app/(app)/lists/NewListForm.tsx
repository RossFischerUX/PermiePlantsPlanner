'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function NewListForm() {
  const supabase = createClient()
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError('')
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not signed in'); setLoading(false); return }
    const { error } = await supabase.from('plant_lists').insert({
      title: title.trim(),
      description: description.trim() || null,
      owner_id: user.id,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setTitle('')
    setDescription('')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm p-6">
      <h2 className="font-playfair font-semibold text-dark-bark mb-4">Create a new list</h2>
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="List name (e.g. Front Yard — Drought Tolerant)"
          required
          className="flex-1 px-4 py-2.5 border border-warm-stone/30 rounded-lg bg-stone-white text-sm focus:outline-none focus:ring-2 focus:ring-forest"
        />
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="flex-1 px-4 py-2.5 border border-warm-stone/30 rounded-lg bg-stone-white text-sm focus:outline-none focus:ring-2 focus:ring-forest"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-forest text-white font-medium px-6 py-2.5 rounded-lg hover:bg-forest-dark transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? 'Creating…' : 'Create list'}
        </button>
      </div>
      {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
    </form>
  )
}
