'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/lists')
    router.refresh()
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-parchment">
      <div className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warm-stone mb-3">Permaculture Plant Picker</p>
          <h1 className="font-playfair text-2xl font-bold text-dark-bark">Welcome back</h1>
          <p className="text-warm-umber text-sm mt-1">Sign in to your account</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-bark mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 border border-warm-stone/30 rounded-lg bg-stone-white text-sm focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-dark-bark mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-warm-stone/30 rounded-lg bg-stone-white text-sm focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="••••••••"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest text-white font-semibold py-3 rounded-lg hover:bg-forest-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="text-center text-sm text-warm-umber mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/auth/signup" className="text-forest font-medium hover:underline">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
