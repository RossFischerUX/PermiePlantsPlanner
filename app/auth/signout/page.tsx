import Link from 'next/link'

export default function SignoutPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-10 max-w-sm w-full text-center">
        <div className="text-4xl mb-4">👋</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">You're signed out</h1>
        <p className="text-sm text-gray-500 mb-6">
          You've been signed out of all your devices.
        </p>
        <Link
          href="/auth/login"
          className="inline-block text-sm font-medium bg-green-700 text-white px-6 py-2.5 rounded-lg hover:bg-green-800 transition-colors"
        >
          Sign back in
        </Link>
        <div className="mt-4">
          <Link href="/plants" className="text-sm text-gray-400 hover:text-gray-600">
            Browse plants without an account
          </Link>
        </div>
      </div>
    </div>
  )
}
