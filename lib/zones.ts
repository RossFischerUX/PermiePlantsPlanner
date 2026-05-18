// Half-zone encoding: N_a = N*2, N_b = N*2+1
// e.g. 9a=18, 9b=19, 10a=20, 10b=21
// Valid range: 1a(2) through 13b(27)

export const ZONE_LABELS: string[] = []
for (let n = 1; n <= 13; n++) {
  ZONE_LABELS.push(`${n}a`, `${n}b`)
}

export function encodeZone(label: string): number | null {
  const match = label.trim().toLowerCase().match(/^(\d+)([ab])?$/)
  if (!match) return null
  const major = parseInt(match[1], 10)
  if (major < 1 || major > 13) return null
  const half = match[2] === 'b' ? 1 : 0
  return major * 2 + half
}

export function decodeZone(encoded: number): string | null {
  if (encoded < 2 || encoded > 27) return null
  const major = Math.floor(encoded / 2)
  const half = encoded % 2 === 0 ? 'a' : 'b'
  return `${major}${half}`
}

// Parse a usda_zones text string into [minEncoded, maxEncoded].
// "7-10"   → [14, 21]  (7a through 10b)
// "9a-10b" → [18, 21]
// "Zone 9" → [18, 19]  (all of zone 9)
// "9"      → [18, 19]
export function parseZoneRange(text: string): [number, number] | null {
  const clean = text.replace(/zones?\s*/gi, '').trim()
  const parts = clean.split(/[–—-]/).map(s => s.trim()).filter(Boolean)

  if (parts.length === 1) {
    // Single zone — e.g. "9" or "9b"
    const hasLetter = /[ab]$/i.test(parts[0])
    const base = encodeZone(hasLetter ? parts[0] : parts[0] + 'a')
    if (base === null) return null
    // If no letter was given, span both a and b halves
    return hasLetter ? [base, base] : [base, base + 1]
  }

  if (parts.length === 2) {
    const minLabel = /[ab]$/i.test(parts[0]) ? parts[0] : parts[0] + 'a'
    const maxLabel = /[ab]$/i.test(parts[1]) ? parts[1] : parts[1] + 'b'
    const minEnc = encodeZone(minLabel)
    const maxEnc = encodeZone(maxLabel)
    if (minEnc === null || maxEnc === null) return null
    return [minEnc, maxEnc]
  }

  return null
}
