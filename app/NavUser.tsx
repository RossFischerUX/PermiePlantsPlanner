'use client'

import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import type { User } from '@supabase/supabase-js'

export default function NavUser({ user }: { user: User | null }) {
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth/signout')
  }

  if (!user) {
    return (
      <div className="flex items-center gap-3">
        <Link href="/auth/login" className="text-sm font-medium text-gray-600 hover:text-gray-900">
          Log in
        </Link>
        <Link href="/auth/signup" className="text-sm font-medium bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition-colors">
          Sign up
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-gray-500 hidden sm:block">{user.email}</span>
      <button
        onClick={handleSignOut}
        className="text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        Sign out
      </button>
    </div>
  )
}
