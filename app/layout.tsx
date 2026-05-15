import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { createClient } from '@/lib/supabase/server'
import NavUser from './NavUser'

export const metadata: Metadata = {
  title: 'PlantMaster',
  description: 'Plant presentation software for landscape professionals',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-8">
                <Link href="/" className="flex items-center gap-2">
                  <span className="text-2xl">🌿</span>
                  <span className="font-bold text-gray-900 text-lg">PlantMaster</span>
                </Link>
                <div className="hidden sm:flex items-center gap-6">
                  <Link href="/plants" className="text-sm font-medium text-gray-600 hover:text-green-700 transition-colors">
                    Plant Database
                  </Link>
                  {user && (
                    <Link href="/lists" className="text-sm font-medium text-gray-600 hover:text-green-700 transition-colors">
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
