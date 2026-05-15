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

  // Group by water
  const byWater: Record<string, Plant[]> = {}
  plants.forEach(p => {
    const key = p.water ?? 'Unknown'
    byWater[key] = [...(byWater[key] ?? []), p]
  })

  // Group by bloom month
  const byMonth: Record<string, Plant[]> = {}
  plants.forEach(p => {
    (p.bloom_months ?? []).forEach(m => {
      byMonth[m] = [...(byMonth[m] ?? []), p]
    })
  })

  // Group by season
  const bySeason: Record<string, Plant[]> = {}
  plants.forEach(p => {
    (p.season_of_interest ?? []).forEach(s => {
      bySeason[s] = [...(bySeason[s] ?? []), p]
    })
  })

  const MONTH_ORDER = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const SEASON_ORDER = ['Spring', 'Summer', 'Fall', 'Winter']

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{list.title}</h1>
              {list.description && <p className="text-gray-500 mt-1 text-sm">{list.description}</p>}
              <p className="text-xs text-gray-400 mt-1">{plants.length} plants</p>
            </div>
            <Link href="/" className="flex items-center gap-1.5 text-green-700 text-sm font-medium">
              <span>🌿</span> Permaculture Plant Picker
            </Link>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 mt-6 border-b border-gray-200 -mb-px">
            <Link
              href={`/presents/${shareId}`}
              className="pb-3 text-sm font-medium text-gray-500 hover:text-gray-800 border-b-2 border-transparent"
            >
              Plants
            </Link>
            <span className="pb-3 text-sm font-semibold text-green-700 border-b-2 border-green-700">
              Reports
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-12">

        {/* By Water Requirements */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">By Water Requirements</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plant</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Latin Name</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Water</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sun</th>
                </tr>
              </thead>
              <tbody>
                {['low', 'moderate', 'high'].flatMap(level =>
                  (byWater[level] ?? []).map((p, i) => (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-900">{p.common_name}</td>
                      <td className="px-6 py-3 italic text-gray-400">{p.latin_name ?? '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          level === 'low' ? 'bg-green-50 text-green-700' :
                          level === 'moderate' ? 'bg-blue-50 text-blue-700' :
                          'bg-indigo-50 text-indigo-700'
                        }`}>
                          {level}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-gray-500 capitalize">{p.sun ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* By Bloom Month */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">By Bloom Month</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Month</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plants in Bloom</th>
                </tr>
              </thead>
              <tbody>
                {MONTH_ORDER.filter(m => byMonth[m]).map(month => (
                  <tr key={month} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900 w-32">{month}</td>
                    <td className="px-6 py-3 text-gray-600">{byMonth[month].map(p => p.common_name).join(', ')}</td>
                  </tr>
                ))}
                {Object.keys(byMonth).length === 0 && (
                  <tr><td colSpan={2} className="px-6 py-6 text-gray-400 text-center">No bloom month data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* By Season of Interest */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">By Season of Interest</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Season</th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plants</th>
                </tr>
              </thead>
              <tbody>
                {SEASON_ORDER.filter(s => bySeason[s]).map(season => (
                  <tr key={season} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900 w-32">{season}</td>
                    <td className="px-6 py-3 text-gray-600">{bySeason[season].map(p => p.common_name).join(', ')}</td>
                  </tr>
                ))}
                {Object.keys(bySeason).length === 0 && (
                  <tr><td colSpan={2} className="px-6 py-6 text-gray-400 text-center">No season data available.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  )
}
