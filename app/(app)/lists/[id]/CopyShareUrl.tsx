'use client'

import { useState } from 'react'

export default function CopyShareUrl({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-sm font-medium text-warm-umber border border-warm-stone/40 px-4 py-2 rounded-lg hover:bg-warm-stone/10 transition-colors flex items-center gap-1.5 whitespace-nowrap"
    >
      {copied ? (
        <><span className="text-forest font-bold">✓</span> Copied!</>
      ) : (
        <>⎘ Copy share link</>
      )}
    </button>
  )
}
