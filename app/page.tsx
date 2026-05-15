import Link from 'next/link'

const features = [
  { icon: '🌱', title: 'Comprehensive Plant Database', desc: 'Browse 36+ characteristics including sun, water, soil, size, and bloom time.' },
  { icon: '🔍', title: 'Powerful Search & Filter', desc: 'Find the perfect plant by cross-referencing type, bloom month, and water needs.' },
  { icon: '📋', title: 'Easy List Building', desc: 'Organize plants into named lists by project area — front yard, patio, slopes.' },
  { icon: '🔗', title: 'Shareable Presentations', desc: 'Auto-generate a shareable mini-site showcasing your curated plant selection.' },
  { icon: '📊', title: 'Instant Reports', desc: 'Filter your list by bloom month, water requirements, and season of interest.' },
  { icon: '🌿', title: 'Native Plant Focus', desc: 'Curated with California natives and Mediterranean plants for low-water gardens.' },
]

export default function HomePage() {
  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-green-800 to-green-600 text-white py-24 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold mb-6 leading-tight">
            Plant presentation software<br />for landscape professionals
          </h1>
          <p className="text-xl text-green-100 mb-10 max-w-2xl mx-auto">
            Build curated plant lists, share them as beautiful mini-sites, and generate instant reports — all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup" className="bg-white text-green-800 font-semibold px-8 py-4 rounded-xl hover:bg-green-50 transition-colors text-lg">
              Get Started Free
            </Link>
            <Link href="/plants" className="border-2 border-white text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors text-lg">
              Browse Plants
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-4">Everything you need</h2>
          <p className="text-gray-500 text-center mb-14">From search to shareable presentation in minutes.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map(f => (
              <div key={f.title} className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-green-50 border-t border-green-100 py-20 px-6 text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to build your first plant list?</h2>
        <p className="text-gray-500 mb-8">Create an account and start browsing our plant database today.</p>
        <Link href="/auth/signup" className="bg-green-700 text-white font-semibold px-10 py-4 rounded-xl hover:bg-green-800 transition-colors text-lg">
          Create Free Account
        </Link>
      </section>
    </div>
  )
}
