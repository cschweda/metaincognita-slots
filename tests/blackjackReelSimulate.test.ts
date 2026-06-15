// Lucky 21 — simulateMachine convergence tests (Task 6).
//
// Verifies that the simulate branch of simulateMachine drives the Lucky 21
// step functions (dealReels / stopReel / cashOut) under the optimal-stopping
// policy and produces an RTP + hitFrequency that converge to the exact DP
// values within the expected statistical band.
//
// Fixture design notes
// ────────────────────
// The convergence tolerance is 3.5·σ where σ = sqrt(variancePerCoin / N).
// To keep N small (fast CI) we need low variancePerCoin. The fixture below
// avoids large multipliers (≤ ×3) and keeps BUST sparse so the payout
// distribution is compact and variance is modest. Reels 0–1 are all CARD;
// reels 2–4 are a mix of CARD, MX2, MX3, MM3, and one BUST per reel.
//
// N = 300_000 is chosen empirically: with the fixture's variancePerCoin
// the 3.5σ band is ~0.0065, comfortably wider than observed sim drift
// (~0.001) but narrow enough to be a meaningful convergence check.

import { describe, expect, it } from 'vitest'
import { blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'
import { simulateMachine } from '../app/engine/index'
import type { BlackjackReelMachineDef } from '../app/engine/types'

// ---------- fixture ----------

/**
 * Low-variance Lucky 21 def for convergence testing.
 *  • Reels 0–1: pure CARD (no specials; a 10-symbol strip to give uniform
 *    card draw from the dealt strip)
 *  • Reels 2–4: CARD × 4, MX2, MX3, MM3, BUST (8 tokens each)
 *    — Bust probability per late reel: 1/8 = 12.5%, kept modest.
 *    — Multipliers: additive max ×3, applied per reel.
 *    — No ×10 or large Charlie multiplier that would spike variance.
 *  • charlieMultiplier = 2 (mild Charlie premium)
 *  • paytable 15..21 ascending integers to keep payouts compact
 */
const convergenceDef: BlackjackReelMachineDef = {
  id: 'lucky21-sim-test',
  name: 'Lucky 21 Sim Test',
  family: 'blackjack-reel',
  denominationCents: 25,
  maxCoins: 5,
  history: 'Convergence test fixture for Task 6.',
  symbols: {
    CARD: { label: 'Card' },
    MX2: { label: '×2' },
    MX3: { label: '×3' },
    MM3: { label: '−3' },
    BUST: { label: 'Bust' }
  },
  // reels 0–1: 10 CARD tokens (uniform draw from dealt strip)
  reels: [
    ['CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD'],
    ['CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD'],
    // reels 2–4: 4 × CARD, MX2, MX3, MM3, BUST  (8 tokens each)
    ['CARD', 'CARD', 'CARD', 'CARD', 'MX2', 'MX3', 'MM3', 'BUST'],
    ['CARD', 'CARD', 'CARD', 'CARD', 'MX2', 'MX3', 'MM3', 'BUST'],
    ['CARD', 'CARD', 'CARD', 'CARD', 'MX2', 'MX3', 'MM3', 'BUST']
  ],
  multiplierSymbols: { MX2: 2, MX3: 3 },
  minusSymbols: { MM3: 3 },
  bustSymbol: 'BUST',
  paytable: [
    { total: 15, pay: 1 },
    { total: 16, pay: 2 },
    { total: 17, pay: 3 },
    { total: 18, pay: 4 },
    { total: 19, pay: 5 },
    { total: 20, pay: 6 },
    { total: 21, pay: 8 }
  ],
  qualifyMin: 15,
  naturalPay: 12,
  charlieMultiplier: 2,
  progressive: null
}

// ---------- convergence test ----------

describe('simulateMachine — lucky-21 convergence', () => {
  // Spin count: 300_000 hands.
  // The 3.5σ RTP band ≈ 3.5·sqrt(variancePerCoin / N).
  // With the fixture above variancePerCoin is well under 5 (compact pays,
  // modest multipliers), so the band is < 0.009 — a tight sanity check.
  const N = 300_000
  const SEED = 0xCAFEBABE

  it('sim RTP and hitFrequency converge to the exact DP values within 3.5σ', () => {
    const exact = blackjackReelExactRtp(convergenceDef, { coins: 1 })
    const sim = simulateMachine(convergenceDef, { spins: N, coins: 1, seed: SEED, progressiveMode: 'static' })

    const rtpBand = 3.5 * Math.sqrt(exact.variancePerCoin / N)
    const hfBand = 3.5 * Math.sqrt(exact.hitFrequency * (1 - exact.hitFrequency) / N)

    // Diagnostic info (printed on failure)
    expect({ exactRtp: exact.rtpPerCoin, simRtp: sim.rtp, rtpBand }).toMatchObject({
      exactRtp: expect.any(Number)
    })
    expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(rtpBand)
    expect(Math.abs(sim.hitFrequency - exact.hitFrequency)).toBeLessThan(hfBand)
  })

  it('SimResult fields are well-formed', () => {
    const sim = simulateMachine(convergenceDef, { spins: 1000, coins: 1, seed: 42, progressiveMode: 'static' })
    expect(sim.machineId).toBe(convergenceDef.id)
    expect(sim.spins).toBe(1000)
    expect(sim.coins).toBe(1)
    expect(sim.totalIn).toBe(1000) // 1 coin ante × 1000 hands
    expect(sim.totalOut).toBeGreaterThanOrEqual(0)
    expect(sim.jackpotHits).toBe(0) // no progressive
    expect(sim.maxDrawdown).toBeGreaterThanOrEqual(0)
    // byEntry keys should be outcome ids: total-<N>, charlie, or bust
    for (const key of Object.keys(sim.byEntry)) {
      expect(key === 'charlie' || /^total-\d+$/.test(key)).toBe(true)
    }
  })

  it('totalIn is exactly spins × coins (ante charged once per hand)', () => {
    const sim = simulateMachine(convergenceDef, { spins: 500, coins: 3, seed: 99, progressiveMode: 'static' })
    expect(sim.totalIn).toBe(500 * 3)
  })
})
