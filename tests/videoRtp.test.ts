import { describe, it, expect } from 'vitest'
import { hnsFinalDist, videoExactRtp } from '../app/engine/videoRtp'
import type { VideoMachineDef } from '../app/engine/types'

// Hand-checkable single-line machine: 4-cell strips, P(AA cell) = 1/4.
// rtp = 64*P(run=3) + 256*P(run=4) + 1024*P(run=5)
//     = 64*(3/256) + 256*(3/1024) + 1024*(1/1024) = 0.75 + 0.75 + 1 = 2.5
// HF = P(run >= 3) = (1/4)^3 = 1/64
// E[X^2] = 64^2*3/256 + 256^2*3/1024 + 1024^2/1024 = 48 + 192 + 1024 = 1264
// variance = 1264 - 2.5^2 = 1257.75
const HAND_DEF = {
  id: 'hand-lines',
  name: 'Hand Lines',
  family: 'video',
  denominationCents: 1,
  maxCoins: 1,
  symbols: { AA: { label: 'Ace' }, BB: { label: 'Blank' } },
  strips: [
    ['AA', 'BB', 'BB', 'BB'],
    ['AA', 'BB', 'BB', 'BB'],
    ['AA', 'BB', 'BB', 'BB'],
    ['AA', 'BB', 'BB', 'BB'],
    ['AA', 'BB', 'BB', 'BB']
  ],
  betMode: { kind: 'lines', lines: [[1, 1, 1, 1, 1]] },
  fixedBet: false,
  wildSymbol: null,
  scatter: null,
  freeSpins: null,
  holdAndSpin: null,
  paytable: [
    { id: 'aa3', symbol: 'AA', length: 3, pay: 64 },
    { id: 'aa4', symbol: 'AA', length: 4, pay: 256 },
    { id: 'aa5', symbol: 'AA', length: 5, pay: 1024 }
  ],
  progressive: null,
  history: 'test'
} as unknown as VideoMachineDef

describe('videoExactRtp — hand-checkable lines machine', () => {
  it('reproduces the closed-form RTP, HF, and variance exactly', () => {
    const r = videoExactRtp(HAND_DEF, {})
    expect(r.rtpPerCoin).toBeCloseTo(2.5, 12)
    expect(r.hitFrequency).toBeCloseTo(1 / 64, 12)
    expect(r.variancePerCoin).toBeCloseTo(1257.75, 8)
  })
  it('breakdown contributions sum to the RTP', () => {
    const r = videoExactRtp(HAND_DEF, {})
    const sum = r.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 10)
  })
})

describe('videoExactRtp — free spins factor', () => {
  // Same machine + a scatter on reels 1,2,3 (one cell of 4 -> visible 3/4 of
  // stops) and 2 free spins at x2, no retrigger:
  // P_tr = (3/4)^3 = 27/64; factor = 1 + 2*2*P_tr = 1 + 4*27/64 = 2.6875.
  // Scatter pays nothing (pays table empty) so rtp = 2.5 * 2.6875 = 6.71875.
  const FS_DEF = {
    ...HAND_DEF,
    id: 'hand-fs',
    symbols: { ...HAND_DEF.symbols, SC: { label: 'Scatter' } },
    strips: [
      ['AA', 'SC', 'BB', 'BB'],
      ['AA', 'SC', 'BB', 'BB'],
      ['AA', 'SC', 'BB', 'BB'],
      ['AA', 'BB', 'BB', 'BB'],
      ['AA', 'BB', 'BB', 'BB']
    ],
    scatter: { symbol: 'SC', pays: {}, triggerCount: 3 },
    freeSpins: { count: 2, multiplier: 2, retrigger: false }
  } as unknown as VideoMachineDef
  it('applies 1 + count*mult*P_tr', () => {
    const r = videoExactRtp(FS_DEF, {})
    expect(r.rtpPerCoin).toBeCloseTo(2.5 * (1 + 4 * 27 / 64), 10)
    const fs = r.breakdown.find(b => b.entryId === 'free-spins')!
    expect(fs.probability).toBeCloseTo(27 / 64, 12)
  })
  it('retrigger fold carries the multiplier (Wald with m)', () => {
    const RETRIG_DEF = {
      ...FS_DEF,
      id: 'hand-fs-retrig',
      freeSpins: { count: 2, multiplier: 2, retrigger: true }
    } as unknown as VideoMachineDef
    const r = videoExactRtp(RETRIG_DEF, {})
    // q = 27/64; E[S] = 2*2*EB/(1 - 2q) = 4*EB/(1 - 54/64); base EB = 2.5 credits/coin at bet 1
    const q = 27 / 64
    expect(r.rtpPerCoin).toBeCloseTo(2.5 * (1 + q * 4 / (1 - 2 * q)), 10)
  })
})

describe('hold-and-spin Markov chain', () => {
  it('FROZEN: P(fill | T=6) at p=2/24 is 2.35465409% and the distribution is proper', () => {
    const dist = hnsFinalDist(6, 2, 24, 3)
    let total = 0
    for (const p of dist.values()) total += p
    expect(total).toBeCloseTo(1, 12)
    expect(dist.get(15)!).toBeCloseTo(0.0235465409, 8)
  })
  it('with p=0 the feature never grows: K = T', () => {
    const dist = hnsFinalDist(7, 0, 24, 3)
    expect(dist.get(7)).toBeCloseTo(1, 12)
  })
})
