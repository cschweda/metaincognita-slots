// Lucky 21 — deck-depletion exact-RTP DP (optimal stopping) tests (Task 5).
//
// The DP must mirror blackjackReel.ts's stopReel / handPayout EXACTLY:
//   - per-reel outcome = specials at count/len + a card branch (cardSlots/len)
//     split over the remaining-deck value distribution (without replacement);
//   - transitions: BUST/over-21 → terminal 0, multiplier → multSum, minus →
//     hard (floor 0), card → ratchet bestTotal, natural on reel index 1 @ 21,
//     5th-reel survival → Five-Card Charlie terminal;
//   - terminal/cash values reuse the real handPayout (single source of truth).

import { describe, expect, it } from 'vitest'
import {
  blackjackReelExactRtp,
  optimalStop,
  decisionEvs,
  strategyMatrixCell
} from '../app/engine/blackjackReelRtp'
import { freshBlackjackState } from '../app/engine/blackjackReel'
import type { BlackjackReelMachineDef, BlackjackReelSessionState } from '../app/engine/types'

// ---------- def factory ----------

function def(over: Partial<BlackjackReelMachineDef>): BlackjackReelMachineDef {
  return {
    id: 'test-21',
    name: 'Test 21',
    family: 'blackjack-reel',
    denominationCents: 25,
    maxCoins: 5,
    history: 'test fixture',
    symbols: {},
    reels: [['CARD'], ['CARD'], ['CARD'], ['CARD'], ['CARD']],
    multiplierSymbols: { MX2: 2, MX3: 3, MX5: 5, MX10: 10 },
    minusSymbols: { MM2: 2, MM3: 3 },
    bustSymbol: 'BUST',
    paytable: [
      { total: 15, pay: 5 },
      { total: 16, pay: 8 },
      { total: 17, pay: 12 },
      { total: 18, pay: 17 },
      { total: 19, pay: 23 },
      { total: 20, pay: 30 },
      { total: 21, pay: 40 }
    ],
    qualifyMin: 15,
    naturalPay: 55,
    charlieMultiplier: 3,
    progressive: null,
    ...over
  }
}

/** Build a live spinning state with a concrete hand (mirrors stopReel results). */
function spinning(
  idx: number,
  fields: Partial<BlackjackReelSessionState>
): BlackjackReelSessionState {
  return {
    ...freshBlackjackState(),
    phase: 'spinning',
    idx,
    ante: 1,
    ...fields
  }
}

// ---------- 1. cash-dominant ----------

describe('optimalStop — cash-dominant', () => {
  it('cashes a qualifying high total when the next reel is certain to bust', () => {
    // Reel index 2 is all BUST → continuing is a guaranteed 0; a 20 pays.
    const d = def({
      reels: [['CARD'], ['CARD'], ['BUST', 'BUST', 'BUST', 'BUST'], ['CARD'], ['CARD']]
    })
    const bj = spinning(2, { hand: ['TS', 'TD'], hard: 20, aces: 0, bestTotal: 20 })
    expect(optimalStop(d, bj)).toBe('cash')
  })
})

// ---------- 2. continue-dominant ----------

describe('optimalStop — continue-dominant', () => {
  it('continues when every remaining reel is all multipliers (no bust risk)', () => {
    // From reel 2 on, each reel only adds multipliers — strictly raising the
    // payout and ending in a Charlie. Continuing dominates cashing 18.
    const d = def({
      reels: [['CARD'], ['CARD'], ['MX2', 'MX2'], ['MX2', 'MX2'], ['MX2', 'MX2']]
    })
    const bj = spinning(2, { hand: ['TS', '8D'], hard: 18, aces: 0, bestTotal: 18 })
    expect(optimalStop(d, bj)).toBe('continue')
  })
})

// ---------- 3. determinism ----------

describe('blackjackReelExactRtp — determinism', () => {
  it('produces identical rtp and policy across two calls', () => {
    const d = def({})
    const a = blackjackReelExactRtp(d)
    const b = blackjackReelExactRtp(d)
    expect(a.rtpPerCoin).toBe(b.rtpPerCoin)
    expect(a.hitFrequency).toBe(b.hitFrequency)
    expect(a.variancePerCoin).toBe(b.variancePerCoin)
    expect(JSON.stringify(a.breakdown)).toBe(JSON.stringify(b.breakdown))

    // policy stable for a representative decision state
    const bj = spinning(2, { hand: ['TS', '8D'], hard: 18, aces: 0, bestTotal: 18 })
    expect(optimalStop(d, bj)).toBe(optimalStop(d, bj))
  })
})

// ---------- 4. closed-form micro-def ----------

