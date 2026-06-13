import { describe, it, expect } from 'vitest'
import { exactRtp } from '../app/engine/exactRtp'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import type { StepperMachineDef, BallyEmMachineDef } from '../app/engine/types'

// Toy stepper: 3 reels, 2-entry virtual map, strip [A, BL].
// P(A per reel) = 1/2 → P(AAA) = 1/8. Pay 8 → RTP = 100%, HF = 12.5%.
// Variance per coin: E[X^2] - E[X]^2 = 64/8 - 1 = 7.
const toyStepper: StepperMachineDef = {
  id: 'toy-s', name: 'Toy Stepper', family: 'stepper',
  denominationCents: 100, maxCoins: 1,
  symbols: { A: { label: 'A' }, BL: { label: 'blank' } },
  physicalStrips: [['A', 'BL'], ['A', 'BL'], ['A', 'BL']],
  virtualMaps: [[0, 1], [0, 1], [0, 1]],
  wildSymbol: null, wildMultiplier: 1,
  paytable: [{ id: '3a', kind: 'allSame', symbol: 'A', pay: 8 }],
  progressive: null, history: 'toy'
}

// Toy bally: 3 reels x 4 uniform stops, strip [A, BL, BL, BL].
// P(A on a row per reel) = 1/4 → P(run of 3) = 1/64. Pay 32 → RTP = 50%.
const toyBally: BallyEmMachineDef = {
  id: 'toy-b', name: 'Toy Bally', family: 'bally-em',
  denominationCents: 100, maxCoins: 3,
  symbols: { A: { label: 'A' }, BL: { label: 'blank' } },
  stops: 4,
  strips: [['A', 'BL', 'BL', 'BL'], ['A', 'BL', 'BL', 'BL'], ['A', 'BL', 'BL', 'BL']],
  payMode: 'lines',
  paytable: [{ id: '3a', kind: 'run', symbol: 'A', length: 3, pay: 32 }],
  progressive: null, history: 'toy'
}

describe('exactRtp — toy stepper', () => {
  it('computes RTP, hit frequency, variance exactly', () => {
    const r = exactRtp(toyStepper)
    expect(r.rtpPerCoin).toBeCloseTo(1.0, 12)
    expect(r.hitFrequency).toBeCloseTo(0.125, 12)
    expect(r.variancePerCoin).toBeCloseTo(7.0, 12)
  })

  it('breakdown lists per-entry probability and contribution', () => {
    const r = exactRtp(toyStepper)
    const e = r.breakdown.find(b => b.entryId === '3a')!
    expect(e.probability).toBeCloseTo(1 / 8, 12)
    expect(e.contribution).toBeCloseTo(1.0, 12)
  })
})

describe('exactRtp — toy bally', () => {
  it('per-coin RTP is line-count invariant; HF/variance are true per-spin (all 3 lines)', () => {
    // Strip [A,BL,BL,BL]: at stop 0 A shows on TOP, stop 3 on CENTER, stop 2 on
    // BOTTOM, stop 1 nowhere. A row is all-A iff all 3 reels sit at that row's
    // stop, so the three rows win on disjoint stop-tuples (1 each of 4^3=64).
    //   coins=1 (center): P(win) = 1/64, Var(X)=32^2/64 - 0.5^2 = 15.75
    //   coins=3 (3 lines): P(any) = 3/64 (mutually exclusive), X in {0,32};
    //     E[X]=96/64=1.5 -> RTP/coin=0.5; E[X^2]=48; Var(X)=45.75;
    //     var/coin=45.75/9=5.083333...
    const oneLine = exactRtp(toyBally, { coins: 1 })
    expect(oneLine.rtpPerCoin).toBeCloseTo(0.5, 12)
    expect(oneLine.hitFrequency).toBeCloseTo(1 / 64, 12)
    expect(oneLine.variancePerCoin).toBeCloseTo(15.75, 12)

    const threeLines = exactRtp(toyBally) // default coins = maxCoins = 3
    expect(threeLines.rtpPerCoin).toBeCloseTo(0.5, 12) // unchanged: coin-linear
    expect(threeLines.hitFrequency).toBeCloseTo(3 / 64, 12)
    expect(threeLines.variancePerCoin).toBeCloseTo(45.75 / 9, 12)

    const twoLines = exactRtp(toyBally, { coins: 2 })
    expect(twoLines.hitFrequency).toBeCloseTo(2 / 64, 12)
  })

  it('multiplier machines: progressive maxCoins entry pays meter/coins at max', () => {
    const def: BallyEmMachineDef = {
      ...toyBally,
      id: 'toy-bp',
      payMode: 'multiplier',
      paytable: [{ id: '3a', kind: 'run', symbol: 'A', length: 3, pay: 32, progressive: 'maxCoins' }]
    }
    // At 1 coin: pays 32 → RTP 50%.
    expect(exactRtp(def, { coins: 1 }).rtpPerCoin).toBeCloseTo(0.5, 12)
    // At 3 coins with meter 240: pays 240 total = 80/coin → RTP = 80/64 = 125%.
    expect(exactRtp(def, { coins: 3, progressiveValues: { meter: 240 } }).rtpPerCoin)
      .toBeCloseTo(1.25, 12)
  })

  it('progressive "live" entries pay liveAverage', () => {
    const def: BallyEmMachineDef = {
      ...toyBally,
      id: 'toy-bl',
      paytable: [{ id: '3a', kind: 'run', symbol: 'A', length: 3, pay: 1, progressive: 'live' }]
    }
    const r = exactRtp(def, { progressiveValues: { liveAverage: 64 } })
    expect(r.rtpPerCoin).toBeCloseTo(1.0, 12)
  })
})

describe('exactRtp — wild doubling enumerates correctly', () => {
  // 3 reels, vmap of 4: strip [A, W, BL, BL], P(A)=P(W)=1/4.
  // allSame A pay 4, wildMultiplier 2, allWild pay 100.
  // Lines (per-reel symbol in {A,W,BL}): pay(AAA)=4 p=1/64; lines with one W:
  // 3 arrangements AAW p=1/64 each pay 8; AWW 3 arr pay 16; WWW pays 100 (allWild).
  // RTP = (1*4 + 3*8 + 3*16 + 1*100)/64 = 176/64 = 2.75
  const def: StepperMachineDef = {
    id: 'toy-w', name: 'Toy Wild', family: 'stepper',
    denominationCents: 100, maxCoins: 1,
    symbols: { A: { label: 'A' }, W: { label: 'wild' }, BL: { label: 'blank' } },
    physicalStrips: [['A', 'W', 'BL', 'BL'], ['A', 'W', 'BL', 'BL'], ['A', 'W', 'BL', 'BL']],
    virtualMaps: [[0, 1, 2, 3], [0, 1, 2, 3], [0, 1, 2, 3]],
    wildSymbol: 'W', wildMultiplier: 2,
    paytable: [
      { id: 'aw', kind: 'allWild', pay: 100 },
      { id: '3a', kind: 'allSame', symbol: 'A', pay: 4 }
    ],
    progressive: null, history: 'toy'
  }
  it('matches the hand calculation', () => {
    const r = exactRtp(def)
    expect(r.rtpPerCoin).toBeCloseTo(2.75, 12)
    expect(r.hitFrequency).toBeCloseTo(8 / 64, 12)
  })
})

describe('coins guard', () => {
  it('rejects coin levels the machine does not support', () => {
    expect(() => exactRtp(DIAMOND_DOUBLER, { coins: 0 })).toThrow(/out of range/)
    expect(() => exactRtp(DIAMOND_DOUBLER, { coins: 4 })).toThrow(/out of range/)
  })
})
