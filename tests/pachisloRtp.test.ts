import { describe, it, expect } from 'vitest'
import { interludeMoments, pachisloBonusValues, pachisloExactRtp } from '../app/engine/pachisloRtp'
import { exactRtp } from '../app/engine/exactRtp'
import { STOCK_RUSH } from '../app/machines/stock-rush'

describe('interlude moments — frozen', () => {
  it('E[bells] = 422/243, E[bells^2] = 490/81, E[games] = 844/243', () => {
    const m = interludeMoments(STOCK_RUSH)
    expect(m.eBells).toBeCloseTo(422 / 243, 12)
    expect(m.eBells2).toBeCloseTo(490 / 81, 12)
    expect(m.eGames).toBeCloseTo(844 / 243, 12)
  })
})

describe('bonus values — frozen (manual: "up to 35 payouts (500 tokens)")', () => {
  it('REG = 135 out / 8 in; BIG = 34595/81 = 427.098765 out / 7520/243 = 30.946502 in', () => {
    const b = pachisloBonusValues(STOCK_RUSH)
    expect(b.regOut).toBe(135)
    expect(b.regIn).toBe(8)
    expect(b.bigOut).toBeCloseTo(34595 / 81, 10)
    expect(b.bigIn).toBeCloseTo(7520 / 243, 10)
    expect(b.bigMaxOut).toBe(525) // 35 payouts x 15
  })
})

describe('six operator levels at 3 tokens — frozen, all inside the manual bands', () => {
  const FROZEN = [
    { level: 1, rtp: 0.66001241, hf: 0.19329834, variance: 61.342095, band: [0.65, 0.67] },
    { level: 2, rtp: 0.72999378, hf: 0.20129395, variance: 64.317805, band: [0.72, 0.74] },
    { level: 3, rtp: 0.79983797, hf: 0.20727539, variance: 68.600733, band: [0.79, 0.81] },
    { level: 4, rtp: 0.91501312, hf: 0.21234131, variance: 79.370379, band: [0.88, 0.95] },
    { level: 5, rtp: 1.06006863, hf: 0.22424316, variance: 89.110325, band: [1.05, 1.07] },
    { level: 6, rtp: 1.20002784, hf: 0.23266602, variance: 100.340097, band: [1.15, 1.25] }
  ]
  for (const f of FROZEN) {
    it(`level ${f.level}: RTP ${(f.rtp * 100).toFixed(4)}%`, () => {
      const r = pachisloExactRtp(STOCK_RUSH, { oddsLevel: f.level })
      expect(r.rtpPerCoin).toBeCloseTo(f.rtp, 6)
      expect(r.hitFrequency).toBeCloseTo(f.hf, 6)
      expect(r.variancePerCoin).toBeCloseTo(f.variance, 4)
      expect(r.rtpPerCoin).toBeGreaterThan(f.band[0]!)
      expect(r.rtpPerCoin).toBeLessThan(f.band[1]!)
    })
  }
})

describe('token-count economics (v0.2: full bet required)', () => {
  it('rejects 1- and 2-token RTP queries — bonus values are full-bet-gated', () => {
    expect(() => pachisloExactRtp(STOCK_RUSH, { oddsLevel: 4, coins: 1 })).toThrow(/exactly 3 tokens/)
    expect(() => pachisloExactRtp(STOCK_RUSH, { oddsLevel: 4, coins: 2 })).toThrow(/exactly 3 tokens/)
  })
  it('breakdown sums to the RTP; replay contributes zero OUT', () => {
    const r = pachisloExactRtp(STOCK_RUSH, { oddsLevel: 4 })
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 10)
    expect(r.breakdown.find(b => b.entryId === 'replay')!.contribution).toBe(0)
  })
  it('dispatches through the exactRtp facade', () => {
    const r = exactRtp(STOCK_RUSH, { oddsLevel: 6 })
    expect(r.rtpPerCoin).toBeCloseTo(1.20002784, 6)
  })
})