describe('blackjackReelExactRtp — closed-form micro-def', () => {
  // Reel 0 deals one card from the FULL 52-deck; reels 1..4 are all BUST, so
  // continuing past the first card is a certain wipe. The player therefore
  // CASHES the single card. With qualifyMin=10 and paytable {10:2, 11:7}:
  //   ten-value cards (16): total 10 → pays 2
  //   aces        (4)     : total 11 → pays 7
  //   2..9        (32)    : total < 10 → pays 0
  // rtpPerCoin = (16·2 + 4·7 + 32·0) / 52 = 60/52 = 15/13.
  const micro = def({
    reels: [['CARD'], ['BUST'], ['BUST'], ['BUST'], ['BUST']],
    paytable: [{ total: 10, pay: 2 }, { total: 11, pay: 7 }],
    qualifyMin: 10,
    naturalPay: 99, // unreachable (no 2-card 21 path)
    charlieMultiplier: 3 // unreachable (every continue busts)
  })

  it('matches the hand calculation 60/52 to 1e-9', () => {
    const report = blackjackReelExactRtp(micro)
    expect(report.rtpPerCoin).toBeCloseTo(60 / 52, 9)
  })

  it('hitFrequency = P(ten) + P(ace) = 20/52', () => {
    const report = blackjackReelExactRtp(micro)
    expect(report.hitFrequency).toBeCloseTo(20 / 52, 9)
  })

  it('optimalStop cashes the one-card hand (continue = certain bust)', () => {
    // After reel 0, idx=1, a single ten-value card (best total 10).
    const bj = spinning(1, { hand: ['TS'], hard: 10, aces: 0, bestTotal: 10 })
    expect(optimalStop(micro, bj)).toBe('cash')
  })
})

// ---------- 5. breakdown invariants ----------

describe('blackjackReelExactRtp — breakdown invariants', () => {
  it('contributions sum to rtpPerCoin and hitFrequency is a probability', () => {
    const d = def({})
    const report = blackjackReelExactRtp(d)
    const sum = report.breakdown.reduce((acc, e) => acc + e.contribution, 0)
    expect(sum).toBeCloseTo(report.rtpPerCoin, 9)
    expect(report.hitFrequency).toBeGreaterThanOrEqual(0)
    expect(report.hitFrequency).toBeLessThanOrEqual(1)

    // probabilities also form a distribution (every resolution is bucketed once)
    const pSum = report.breakdown.reduce((acc, e) => acc + e.probability, 0)
    expect(pSum).toBeCloseTo(1, 9)
  })

  it('buckets resolved hands by total-<N> / charlie / bust', () => {
    const d = def({})
    const report = blackjackReelExactRtp(d)
    for (const e of report.breakdown) {
      expect(e.entryId === 'charlie' || e.entryId === 'bust' || /^total-\d+$/.test(e.entryId)).toBe(true)
    }
  })

  it('validates reels.length === 5', () => {
    expect(() => blackjackReelExactRtp(def({ reels: [['CARD'], ['CARD']] }))).toThrow()
  })
})

// ---------- 6. decisionEvs + strategyMatrixCell ----------

describe('decisionEvs', () => {
  it('returns null off a decision (resolved / forced 5th reel)', () => {
    const d = def({})
    const resolved = { ...freshBlackjackState(), phase: 'resolved' as const }
    expect(decisionEvs(d, resolved)).toBe(null)
    const forced = spinning(5, { hand: ['TS', 'TD', '2C', '3C', '4C'], hard: 19, bestTotal: 19 })
    expect(decisionEvs(d, forced)).toBe(null)
  })

  it('agrees with optimalStop and exposes both EVs', () => {
    const d = def({
      reels: [['CARD'], ['CARD'], ['BUST', 'BUST', 'BUST', 'BUST'], ['CARD'], ['CARD']]
    })
    const bj = spinning(2, { hand: ['TS', 'TD'], hard: 20, aces: 0, bestTotal: 20 })
    const ev = decisionEvs(d, bj)
    expect(ev).not.toBe(null)
    expect(ev!.action).toBe('cash')
    expect(ev!.action).toBe(optimalStop(d, bj))
    expect(ev!.evContinue).toBeCloseTo(0, 9) // all-BUST reel
    expect(ev!.evCash).toBeGreaterThan(ev!.evContinue)
  })
})

describe('strategyMatrixCell', () => {
  it('is internally consistent with the solver for a hard total', () => {
    // All-multiplier remaining reels → continuing dominates at every total.
    const d = def({
      reels: [['CARD'], ['CARD'], ['MX2', 'MX2'], ['MX2', 'MX2'], ['MX2', 'MX2']]
    })
    expect(strategyMatrixCell(d, 18, 2)).toBe('continue')
    // All-BUST remaining reels → cashing a qualifier is forced.
    const d2 = def({
      reels: [['CARD'], ['CARD'], ['BUST', 'BUST'], ['BUST', 'BUST'], ['BUST', 'BUST']]
    })
    expect(strategyMatrixCell(d2, 18, 2)).toBe('cash')
  })

  it('returns a valid action and respects the multSum option', () => {
    const d = def({})
    const a = strategyMatrixCell(d, 17, 2, { multSum: 5 })
    expect(a === 'cash' || a === 'continue').toBe(true)
  })
})
