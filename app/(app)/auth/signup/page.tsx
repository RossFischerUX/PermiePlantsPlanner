'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SignupPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
  }

  if (done) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-parchment">
        <div className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm p-10 w-full max-w-md text-center">
          <div className="w-14 h-14 bg-forest/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">✉</span>
          </div>
          <h2 className="font-playfair text-xl font-bold text-dark-bark">Check your email</h2>
          <p className="text-warm-umber text-sm mt-2">We sent a confirmation link to <strong className="text-dark-bark">{email}</strong>. Click it to activate your account.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-parchment">
      <div className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warm-stone mb-3">Permaculture Plant Picker</p>
          <h1 className="font-playfair text-2xl font-bold text-dark-bark">Create your account</h1>
          <p className="text-warm-umber text-sm mt-1">Start building plant lists in seconds</p>
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
              minLength={6}
              className="w-full px-4 py-3 border border-warm-stone/30 rounded-lg bg-stone-white text-sm focus:outline-none focus:ring-2 focus:ring-forest"
              placeholder="Min. 6 characters"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest text-white font-semibold py-3 rounded-lg hover:bg-forest-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="text-center text-sm text-warm-umber mt-6">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-forest font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
