import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import type { Plant } from '@/lib/types'

const features = [
  { icon: '🌱', title: 'Comprehensive Plant Database', desc: 'Browse 36+ characteristics including sun, water, soil, size, and bloom time.' },
  { icon: '🔍', title: 'Powerful Search & Filter', desc: 'Find the perfect plant by cross-referencing type, bloom month, and water needs.' },
  { icon: '📋', title: 'Easy List Building', desc: 'Organize plants into named lists by project area — front yard, patio, slopes.' },
  { icon: '🔗', title: 'Shareable Presentations', desc: 'Auto-generate a shareable mini-site showcasing your curated plant selection.' },
  { icon: '📊', title: 'Instant Reports', desc: 'Filter your list by bloom month, water requirements, and season of interest.' },
  { icon: '🌿', title: 'Native Plant Focus', desc: 'Curated with California natives and Mediterranean plants for low-water gardens.' },
]

const SUN_LABELS: Record<string, string> = {
  'full sun': '☀️ Full Sun',
  'part shade': '⛅ Part Shade',
  'full shade': '🌥️ Full Shade',
}

const WATER_LABELS: Record<string, string> = {
  'low': '💧 Low Water',
  'moderate': '💧💧 Moderate',
  'high': '💧💧💧 High',
}

function PlantCard({ plant }: { plant: Plant }) {
  return (
    <Link
      href={`/plants/${plant.id}`}
      className="group block bg-cream rounded-2xl overflow-hidden border border-warm-stone/20 shadow-warm hover:shadow-warm-md transition-shadow"
    >
      <div className="relative h-52 bg-stone-white">
        {plant.image_url ? (
          <Image
            src={plant.image_url}
            alt={plant.common_name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-forest/10 to-sage-mist/20" />
        )}
      </div>
      <div className="p-5">
        <h3 className="font-playfair text-lg font-semibold text-dark-bark mb-1 group-hover:text-forest transition-colors">
          {plant.common_name}
        </h3>
        {plant.latin_name && (
          <p className="text-sm text-warm-umber italic mb-3">{plant.latin_name}</p>
        )}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {plant.sun && (
            <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
              {SUN_LABELS[plant.sun] ?? plant.sun}
            </span>
          )}
          {plant.water && (
            <span className="text-xs font-medium bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full">
              {WATER_LABELS[plant.water] ?? plant.water}
            </span>
          )}
        </div>
        <span className="text-sm font-medium text-forest group-hover:underline">View Plant →</span>
      </div>
    </Link>
  )
}

export default async function HomePage() {
  const supabase = await createClient()
  const [{ data: heroData }, { data: browseData }] = await Promise.all([
    supabase
      .from('plants')
      .select('*')
      .not('image_url', 'is', null)
      .order('common_name')
      .limit(4),
    supabase
      .from('plants')
      .select('*')
      .or('common_name.ilike.%california lilac%,common_name.ilike.%red mulberry%,common_name.ilike.%comfrey%')
      .order('common_name')
      .limit(3),
  ])

  const heroPlants = (heroData ?? []) as Plant[]
  const browsePlants = (browseData ?? []) as Plant[]

  return (
    <div>
      {/* Hero */}
      <section className="bg-forest-dark overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-16">
          <div className="flex flex-col lg:flex-row lg:items-stretch">
            {/* Text */}
            <div className="flex-1 flex flex-col justify-center py-20 lg:py-24 lg:pr-12 text-center lg:text-left">
              <p className="text-sage-mist text-xs font-semibold uppercase tracking-[0.12em] mb-5">
                For Landscape Professionals
              </p>
              <h1 className="font-playfair text-4xl sm:text-5xl lg:text-[3.5rem] font-bold text-white leading-tight mb-6">
                Plant presentation<br className="hidden lg:block" /> software built<br className="hidden lg:block" /> for the field
              </h1>
              <p className="text-white/70 text-lg leading-relaxed mb-8 max-w-lg mx-auto lg:mx-0">
                Build curated plant lists, share them as beautiful mini-sites, and generate instant reports — all in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-8">
                <Link
                  href="/auth/signup"
                  className="bg-white text-forest-dark font-semibold px-8 py-3.5 rounded-lg hover:bg-parchment transition-colors text-sm"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/plants"
                  className="border border-white/40 text-white font-semibold px-8 py-3.5 rounded-lg hover:bg-white/10 transition-colors text-sm"
                >
                  Browse Plants
                </Link>
              </div>
              <div>
                <p className="text-white/40 text-xs uppercase tracking-[0.1em] mb-2 text-center lg:text-left">Specializing in:</p>
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  {['California Natives', 'Permaculture Plants', 'Low Water Requirements'].map(tag => (
                    <span key={tag} className="text-xs text-sage-mist border border-sage-mist/30 bg-white/5 px-3 py-1 rounded-full">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Desktop image mosaic */}
            {heroPlants.length >= 2 && (
              <div className="hidden lg:flex flex-shrink-0 w-[420px] py-10 gap-3">
                <div className="flex flex-col gap-3 flex-1">
                  <div className="relative rounded-2xl overflow-hidden flex-1 min-h-0">
                    <Image
                      src={heroPlants[0].image_url!}
                      alt={heroPlants[0].common_name}
                      fill
                      className="object-cover"
                      sizes="210px"
                    />
                  </div>
                  {heroPlants[1] && (
                    <div className="relative rounded-2xl overflow-hidden h-40">
                      <Image
                        src={heroPlants[1].image_url!}
                        alt={heroPlants[1].common_name}
                        fill
                        className="object-cover"
                        sizes="210px"
                      />
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 flex-1 mt-12">
                  {heroPlants[2] && (
                    <div className="relative rounded-2xl overflow-hidden h-40">
                      <Image
                        src={heroPlants[2].image_url!}
                        alt={heroPlants[2].common_name}
                        fill
                        className="object-cover"
                        sizes="210px"
                      />
                    </div>
                  )}
                  {heroPlants[3] && (
                    <div className="relative rounded-2xl overflow-hidden flex-1 min-h-0">
                      <Image
                        src={heroPlants[3].image_url!}
                        alt={heroPlants[3].common_name}
                        fill
                        className="object-cover"
                        sizes="210px"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile hero image — full-bleed below text */}
        {heroPlants[0] && (
          <div className="lg:hidden relative h-64 w-full">
            <Image
              src={heroPlants[0].image_url!}
              alt={heroPlants[0].common_name}
              fill
              className="object-cover"
              sizes="100vw"
            />
          </div>
        )}
      </section>

      {/* Stats strip */}
      <section className="border-y border-warm-stone/20 bg-parchment">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="grid grid-cols-3 divide-x divide-warm-stone/20">
            {[
              { num: '500+', label: 'Curated Plants', italic: false },
              { num: '36+', label: 'Characteristics', italic: false },
              { num: 'Instant', label: 'Sharing', italic: true },
            ].map(({ num, label, italic }) => (
              <div key={label} className="text-center px-4">
                <div className={`font-playfair text-2xl sm:text-3xl font-bold text-dark-bark mb-1 ${italic ? 'italic' : ''}`}>
                  {num}
                </div>
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-warm-stone">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse the Plant Database */}
      {browsePlants.length > 0 && (
        <section className="py-20 px-6 bg-parchment">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-playfair text-3xl font-semibold text-dark-bark mb-3">
                Browse the Plant Database
              </h2>
              <p className="text-warm-umber">
                Explore our meticulously curated collection of climate-appropriate species.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {browsePlants.map(plant => (
                <PlantCard key={plant.id} plant={plant} />
              ))}
            </div>
            <div className="text-center mt-10">
              <Link
                href="/plants"
                className="inline-flex items-center gap-2 text-sm font-semibold text-forest border border-forest/40 px-6 py-3 rounded-lg hover:bg-forest hover:text-white transition-colors"
              >
                View All Plants →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Everything you need */}
      <section className="py-20 px-6 bg-stone-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="font-playfair text-3xl font-semibold text-dark-bark mb-3">Everything you need</h2>
            <p className="text-warm-umber">From search to shareable presentation in minutes.</p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {features.map(f => (
              <div key={f.title} className="bg-cream rounded-2xl p-5 sm:p-7 shadow-warm">
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-playfair text-sm sm:text-base font-semibold text-dark-bark mb-2">{f.title}</h3>
                <p className="text-warm-umber text-xs sm:text-sm leading-relaxed hidden sm:block">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center bg-parchment">
        <h2 className="font-playfair text-3xl font-semibold text-dark-bark mb-4">
          Ready to build your first plant list?
        </h2>
        <p className="text-warm-umber mb-8 max-w-md mx-auto">
          Create an account and start browsing our plant database today.
        </p>
        <Link
          href="/auth/signup"
          className="inline-block bg-forest text-white font-semibold px-10 py-4 rounded-lg hover:bg-forest-dark transition-colors"
        >
          Create Free Account
        </Link>
      </section>
    </div>
  )
}
