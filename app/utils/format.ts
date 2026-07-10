export function formatCents(cents: number): string {
  if (!Number.isFinite(cents)) return '$—'
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = abs / 100
  if (dollars >= 1000) {
    return `${sign}$${dollars.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
  }
  if (abs % 100 === 0) {
    return `${sign}$${dollars.toFixed(0)}`
  }
  return `${sign}$${dollars.toFixed(2)}`
}

export function formatSignedCents(cents: number): string {
  return cents < 0 ? formatCents(cents) : `+${formatCents(cents)}`
}

export function formatPercent(decimal: number, digits = 2): string {
  return `${(decimal * 100).toFixed(digits)}%`
}

export function formatOdds(probability: number): string {
  if (probability <= 0) return '—'
  return `1 in ${Math.round(1 / probability).toLocaleString('en-US')}`
}

/**
 * Exact money: always two decimals, sign outside the $ ("$4.00", "-$12.50").
 * The result-card / narration / EV-readout style — never rounds cents away.
 */
export function formatCentsExact(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`
}

/**
 * Compact cabinet money: sub-dollar shows cents ("25¢"), whole dollars drop
 * the decimals ("$1"), the rest keeps two places ("$1.25") — so a cash deck
 * never shows "$0.25" or "$1.00". (Moved verbatim from useLockReel's money().)
 */
export function formatCentsCompact(cents: number): string {
  if (cents < 100) return `${Math.round(cents)}¢`
  const d = cents / 100
  return Number.isInteger(d) ? `$${d}` : `$${d.toFixed(2)}`
}

export function formatCredits(credits: number): string {
  return credits.toLocaleString('en-US')
}

export function formatSignedCredits(credits: number): string {
  return credits < 0 ? formatCredits(credits) : `+${formatCredits(credits)}`
}
