// Lucky 21 (blackjack-reel) machine-integrity + frozen-calibration tests.
//
// Frozen exact-math figures come from blackjackReelExactRtp(LUCKY_21) under the
// optimal cash/continue policy. They are cross-validated by pnpm verify (sim RTP
// vs the exact DP inside its 3.5σ band). If these change, the calibration in
// app/machines/lucky-21.ts changed — update both deliberately.

import { describe, it, expect } from 'vitest'
import { exactRtp } from '../app/engine/exactRtp'
import { blackjackReelExactRtp, makeOptimalStopFn, optimalStop } from '../app/engine/blackjackReelRtp'
import { validateMachineDef } from '../app/engine/validate'
import { dealReels, stopReel, cashOut, freshBlackjackState, gambleStop, gambleCashOut } from '../app/engine/blackjackReel'
import { mulberry32 } from '../app/engine/rng'
import { LUCKY_21 } from '../app/machines/lucky-21'
import type { MachineSessionState } from '../app/engine/types'

// Deterministic RNG helper: returns the given sequence then 0s.
function seq(values: number[]) {
  let i = 0
  return () => (i < values.length ? values[i++]! : 0)
}

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

describe('blackjack bonus — fresh state', () => {
  it('defaults the gamble fields', () => {
    const s = freshBlackjackState()
    expect(s.phase).toBe('idle')
    expect(s.gambleAmount).toBe(0)
    expect(s.gambleCount).toBe(0)
  })
})

function freshState(): MachineSessionState {
  return { progressive: null, videoFeature: null, pachislo: null, blackjackReel: null }
}

describe('blackjack bonus — natural enters gamble', () => {
  it('a 2-card 21 ends spinning and opens the gamble at naturalPay x ante', () => {
    const state = freshState()
    // Force reel strips so reel 1 -> Ace, reel 2 -> a ten-value card.
    dealReels(LUCKY_21, state, 1, seq([0]))
    const bj = state.blackjackReel!
    bj.reelStrips[0] = ['AS']
    bj.reelStrips[1] = ['TH']
    stopReel(LUCKY_21, state, seq([0])) // lock reel 1 -> AS
    stopReel(LUCKY_21, state, seq([0])) // lock reel 2 -> TH => natural 21
    expect(bj.natural).toBe(true)
    expect(bj.phase).toBe('gamble')
    expect(bj.gambleAmount).toBe(LUCKY_21.naturalPay * 1) // ante = 1
    expect(bj.gambleCount).toBe(0)
    expect(bj.landed.slice(0, 2)).toEqual(['AS', 'TH'])
  })
})

function naturalState(): MachineSessionState {
  const state = freshState()
  dealReels(LUCKY_21, state, 1, seq([0]))
  const bj = state.blackjackReel!
  bj.reelStrips[0] = ['AS']
  bj.reelStrips[1] = ['TH']
  stopReel(LUCKY_21, state, seq([0]))
  stopReel(LUCKY_21, state, seq([0])) // now phase 'gamble', gambleAmount = naturalPay
  return state
}

describe('blackjack bonus — gamble resolution', () => {
  it('cash out keeps the guaranteed amount and resolves', () => {
    const state = naturalState()
    const out = gambleCashOut(LUCKY_21, state)
    expect(state.blackjackReel!.phase).toBe('resolved')
    expect(out.totalPayout).toBe(LUCKY_21.naturalPay)
  })

  it('STOP win doubles and keeps spinning until the cap', () => {
    const state = naturalState()
    const base = LUCKY_21.naturalPay
    gambleStop(LUCKY_21, state, seq([0.0])) // rand<0.5 => win (double)
    expect(state.blackjackReel!.phase).toBe('gamble')
    expect(state.blackjackReel!.gambleAmount).toBe(base * 2)
    expect(state.blackjackReel!.gambleCount).toBe(1)
  })

  it('STOP win at the cap (3 doubles) auto-resolves paying base x 8', () => {
    const state = naturalState()
    const base = LUCKY_21.naturalPay
    gambleStop(LUCKY_21, state, seq([0.0]))
    gambleStop(LUCKY_21, state, seq([0.0]))
    const out = gambleStop(LUCKY_21, state, seq([0.0]))
    expect(state.blackjackReel!.gambleCount).toBe(3)
    expect(state.blackjackReel!.phase).toBe('resolved')
    expect(out.totalPayout).toBe(base * 8)
  })

  it('STOP loss zeroes the amount and resolves', () => {
    const state = naturalState()
    const out = gambleStop(LUCKY_21, state, seq([0.9])) // rand>=0.5 => bust
    expect(state.blackjackReel!.phase).toBe('resolved')
    expect(state.blackjackReel!.gambleAmount).toBe(0)
    expect(out.totalPayout).toBe(0)
  })

  it('payout stays a whole number of credits across antes and rungs', () => {
    for (const ante of [1, 3, 5]) {
      const state = freshState()
      dealReels(LUCKY_21, state, ante, seq([0]))
      const bj = state.blackjackReel!
      bj.reelStrips[0] = ['AS']
      bj.reelStrips[1] = ['TH']
      stopReel(LUCKY_21, state, seq([0]))
      stopReel(LUCKY_21, state, seq([0]))
      gambleStop(LUCKY_21, state, seq([0.0]))
      const out = gambleCashOut(LUCKY_21, state)
      expect(Number.isInteger(out.totalPayout)).toBe(true)
      expect(out.totalPayout).toBe(LUCKY_21.naturalPay * ante * 2)
    }
  })
})

describe('blackjack bonus — DP treats a natural as terminal', () => {
  it('optimalStop on a 2-card natural is cash (cannot continue)', () => {
    const bj = { ...freshBlackjackState(), phase: 'spinning' as const,
      idx: 2, hand: ['AS', 'TH'], hard: 11, aces: 1, multSum: 0,
      bestTotal: 21, natural: true, ante: 1 }
    expect(optimalStop(LUCKY_21, bj)).toBe('cash')
  })
})
