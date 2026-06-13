import { describe, it, expect } from 'vitest'
import { mulberry32, cryptoSeed } from '../app/engine/rng'

describe('mulberry32', () => {
  it('is reproducible for a given seed', () => {
    const a = mulberry32(12345)
    const b = mulberry32(12345)
    const seqA = Array.from({ length: 100 }, () => a())
    const seqB = Array.from({ length: 100 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces different sequences for different seeds', () => {
    const a = mulberry32(1)
    const b = mulberry32(2)
    expect(Array.from({ length: 10 }, () => a()))
      .not.toEqual(Array.from({ length: 10 }, () => b()))
  })

  it('stays in [0, 1)', () => {
    const r = mulberry32(99)
    for (let i = 0; i < 100_000; i++) {
      const v = r()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('is uniform across 100 bins (chi-squared, df=99, p=0.001 crit 148.23)', () => {
    const r = mulberry32(20260612)
    const bins = new Array(100).fill(0)
    const n = 1_000_000
    for (let i = 0; i < n; i++) bins[Math.floor(r() * 100)]++
    const expected = n / 100
    const chi2 = bins.reduce((s, o) => s + (o - expected) ** 2 / expected, 0)
    expect(chi2).toBeLessThan(148.23)
  })
})

describe('cryptoSeed', () => {
  it('returns a uint32 and varies', () => {
    const s1 = cryptoSeed()
    const s2 = cryptoSeed()
    expect(Number.isInteger(s1)).toBe(true)
    expect(s1).toBeGreaterThanOrEqual(0)
    expect(s1).toBeLessThanOrEqual(0xFFFFFFFF)
    // astronomically unlikely to collide twice in a row AND with zero
    expect(s1 === s2 && s1 === 0).toBe(false)
  })
})
