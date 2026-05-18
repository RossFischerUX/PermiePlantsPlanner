'use client'

import { useState } from 'react'

export default function FilterSection({ label, options, selected, onToggle }: {
  label: string; options: string[]; selected: string[]; onToggle: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between py-2.5 text-[11px] font-semibold text-warm-stone uppercase tracking-[0.06em] hover:text-warm-umber text-left"
      >
        <span>
          {label}
          {selected.length > 0 && (
            <span className="ml-1.5 bg-terracotta text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 normal-case tracking-normal">
              {selected.length}
            </span>
          )}
        </span>
        <svg
          className={`w-3.5 h-3.5 text-warm-stone transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="flex flex-col gap-2 pb-3 pt-1">
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2.5 cursor-pointer text-sm text-warm-umber hover:text-dark-bark">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onToggle(opt)}
                className="accent-forest w-4 h-4"
              />
              <span className="capitalize">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
