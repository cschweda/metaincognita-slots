import { describe, it, expect } from 'vitest'
import { formatCents, formatCredits, formatOdds, formatPercent, formatSignedCents } from '../app/utils/format'

describe('format helpers', () => {
  it('formatCents: whole dollars short, cents when needed, thousands grouped', () => {
    expect(formatCents(0)).toBe('$0')
    expect(formatCents(500)).toBe('$5')
    expect(formatCents(550)).toBe('$5.50')
    expect(formatCents(123456)).toBe('$1,235')
    expect(formatCents(-550)).toBe('-$5.50')
    expect(formatCents(Number.NaN)).toBe('$—')
  })
  it('formatSignedCents prefixes gains with +', () => {
    expect(formatSignedCents(550)).toBe('+$5.50')
    expect(formatSignedCents(-550)).toBe('-$5.50')
    expect(formatSignedCents(0)).toBe('+$0')
  })
  it('formatPercent renders decimals at the requested precision', () => {
    expect(formatPercent(0.92455942)).toBe('92.46%')
    expect(formatPercent(0.92455942, 4)).toBe('92.4559%')
  })
  it('formatOdds renders 1-in-x', () => {
    expect(formatOdds(1 / 31104)).toBe('1 in 31,104')
    expect(formatOdds(0.5)).toBe('1 in 2')
    expect(formatOdds(0)).toBe('—')
  })
  it('formatCredits groups thousands', () => {
    expect(formatCredits(0)).toBe('0')
    expect(formatCredits(12500)).toBe('12,500')
  })
})
