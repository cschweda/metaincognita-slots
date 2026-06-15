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
import { freshBlackjackState, dealReels, stopReel, cashOut } from '../app/engine/blackjackReel'
import { mulberry32 } from '../app/engine/rng'
import { initMachineState } from '../app/engine/index'
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

// ---------- 7. regression: minus must recompute+ratchet bestTotal ──────────
//
// Bug: afterSpecial only did hard = max(0, hard - n) for a minus, leaving
// bestTotal unchanged. A minus can re-enable a soft-ace promotion, raising
// bestTotal (e.g. state hard=13, aces=1, bestTotal=13; then MM2 minus-2 →
// hard=11, ace promotes to 21 → bestTotal SHOULD become 21 not stay 13).
// The DP therefore under-reported EV for minus paths and mispriced policy.
//
// Fix: after computing the new hard, call bestTotal(hard, aces) and ratchet,
// mirroring stopReel's recompute-whole-hand path.
//
// These tests directly verify the bug at the DP level:
//
//  (a) Deterministic EV test — a def whose only next-reel tokens are MM2
//      (minus-2) and BUST, with the current hand at hard=13, aces=1,
//      bestTotal=13 (and paytable paying for total=21). Pre-fix: evContinue=0
//      (MM2 → bestTotal stays 13, no payout). Post-fix: evContinue>0 (MM2 →
//      bestTotal ratchets to 21, pays).
//
//  (b) Seeded MC convergence — confirms the DP exact RTP and the sim RTP
//      computed under the same policy converge (using a def with very low
//      variance so the check is statistically tight).

describe('regression: minus recompute+ratchet bestTotal', () => {
  // ── (a) deterministic EV test ──────────────────────────────────────────

  // Def where the only non-BUST token on reel 2 is MM2 (minus-2), so that the
  // DP's afterSpecial for this reel is exercised exactly. Reels 3 and 4 are
  // all-BUST so they force the player to cash at reel 3 — this isolates the
  // bestTotal ratchet: only the reel-2 minus (not later cards) can change it.
  //
  // Paytable: only total=21 pays (40 per coin); everything else zero.
  // Current hand state entering reel 2: hard=13, aces=1, bestTotal=13.
  // After MM2: hard = max(0, 13−2) = 11. bestTotal(11,1) = 21 ≤ 21 → total=21.
  // Ratchet: max(13, 21) = 21. Cash immediately at reel 3 (continuing = BUST).
  // Fix: evContinue(reel2) = 0.5(MM2)×40 + 0.5(BUST)×0 = 20 > 0.
  // Bug: bestTotal stays 13 → paytable(13)=0 → cash value=0 → evContinue=0.

  const minusEv21Def = def({
    reels: [
      ['CARD'],
      ['CARD'],
      // reel 2: 50% MM2 (minus-2), 50% BUST
      ['MM2', 'BUST'],
      // reels 3+4: all-BUST, so after MM2 the best play is to cash immediately
      ['BUST'],
      ['BUST']
    ],
    // Only total=21 pays; everything else 0 → bestTotal=21 vs 13 directly visible
    paytable: [{ total: 21, pay: 40 }],
    qualifyMin: 21,
    naturalPay: 60,
    charlieMultiplier: 3
  })

  it('evContinue > 0 when MM2 raises bestTotal from 13 to 21 via ace promotion (pre-fix: evContinue = 0)', () => {
    // Hand state entering reel 2: hard=13, aces=1, bestTotal=13.
    // (hard=13, aces=1: bestTotal(13,1) = 23 > 21 → stays 13.)
    const bj = spinning(2, {
      hand: ['2S', 'AH'], // deck depletion only; hard/aces/bestTotal overridden below
      hard: 13,
      aces: 1,
      bestTotal: 13,
      multSum: 0
    })
    const ev = decisionEvs(minusEv21Def, bj)
    expect(ev).not.toBeNull()
    // Post-fix: MM2 branch gives hard=11, aces=1 → total=21 → pays 40 × 0.5 (BUST 50%) = 20 > 0.
    // Pre-fix: MM2 branch gives bestTotal=13 → paytable(13)=0 → evContinue=0.
    expect(ev!.evContinue).toBeGreaterThan(0)
  })

  // ── (b) seeded MC convergence (low-variance def so tight statistical check) ─

  // Use a def with no specials (pure card-only reels), so variance is much lower
  // and convergence is achievable at modest N. The minus bug only fires on the
  // EV test above; this test just validates the general sim↔exact agreement.
  const allCardDef = def({
    reels: [
      ['CARD', 'CARD'],
      ['CARD', 'CARD'],
      ['CARD', 'CARD'],
      ['CARD', 'CARD'],
      ['CARD', 'CARD']
    ]
  })

  it('sim RTP converges to exact DP RTP (no-special, low-variance def)', () => {
    const SEED = 0xDEADBEEF
    const N = 2_000

    const exact = blackjackReelExactRtp(allCardDef)
    const rand = mulberry32(SEED)
    let totalPayout = 0

    for (let i = 0; i < N; i++) {
      const state = initMachineState(allCardDef)
      dealReels(allCardDef, state, 1, rand)
      while (state.blackjackReel!.phase === 'spinning') {
        const bj = state.blackjackReel!
        const action = optimalStop(allCardDef, bj)
        if (action === 'cash') {
          const out = cashOut(allCardDef, state)
          totalPayout += out.totalPayout
          break
        } else {
          const out = stopReel(allCardDef, state, rand)
          if (state.blackjackReel!.phase === 'resolved') {
            totalPayout += out.totalPayout
            break
          }
        }
      }
    }

    const simRtp = totalPayout / N
    const tolerance = 4 * Math.sqrt(exact.variancePerCoin / N)
    expect(Math.abs(simRtp - exact.rtpPerCoin)).toBeLessThan(tolerance)
  })
})
