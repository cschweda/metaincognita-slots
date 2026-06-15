/**
 * Task 5: exactRtp dispatch + simulateMachine + simulateSession for blackjack-reel.
 *
 * TDD: these tests are written BEFORE the implementation; run them to confirm
 * they fail, then implement in app/engine/exactRtp.ts, app/engine/index.ts, and
 * app/engine/sessions.ts, then run again to confirm they pass.
 */
import { describe, it, expect } from 'vitest'
import type { BlackjackReelMachineDef } from '../app/engine/types'
import { exactRtp, simulateMachine } from '../app/engine'
import { simulateSession, deriveSeed } from '../app/engine/sessions'
import { blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'
import { mulberry32 } from '../app/engine/rng'

// ---------------------------------------------------------------------------
// Shared fixture — same strips used in blackjackReelRtp.test.ts (DP↔live agreement)
// so we piggyback on a well-exercised config that reaches busts, charlies, saves,
// and multipliers.
// ---------------------------------------------------------------------------

const BJ_FIXTURE: BlackjackReelMachineDef = {
  id: 'bj-sim-fixture',
  name: 'BJ Sim Fixture',
  family: 'blackjack-reel',
  denominationCents: 25,
  maxCoins: 1,
  history: 'task-5 test fixture',
  symbols: {
    C2: { label: '2' },
    C7: { label: '7' },
    CT: { label: '10' },
    CA: { label: 'A' },
    MX2: { label: '×2' },
    SAVE: { label: 'Save' }
  },
  cardValues: { C2: 2, C7: 7, CT: 10 },
  aceSymbol: 'CA',
  multiplierSymbols: { MX2: 2 },
  bustSaveSymbol: 'SAVE',
  strips: [
    ['C2', 'C7', 'CT', 'CA'], // reel 0
    ['C7', 'CT', 'SAVE', 'CA'], // reel 1 (can deal a SAVE)
    ['C2', 'C7', 'CT', 'MX2'], // reel 2
    ['C2', 'CT', 'MX2', 'CA'], // reel 3
    ['C2', 'C7', 'CT'] // reel 4
  ],
  paytable: [
    { total: 17, pay: 1 },
    { total: 18, pay: 1.5 },
    { total: 19, pay: 2 },
    { total: 20, pay: 3 },
    { total: 21, pay: 5 }
  ],
  charlieBonus: 8,
  progressive: null
}

// ---------------------------------------------------------------------------
// 1. exactRtp dispatch — the Task-1 throw must be replaced with a real dispatch
// ---------------------------------------------------------------------------

describe('exactRtp dispatch for blackjack-reel', () => {
  it('returns the same report as blackjackReelExactRtp (no throw)', () => {
    const direct = blackjackReelExactRtp(BJ_FIXTURE)
    const dispatched = exactRtp(BJ_FIXTURE) // was: throw 'not implemented'

    expect(dispatched.rtpPerCoin).toBeCloseTo(direct.rtpPerCoin, 12)
    expect(dispatched.hitFrequency).toBeCloseTo(direct.hitFrequency, 12)
    expect(dispatched.variancePerCoin).toBeCloseTo(direct.variancePerCoin, 12)
    expect(dispatched.breakdown.length).toBe(direct.breakdown.length)
  })

  it('does not throw for any coins value (maxCoins=1, so only 1 is valid)', () => {
    expect(() => exactRtp(BJ_FIXTURE, { coins: 1 })).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// 2. simulateMachine convergence — empirical RTP under optimal play converges to
//    the exact figure within ~3.5–4 sigma.
// ---------------------------------------------------------------------------

describe('simulateMachine blackjack-reel convergence', () => {
  it('empirical RTP within 3.5σ of blackjackReelExactRtp over 200k hands', () => {
    const exact = blackjackReelExactRtp(BJ_FIXTURE)

    // simulateMachine must run WITHOUT throwing for blackjack-reel.
    const sim = simulateMachine(BJ_FIXTURE, {
      spins: 200_000,
      coins: 1,
      seed: 20260614,
      progressiveMode: 'static'
    })

    // The sim's rtp = totalOut / totalIn (each hand charges ante=coins=1 in).
    const se = Math.sqrt(exact.variancePerCoin / sim.spins)
    expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(3.5 * se)
  })

  it('each hand is counted as exactly one paid spin (totalIn = spins × coins)', () => {
    const sim = simulateMachine(BJ_FIXTURE, {
      spins: 10_000,
      coins: 1,
      seed: 42,
      progressiveMode: 'static'
    })
    expect(sim.totalIn).toBe(10_000 * 1)
    expect(sim.spins).toBe(10_000)
  })

  it('is reproducible for the same seed', () => {
    const opts = { spins: 5_000, coins: 1, seed: 99, progressiveMode: 'static' as const }
    const a = simulateMachine(BJ_FIXTURE, opts)
    const b = simulateMachine(BJ_FIXTURE, opts)
    expect(a.totalOut).toBe(b.totalOut)
    expect(a.totalIn).toBe(b.totalIn)
    expect(a.rtp).toBe(b.rtp)
  })
})

// ---------------------------------------------------------------------------
// 3. simulateSession smoke — the Sim Lab path must not throw and must return a
//    sane SessionResult for a blackjack-reel machine.
// ---------------------------------------------------------------------------

describe('simulateSession blackjack-reel smoke', () => {
  it('runs without throwing and returns a sane SessionResult', () => {
    const rand = mulberry32(deriveSeed(5, 0))
    const r = simulateSession(
      BJ_FIXTURE,
      { startCredits: 200, bet: 1, spinCap: 200, progressiveMode: 'static' },
      rand
    )

    // structural sanity
    expect(typeof r.busted).toBe('boolean')
    expect(r.endBalance).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(r.endBalance)).toBe(true)
    expect(r.spinsPlayed).toBeGreaterThanOrEqual(0)
    expect(r.maxDrawdown).toBeGreaterThanOrEqual(0)
    expect(r.peak).toBeGreaterThanOrEqual(r.endBalance)
    expect(r.totalIn).toBeGreaterThanOrEqual(0)
  })

  it('busted is true when bankroll exhausted before spinCap', () => {
    // Use a strip set that busts most hands (two ten-cards → always 20, reel 2
    // is all tens → hitting would bust, but we stand; however if paytable only
    // pays on 21 we get 0 for 20 every hand and drain).
    const BUST_DEF: BlackjackReelMachineDef = {
      ...BJ_FIXTURE,
      id: 'bj-bust',
      // deal always 20 (CT+CT); no bust-save; paytable only has 21 → 0 every hand
      strips: [['CT'], ['CT'], ['CT'], ['CT'], ['CT']],
      bustSaveSymbol: null,
      paytable: [{ total: 21, pay: 5 }] // 20 pays nothing
    }
    const rand = mulberry32(deriveSeed(2, 0))
    const r = simulateSession(
      BUST_DEF,
      { startCredits: 5, bet: 1, spinCap: 100_000, progressiveMode: 'static' },
      rand
    )
    expect(r.busted).toBe(true)
    expect(r.spinsPlayed).toBeLessThan(100_000)
    expect(r.endBalance).toBeLessThan(1)
  })

  it('survives when spinCap is tiny and bankroll is huge', () => {
    const rand = mulberry32(deriveSeed(3, 0))
    const r = simulateSession(
      BJ_FIXTURE,
      { startCredits: 1_000_000, bet: 1, spinCap: 10, progressiveMode: 'static' },
      rand
    )
    expect(r.busted).toBe(false)
    expect(r.spinsPlayed).toBe(10)
  })

  it('each hand counts as exactly one paid spin', () => {
    const rand = mulberry32(deriveSeed(4, 0))
    const r = simulateSession(
      BJ_FIXTURE,
      { startCredits: 1_000_000, bet: 1, spinCap: 50, progressiveMode: 'static' },
      rand
    )
    expect(r.busted).toBe(false)
    expect(r.spinsPlayed).toBe(50)
    // Each paid hand costs exactly 1 coin
    expect(r.totalIn).toBe(50)
  })

  it('is reproducible for the same seed', () => {
    const opts = { startCredits: 200, bet: 1, spinCap: 100, progressiveMode: 'static' as const }
    const a = simulateSession(BJ_FIXTURE, opts, mulberry32(deriveSeed(6, 0)))
    const b = simulateSession(BJ_FIXTURE, opts, mulberry32(deriveSeed(6, 0)))
    expect(a).toEqual(b)
  })
})
