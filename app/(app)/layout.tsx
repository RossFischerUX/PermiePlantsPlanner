import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NavUser from './NavUser'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <>
      <nav className="bg-parchment border-b border-warm-stone/30 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <span className="font-playfair font-bold text-dark-bark text-xl tracking-tight">Permaculture Plant Picker</span>
              </Link>
              <div className="hidden sm:flex items-center gap-6">
                <Link href="/plants" className="text-sm font-medium text-warm-umber hover:text-forest transition-colors">
                  Plant Database
                </Link>
                {user && (
                  <Link href="/lists" className="text-sm font-medium text-warm-umber hover:text-forest transition-colors">
                    My Lists
                  </Link>
                )}
              </div>
            </div>
            <NavUser user={user} />
          </div>
        </div>
      </nav>
      <main>{children}</main>
      <footer className="bg-forest-dark text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-14">
          <div className="flex flex-col md:flex-row justify-between gap-10">
            <div className="max-w-xs">
              <span className="font-playfair font-bold text-xl tracking-tight">Permaculture Plant Picker</span>
              <p className="text-white/60 text-sm mt-2 leading-relaxed">
                Curating the living heritage of landscape architecture.
              </p>
              <p className="text-white/30 text-xs mt-5">© 2026 Permaculture Plant Picker. All rights reserved.</p>
            </div>
            <div className="flex gap-12 sm:gap-16">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/40 mb-4">App</p>
                <div className="flex flex-col gap-3">
                  <Link href="/plants" className="text-sm text-white/70 hover:text-white transition-colors">Plant Database</Link>
                  <Link href="/lists" className="text-sm text-white/70 hover:text-white transition-colors">My Lists</Link>
                  <Link href="/auth/signup" className="text-sm text-white/70 hover:text-white transition-colors">Sign Up</Link>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-white/40 mb-4">Info</p>
                <div className="flex flex-col gap-3">
                  <Link href="/auth/login" className="text-sm text-white/70 hover:text-white transition-colors">Sign In</Link>
                  <Link href="/plants" className="text-sm text-white/70 hover:text-white transition-colors">Archive</Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
