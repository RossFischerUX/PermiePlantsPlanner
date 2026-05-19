import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import NavUser from './NavUser'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userLists: { id: string; title: string }[] = []
  if (user) {
    const { data } = await supabase
      .from('plant_lists')
      .select('id, title')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10)
    userLists = data ?? []
  }

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
                  <div className="relative group">
                    <Link
                      href="/lists"
                      className="flex items-center gap-1 text-sm font-medium text-warm-umber hover:text-forest transition-colors py-2"
                    >
                      My Lists
                      <svg className="w-3.5 h-3.5 text-warm-stone transition-transform group-hover:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </Link>
                    <div className="absolute left-0 top-full pt-2 w-64 invisible opacity-0 translate-y-1 group-hover:visible group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:visible group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-150">
                      <div className="bg-cream rounded-lg border border-warm-stone/30 shadow-warm-md py-2 max-h-96 overflow-y-auto">
                        {userLists.length > 0 ? (
                          <>
                            {userLists.map((list) => (
                              <Link
                                key={list.id}
                                href={`/lists/${list.id}`}
                                className="block px-4 py-2 text-sm text-warm-umber hover:bg-stone-white hover:text-forest transition-colors truncate"
                              >
                                {list.title}
                              </Link>
                            ))}
                            <div className="border-t border-warm-stone/20 mt-2 pt-2">
                              <Link
                                href="/lists"
                                className="block px-4 py-2 text-xs font-semibold uppercase tracking-[0.06em] text-warm-stone hover:text-forest transition-colors"
                              >
                                View all lists →
                              </Link>
                            </div>
                          </>
                        ) : (
                          <p className="px-4 py-2 text-sm text-warm-stone">No lists yet</p>
                        )}
                      </div>
                    </div>
                  </div>
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
