'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const redirectTo = `${window.location.origin}/api/auth/callback?next=/auth/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
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
          <p className="text-warm-umber text-sm mt-2">
            We sent a password reset link to <strong className="text-dark-bark">{email}</strong>.
          </p>
          <p className="text-warm-umber text-sm mt-1">
            Click it to choose a new password.
          </p>
          <div className="mt-6">
            <Link href="/auth/login" className="text-sm text-forest font-medium hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-parchment">
      <div className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-warm-stone mb-3">Permaculture Plant Picker</p>
          <h1 className="font-playfair text-2xl font-bold text-dark-bark">Reset your password</h1>
          <p className="text-warm-umber text-sm mt-1">Enter your email and we&apos;ll send you a reset link</p>
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
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest text-white font-semibold py-3 rounded-lg hover:bg-forest-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Sending reset link…' : 'Send reset link'}
          </button>
        </form>
        <p className="text-center text-sm text-warm-umber mt-6">
          Remember your password?{' '}
          <Link href="/auth/login" className="text-forest font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
