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
        <Link href="/auth/login" className="text-sm font-medium text-warm-umber hover:text-dark-bark transition-colors">
          Log in
        </Link>
        <Link href="/auth/signup" className="text-sm font-medium bg-forest text-white px-4 py-2 rounded-lg hover:bg-forest-dark transition-colors">
          Sign up
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-warm-stone hidden sm:block">{user.email}</span>
      <button
        onClick={handleSignOut}
        className="text-sm font-medium text-warm-umber hover:text-dark-bark transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
