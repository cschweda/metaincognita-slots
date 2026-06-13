import { describe, it, expect } from 'vitest'
import { exactRtp } from '../app/engine/exactRtp'
import { validateMachineDef } from '../app/engine/validate'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { SERIES_E_MULTIPLIER } from '../app/machines/series-e-multiplier'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'

describe('series-e-3line — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(SERIES_E_3LINE)).not.toThrow()
  })

  it('strip counts match the calibrated composition', () => {
    const counts = SERIES_E_3LINE.strips.map((strip) => {
      const c: Record<string, number> = {}
      strip.forEach((s) => {
        c[s] = (c[s] ?? 0) + 1
      })
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

describe('diamond-doubler — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(DIAMOND_DOUBLER)).not.toThrow()
  })

  it('virtual map weights match the calibrated composition', () => {
    const weights = DIAMOND_DOUBLER.virtualMaps.map((vmap, r) => {
      const c: Record<string, number> = {}
      vmap.forEach((p) => {
        const s = DIAMOND_DOUBLER.physicalStrips[r]![p]!
        c[s] = (c[s] ?? 0) + 1
      })
      return c
    })
    expect(weights[0]).toEqual({ DW: 3, S7: 3, B3: 5, B2: 8, B1: 14, CH: 2, BL: 37 })
    expect(weights[1]).toEqual({ DW: 2, S7: 3, B3: 5, B2: 8, B1: 13, CH: 2, BL: 39 })
    expect(weights[2]).toEqual({ DW: 2, S7: 3, B3: 5, B2: 8, B1: 14, CH: 2, BL: 38 })
  })

  it('FROZEN: exact RTP = 94.744245% (117877/124416), HF = 14.667460%', () => {
    const r = exactRtp(DIAMOND_DOUBLER)
    expect(r.rtpPerCoin).toBeCloseTo(117877 / 124416, 10)
    expect(r.rtpPerCoin).toBeCloseTo(0.94744245, 6)
    expect(r.hitFrequency).toBeCloseTo(0.14667460, 6)
  })

  it('FROZEN: P(3xDW) = 12/373248 = 1/31104', () => {
    const r = exactRtp(DIAMOND_DOUBLER)
    expect(r.breakdown.find(b => b.entryId === '3dw')!.probability).toBeCloseTo(1 / 31104, 12)
  })
})

describe('sevens-ablaze — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(SEVENS_ABLAZE)).not.toThrow()
  })

  it('virtual map weights match the calibrated composition', () => {
    const weights = SEVENS_ABLAZE.virtualMaps.map((vmap, r) => {
      const c: Record<string, number> = {}
      vmap.forEach((p) => {
        const s = SEVENS_ABLAZE.physicalStrips[r]![p]!
        c[s] = (c[s] ?? 0) + 1
      })
      return c
    })
    expect(weights[0]).toEqual({ F7: 3, S7: 5, B3: 7, B2: 11, B1: 14, CH: 2, BL: 30 })
    expect(weights[1]).toEqual({ F7: 3, S7: 6, B3: 7, B2: 8, B1: 13, CH: 2, BL: 33 })
    expect(weights[2]).toEqual({ F7: 3, S7: 6, B3: 7, B2: 8, B1: 16, CH: 2, BL: 30 })
  })

  it('FROZEN: exact RTP @2 coins, meter at reset = 94.488115%, HF = 15.719307%', () => {
    const r = exactRtp(SEVENS_ABLAZE, { coins: 2 })
    expect(r.rtpPerCoin).toBeCloseTo(0.94488115, 6)
    expect(r.hitFrequency).toBeCloseTo(0.15719307, 6)
  })

  it('FROZEN: P(3xF7) = 27/373248 = 1/13824; at 1 coin RTP uses fixed 1000', () => {
    const r2 = exactRtp(SEVENS_ABLAZE, { coins: 2 })
    expect(r2.breakdown.find(b => b.entryId === '3f7')!.probability).toBeCloseTo(1 / 13824, 12)
    // At 1 coin the F7 award is the fixed 1000/coin = same per-coin value as
    // the reset meter (2000/2): identical per-coin RTP by design.
    const r1 = exactRtp(SEVENS_ABLAZE, { coins: 1 })
    expect(r1.rtpPerCoin).toBeCloseTo(r2.rtpPerCoin, 10)
  })
})
