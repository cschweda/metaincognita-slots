import { describe, it, expect } from 'vitest'
import { exactRtp } from '../app/engine/exactRtp'
import { validateMachineDef } from '../app/engine/validate'
import { CANAL_ROYALE } from '../app/machines/canal-royale'
import { DRAGONS_HOARD } from '../app/machines/dragons-hoard'
import { THUNDER_VAULT } from '../app/machines/thunder-vault'

function counts(strip: string[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const s of strip) c[s] = (c[s] ?? 0) + 1
  return c
}

describe('canal-royale — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(CANAL_ROYALE)).not.toThrow()
  })

  it('strip compositions match the calibrated counts', () => {
    const want = [
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 4, TT: 4, SC: 1 },
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 3, TT: 3, SC: 1, WD: 2 },
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 4, TT: 3, WD: 2 },
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 3, TT: 3, SC: 1, WD: 2 },
      { LI: 2, MA: 2, FA: 2, AA: 3, KK: 3, QQ: 3, JJ: 4, TT: 4, SC: 1 }
    ]
    CANAL_ROYALE.strips.forEach((s, i) => expect(counts(s)).toEqual(want[i]))
  })

  it('FROZEN: RTP 92.455942% (628217093/679477248), HF@25 55.534306%, variance 8.792463', () => {
    const r = exactRtp(CANAL_ROYALE)
    expect(r.rtpPerCoin).toBeCloseTo(628217093 / 679477248, 10)
    expect(r.rtpPerCoin).toBeCloseTo(0.92455942, 6)
    expect(r.hitFrequency).toBeCloseTo(122833 / 221184, 10)
    expect(r.hitFrequency).toBeCloseTo(0.55534306, 6)
    expect(r.variancePerCoin).toBeCloseTo(8.792463, 4)
  })

  it('FROZEN: per-coin RTP is line-count invariant; trigger = 29/4096', () => {
    const r1 = exactRtp(CANAL_ROYALE, { coins: 1 })
    const r25 = exactRtp(CANAL_ROYALE, { coins: 25 })
    expect(r1.rtpPerCoin).toBeCloseTo(r25.rtpPerCoin, 12)
    const fs = r25.breakdown.find(b => b.entryId === 'free-spins')!
    expect(fs.probability).toBeCloseTo(29 / 4096, 12)
  })

  it('FROZEN: P(5xLI on a line) = 1/31104; breakdown sums to RTP', () => {
    const r = exactRtp(CANAL_ROYALE)
    const li5 = r.breakdown.find(b => b.entryId === 'li5')!
    expect(li5.probability).toBeCloseTo(25 / 31104, 12)
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 9)
  })
})

describe('dragons-hoard — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(DRAGONS_HOARD)).not.toThrow()
  })

  it('FROZEN: RTP 93.995040% (94747/100800), HF 53.553376%, variance 10.696426', () => {
    const r = exactRtp(DRAGONS_HOARD)
    expect(r.rtpPerCoin).toBeCloseTo(94747 / 100800, 10)
    expect(r.rtpPerCoin).toBeCloseTo(0.93995040, 6)
    expect(r.hitFrequency).toBeCloseTo(236903 / 442368, 10)
    expect(r.hitFrequency).toBeCloseTo(0.53553376, 6)
    expect(r.variancePerCoin).toBeCloseTo(10.696426, 4)
  })

  it('FROZEN: retrigger q = 29/4096 (E[T] = 4096/483 spins); breakdown sums to RTP', () => {
    const r = exactRtp(DRAGONS_HOARD)
    const fs = r.breakdown.find(b => b.entryId === 'free-spins')!
    expect(fs.probability).toBeCloseTo(29 / 4096, 12)
    // free-spin slice per coin = q * E[S] / 25 with E[S] = 8*E[B]/(1-8q)
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 9)
  })
})

describe('thunder-vault — frozen calibration', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(THUNDER_VAULT)).not.toThrow()
  })

  it('FROZEN: RTP 90.294753% at grand reset, HF 41.289906%, variance 29.259962', () => {
    const r = exactRtp(THUNDER_VAULT)
    expect(r.rtpPerCoin).toBeCloseTo(0.90294753, 6)
    expect(r.hitFrequency).toBeCloseTo(68495 / 165888, 10)
    expect(r.hitFrequency).toBeCloseTo(0.41289906, 6)
    expect(r.variancePerCoin).toBeCloseTo(29.259962, 4)
  })

  it('FROZEN: P(trigger) = 449/55296; Grand 1/5,138 spins; feature slice 31.837642%', () => {
    const r = exactRtp(THUNDER_VAULT)
    const hns = r.breakdown.find(b => b.entryId === 'hold-and-spin')!
    expect(hns.probability).toBeCloseTo(449 / 55296, 12)
    const grand = r.breakdown.find(b => b.entryId === 'grand')!
    expect(grand.probability).toBeCloseTo(0.000194622926, 10)
    expect(hns.contribution + grand.contribution).toBeCloseTo(0.31837642, 6)
  })

  it('FROZEN: a higher meter raises RTP (the +EV teaching point)', () => {
    const atReset = exactRtp(THUNDER_VAULT)
    const grown = exactRtp(THUNDER_VAULT, { progressiveValues: { meter: 30000 } })
    // dRTP = P(fill) * dMeter / bet = 1.94622926e-4 * 25000 / 25
    expect(grown.rtpPerCoin - atReset.rtpPerCoin).toBeCloseTo(0.000194622926 * 25000 / 25, 8)
  })
})
