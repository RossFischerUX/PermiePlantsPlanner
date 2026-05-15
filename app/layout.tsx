import type { Metadata } from 'next'
import { Playfair_Display, Inter } from 'next/font/google'
import Link from 'next/link'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import NavUser from './NavUser'

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Permaculture Plant Picker',
  description: 'Plant presentation software for landscape professionals',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en" className={`${playfair.variable} ${inter.variable}`}>
      <body className="min-h-screen bg-parchment font-inter">
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
      </body>
    </html>
  )
}
