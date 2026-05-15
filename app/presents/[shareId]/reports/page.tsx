import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Plant } from '@/lib/types'

export default async function ReportsPage({ params }: { params: { shareId: string } }) {
  const supabase = await createClient()
  const { shareId } = await params

  const { data: list } = await supabase
    .from('plant_lists')
    .select('*')
    .eq('share_id', shareId)
    .single()

  if (!list) notFound()

  const { data: items } = await supabase
    .from('plant_list_items')
    .select('*, plant:plants(*)')
    .eq('list_id', list.id)
    .order('sort_order')

  const plants: Plant[] = (items ?? []).map((i: { plant: Plant }) => i.plant).filter(Boolean)

  const byWater: Record<string, Plant[]> = {}
  plants.forEach(p => {
    const key = p.water ?? 'Unknown'
    byWater[key] = [...(byWater[key] ?? []), p]
  })

  const byMonth: Record<string, Plant[]> = {}
  plants.forEach(p => {
    (p.bloom_months ?? []).forEach(m => {
      byMonth[m] = [...(byMonth[m] ?? []), p]
    })
  })

  const bySeason: Record<string, Plant[]> = {}
  plants.forEach(p => {
    (p.season_of_interest ?? []).forEach(s => {
      bySeason[s] = [...(bySeason[s] ?? []), p]
    })
  })

  const MONTH_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const SEASON_ORDER = ['Spring', 'Summer', 'Fall', 'Winter']

  const waterBadge = (level: string) => {
    const styles: Record<string, string> = {
      low: 'bg-sage-mist/30 text-forest',
      moderate: 'bg-teal-100 text-teal-800',
      high: 'bg-blue-100 text-blue-800',
    }
    return styles[level] ?? 'bg-stone-100 text-warm-umber'
  }

  return (
    <div className="min-h-screen bg-parchment">
      {/* Presentation header */}
      <header className="bg-parchment border-b border-warm-stone/20 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <h1 className="font-playfair text-2xl font-bold text-dark-bark leading-snug">{list.title}</h1>
              {list.description && <p className="text-warm-umber text-sm mt-1">{list.description}</p>}
              <p className="text-xs text-warm-stone mt-1">{plants.length} plant{plants.length !== 1 ? 's' : ''}</p>
            </div>
            <Link href="/" className="flex-shrink-0 text-xs font-semibold uppercase tracking-[0.1em] text-forest hover:text-forest-dark transition-colors mt-1">
              🌿 Permaculture Plant Picker
            </Link>
          </div>
          {/* Tabs */}
          <div className="flex gap-6 mt-4 border-b border-warm-stone/20 -mb-px">
            <Link
              href={`/presents/${shareId}`}
              className="pb-3 text-sm font-medium text-warm-umber hover:text-dark-bark border-b-2 border-transparent transition-colors"
            >
              Plants
            </Link>
            <span className="pb-3 text-sm font-semibold text-forest border-b-2 border-forest">
              Reports
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* By Water Requirements */}
        <section>
          <h2 className="font-playfair text-xl font-semibold text-dark-bark mb-4">By Water Requirements</h2>
          <div className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-white border-b border-warm-stone/15">
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-warm-stone">Plant</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-warm-stone">Latin Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-warm-stone">Water</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-warm-stone">Sun</th>
                </tr>
              </thead>
              <tbody>
                {['low', 'moderate', 'high'].flatMap(level =>
                  (byWater[level] ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-warm-stone/10 hover:bg-parchment/60 transition-colors">
                      <td className="px-6 py-3 font-medium text-dark-bark">{p.common_name}</td>
                      <td className="px-6 py-3 italic text-warm-umber text-xs">{p.latin_name ?? '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${waterBadge(level)}`}>
                          {level}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-warm-umber capitalize text-xs">{p.sun ?? '—'}</td>
                    </tr>
                  ))
                )}
                {Object.keys(byWater).length === 0 && (
                  <tr><td colSpan={4} className="px-6 py-8 text-warm-stone text-center">No water data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* By Bloom Month */}
        <section>
          <h2 className="font-playfair text-xl font-semibold text-dark-bark mb-4">By Bloom Month</h2>
          <div className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-white border-b border-warm-stone/15">
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-warm-stone w-36">Month</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-warm-stone">Plants in Bloom</th>
                </tr>
              </thead>
              <tbody>
                {MONTH_ORDER.filter(m => byMonth[m]).map(month => (
                  <tr key={month} className="border-b border-warm-stone/10 hover:bg-parchment/60 transition-colors">
                    <td className="px-6 py-3 font-medium text-dark-bark">{month}</td>
                    <td className="px-6 py-3 text-warm-umber">{byMonth[month].map(p => p.common_name).join(', ')}</td>
                  </tr>
                ))}
                {Object.keys(byMonth).length === 0 && (
                  <tr><td colSpan={2} className="px-6 py-8 text-warm-stone text-center">No bloom month data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* By Season of Interest */}
        <section>
          <h2 className="font-playfair text-xl font-semibold text-dark-bark mb-4">By Season of Interest</h2>
          <div className="bg-cream rounded-2xl border border-warm-stone/20 shadow-warm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-white border-b border-warm-stone/15">
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-warm-stone w-36">Season</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold uppercase tracking-wider text-warm-stone">Plants</th>
                </tr>
              </thead>
              <tbody>
                {SEASON_ORDER.filter(s => bySeason[s]).map(season => (
                  <tr key={season} className="border-b border-warm-stone/10 hover:bg-parchment/60 transition-colors">
                    <td className="px-6 py-3 font-medium text-dark-bark">{season}</td>
                    <td className="px-6 py-3 text-warm-umber">{bySeason[season].map(p => p.common_name).join(', ')}</td>
                  </tr>
                ))}
                {Object.keys(bySeason).length === 0 && (
                  <tr><td colSpan={2} className="px-6 py-8 text-warm-stone text-center">No season data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>

      <footer className="border-t border-warm-stone/20 mt-10">
        <div className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
          <p className="text-xs text-warm-stone">© 2026 Permaculture Plant Picker. All rights reserved.</p>
          <Link href="/" className="text-xs font-semibold text-forest hover:underline">
            Permaculture Plant Picker
          </Link>
        </div>
      </footer>
    </div>
  )
}
