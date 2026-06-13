import { describe, it, expect } from 'vitest'
import { exactRtp } from '../app/engine/exactRtp'
import { validateMachineDef } from '../app/engine/validate'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { SERIES_E_MULTIPLIER } from '../app/machines/series-e-multiplier'

describe('series-e-3line — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(SERIES_E_3LINE)).not.toThrow()
  })

  it('strip counts match the calibrated composition', () => {
    const counts = SERIES_E_3LINE.strips.map((strip) => {
      const c: Record<string, number> = {}
      strip.forEach((s) => { c[s] = (c[s] ?? 0) + 1 })
      return c
    })
    expect(counts[0]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 4, OR: 5, CH: 2, BL: 5 })
    expect(counts[1]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 5, OR: 5, CH: 1, BL: 5 })
    expect(counts[2]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 5, OR: 5, CH: 1, BL: 5 })
    expect(counts[3]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 5, OR: 5, CH: 1, BL: 5 })
    expect(counts[4]).toEqual({ S7: 1, BAR: 1, BE: 4, PL: 4, OR: 6, CH: 3, BL: 3 })
  })

  it('FROZEN: exact RTP per line = 89.035073% with jackpot at live-average 3000', () => {
    const r = exactRtp(SERIES_E_3LINE)
    expect(r.rtpPerCoin).toBeCloseTo(0.89035073, 6)
    expect(r.hitFrequency).toBeCloseTo(0.11814445, 6)
  })

  it('FROZEN: P(5xS7) = 1/5,153,632', () => {
    const r = exactRtp(SERIES_E_3LINE)
    const jp = r.breakdown.find(b => b.entryId === 's7x5')!
    expect(jp.probability).toBeCloseTo(1 / 5153632, 12)
  })
})

describe('series-e-multiplier — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(SERIES_E_MULTIPLIER)).not.toThrow()
  })

  it('FROZEN: exact RTP = 89.126400% at 3 coins, 85.030400% at 1 coin', () => {
    expect(exactRtp(SERIES_E_MULTIPLIER, { coins: 3 }).rtpPerCoin).toBeCloseTo(0.891264, 6)
    expect(exactRtp(SERIES_E_MULTIPLIER, { coins: 1 }).rtpPerCoin).toBeCloseTo(0.850304, 6)
    expect(exactRtp(SERIES_E_MULTIPLIER, { coins: 3 }).hitFrequency).toBeCloseTo(0.14255872, 6)
  })

  it('FROZEN: P(4xS7) = 16/390625', () => {
    const r = exactRtp(SERIES_E_MULTIPLIER, { coins: 3 })
    const jp = r.breakdown.find(b => b.entryId === 's7x4')!
    expect(jp.probability).toBeCloseTo(16 / 390625, 12)
  })
})
