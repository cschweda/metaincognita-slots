// Lucky 21 (blackjack-reel) machine-integrity + frozen-calibration tests.
//
// Frozen exact-math figures come from blackjackReelExactRtp(LUCKY_21) under the
// optimal cash/continue policy. They are cross-validated by pnpm verify (sim RTP
// vs the exact DP inside its 3.5σ band). If these change, the calibration in
// app/machines/lucky-21.ts changed — update both deliberately.

import { describe, it, expect } from 'vitest'
import { exactRtp } from '../app/engine/exactRtp'
import { blackjackReelExactRtp, makeOptimalStopFn } from '../app/engine/blackjackReelRtp'
import { validateMachineDef } from '../app/engine/validate'
import { dealReels, stopReel, cashOut } from '../app/engine/blackjackReel'
import { mulberry32 } from '../app/engine/rng'
import { LUCKY_21 } from '../app/machines/lucky-21'
import type { MachineSessionState } from '../app/engine/types'

/** Split the optimal-policy terminal distribution into bust / charlie / cash mass. */
function rates() {
  const r = blackjackReelExactRtp(LUCKY_21)
  let bust = 0
  let charlie = 0
  let cash = 0
  for (const b of r.breakdown) {
    if (b.entryId === 'bust') bust += b.probability
    else if (b.entryId === 'charlie') charlie += b.probability
    else cash += b.probability
  }
  return { report: r, bust, charlie, cash }
}

describe('lucky-21 — machine integrity', () => {
  it('passes validateMachineDef without errors', () => {
    expect(() => validateMachineDef(LUCKY_21)).not.toThrow()
  })

  it('reels 1 and 2 are pure deal reels (all CARD); specials only on reels 3-5', () => {
    expect(LUCKY_21.reels).toHaveLength(5)
    expect(LUCKY_21.reels[0]!.every(s => s === 'CARD')).toBe(true)
    expect(LUCKY_21.reels[1]!.every(s => s === 'CARD')).toBe(true)
    // every non-CARD token is a known multiplier, minus, or the bust symbol
    const special = new Set([
      ...Object.keys(LUCKY_21.multiplierSymbols),
      ...Object.keys(LUCKY_21.minusSymbols),
      LUCKY_21.bustSymbol
    ])
    for (const reel of LUCKY_21.reels) {
      for (const s of reel) {
        if (s !== 'CARD') expect(special.has(s), s).toBe(true)
      }
    }
  })

  it('reel compositions match the calibrated layout', () => {
    const counts = LUCKY_21.reels.map((reel) => {
      const c: Record<string, number> = {}
      for (const s of reel) c[s] = (c[s] ?? 0) + 1
      return c
    })
    expect(counts[0]).toEqual({ CARD: 10 })
    expect(counts[1]).toEqual({ CARD: 10 })
    expect(counts[2]).toEqual({ BUST: 8, MX2: 1, MX3: 1, MM3: 1 })
    expect(counts[3]).toEqual({ CARD: 2, BUST: 9, MX3: 1, MM3: 1 })
    expect(counts[4]).toEqual({ CARD: 2, BUST: 11, MX5: 2, MX10: 1 })
  })

  it('every pay, naturalPay, and charlieMultiplier is a positive integer (integer-credit invariant)', () => {
    for (const e of LUCKY_21.paytable) {
      expect(Number.isInteger(e.pay), `pay for total ${e.total}`).toBe(true)
      expect(e.pay).toBeGreaterThan(0)
    }
    expect(Number.isInteger(LUCKY_21.naturalPay)).toBe(true)
    expect(LUCKY_21.naturalPay).toBeGreaterThan(0)
    expect(Number.isInteger(LUCKY_21.charlieMultiplier)).toBe(true)
    expect(LUCKY_21.charlieMultiplier).toBeGreaterThanOrEqual(1)
    // GENTLE climbing curve: a 21 banks strictly more than the 15 floor, and a
    // 2-card natural is a strict premium over a built-up 21 (the design feel —
    // "the closer to 21, the more you bank").
    const pay15 = LUCKY_21.paytable.find(e => e.total === 15)!.pay
    const pay21 = LUCKY_21.paytable.find(e => e.total === 21)!.pay
    expect(pay21).toBeGreaterThan(pay15)
    expect(LUCKY_21.naturalPay).toBeGreaterThan(pay21)
  })

  it('handPayout is always a whole number of credits under optimal play (varying ante)', () => {
    const policy = makeOptimalStopFn(LUCKY_21)
    const rand = mulberry32(987654)
    for (let i = 0; i < 60_000; i++) {
      const state: MachineSessionState = {
        progressive: null, videoFeature: null, pachislo: null, blackjackReel: null
      }
      const coins = 1 + Math.floor(rand() * LUCKY_21.maxCoins)
      dealReels(LUCKY_21, state, coins, rand)
      let out = stopReel(LUCKY_21, state, rand)
      if (state.blackjackReel!.phase !== 'resolved') out = stopReel(LUCKY_21, state, rand)
      while (state.blackjackReel!.phase === 'spinning') {
        if (policy(state.blackjackReel!) === 'cash') {
          out = cashOut(LUCKY_21, state)
          break
        }
        out = stopReel(LUCKY_21, state, rand)
      }
      expect(Number.isInteger(out.totalPayout), `non-integer payout ${out.totalPayout} (coins ${coins})`).toBe(true)
    }
  })
})

describe('lucky-21 — FROZEN calibration (optimal stopping)', () => {
  it('exactRtp dispatches blackjack-reel to the optimal-stopping DP', () => {
    // exactRtp(def) must route to blackjackReelExactRtp and return the same figures.
    expect(exactRtp(LUCKY_21).rtpPerCoin).toBeCloseTo(blackjackReelExactRtp(LUCKY_21).rtpPerCoin, 12)
  })

  it('FROZEN: rtpPerCoin = 0.9008462712680554 (≈ 90.08%), inside [0.89, 0.91]', () => {
    const { report } = rates()
    expect(report.rtpPerCoin).toBeCloseTo(0.9008462712680554, 10)
    expect(report.rtpPerCoin).toBeGreaterThanOrEqual(0.89)
    expect(report.rtpPerCoin).toBeLessThanOrEqual(0.91)
  })

  it('FROZEN: hitFrequency = 0.5204396594571127, variancePerCoin = 8.627557473749649', () => {
    const { report } = rates()
    expect(report.hitFrequency).toBeCloseTo(0.5204396594571127, 10)
    expect(report.variancePerCoin).toBeCloseTo(8.627557473749649, 8)
  })

  it('FROZEN: bust rate 0.47956034054288743 (~48%), Charlie rate 0.010635737888485142 (~1.06%)', () => {
    const { bust, charlie } = rates()
    expect(bust).toBeCloseTo(0.47956034054288743, 10)
    expect(charlie).toBeCloseTo(0.010635737888485142, 10)
    // believable bust band + a non-trivial (jackpot-frequency) Charlie
    expect(bust).toBeGreaterThan(0.40)
    expect(bust).toBeLessThan(0.55)
    expect(charlie).toBeGreaterThan(0)
  })

  it('breakdown buckets sum to rtpPerCoin and probabilities sum to 1', () => {
    const { report, bust, charlie, cash } = rates()
    const contribSum = report.breakdown.reduce((a, b) => a + b.contribution, 0)
    expect(contribSum).toBeCloseTo(report.rtpPerCoin, 10)
    expect(bust + charlie + cash).toBeCloseTo(1, 10)
  })
})
