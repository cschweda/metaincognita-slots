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

export function formatCredits(credits: number): string {
  return credits.toLocaleString('en-US')
}
