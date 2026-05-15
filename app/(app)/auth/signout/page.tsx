import Link from 'next/link'

export default function SignoutPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 bg-parchment">
      <div className="bg-cream border border-warm-stone/20 rounded-2xl shadow-warm p-10 max-w-sm w-full text-center">
        <div className="w-14 h-14 bg-forest/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">👋</span>
        </div>
        <h1 className="font-playfair text-xl font-bold text-dark-bark mb-2">You&apos;re signed out</h1>
        <p className="text-sm text-warm-umber mb-6">
          You&apos;ve been signed out of your account.
        </p>
        <Link
          href="/auth/login"
          className="inline-block text-sm font-semibold bg-forest text-white px-6 py-2.5 rounded-lg hover:bg-forest-dark transition-colors"
        >
          Sign back in
        </Link>
        <div className="mt-4">
          <Link href="/plants" className="text-sm text-warm-stone hover:text-warm-umber transition-colors">
            Browse plants without an account
          </Link>
        </div>
      </div>
    </div>
  )
}
