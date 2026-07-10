import { describe, it, expect } from 'vitest'
import { formatCents, formatCentsCompact, formatCentsExact, formatCredits, formatOdds, formatPercent, formatSignedCents, formatSignedCredits } from '../app/utils/format'

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
  it('formatSignedCredits prefixes gains with + and groups thousands', () => {
    expect(formatSignedCredits(1005)).toBe('+1,005')
    expect(formatSignedCredits(-11)).toBe('-11')
    expect(formatSignedCredits(0)).toBe('+0')
  })
})

describe('formatCentsExact', () => {
  it('always renders two decimals with the sign outside the $', () => {
    expect(formatCentsExact(0)).toBe('$0.00')
    expect(formatCentsExact(25)).toBe('$0.25')
    expect(formatCentsExact(100)).toBe('$1.00')
    expect(formatCentsExact(123456)).toBe('$1234.56')
    expect(formatCentsExact(-1250)).toBe('-$12.50')
  })
})

describe('formatCentsCompact', () => {
  it('renders sub-dollar as cents, whole dollars bare, fractional with 2 places', () => {
    expect(formatCentsCompact(25)).toBe('25¢')
    expect(formatCentsCompact(99)).toBe('99¢')
    expect(formatCentsCompact(100)).toBe('$1')
    expect(formatCentsCompact(500)).toBe('$5')
    expect(formatCentsCompact(125)).toBe('$1.25')
    expect(formatCentsCompact(0)).toBe('0¢')
  })
})
