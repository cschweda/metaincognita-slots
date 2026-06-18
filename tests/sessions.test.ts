// tests/sessions.test.ts
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../app/engine'
import { ALL_MACHINES } from '../app/machines'
import { deriveSeed, simulateSession } from '../app/engine/sessions'
import type { SessionOptions } from '../app/engine/sessions'

// resolve from ALL_MACHINES so the parked Flameout 21 (off the floor) still resolves
const byId = (id: string) => ALL_MACHINES.find(m => m.id === id)!

function opts(over: Partial<SessionOptions> = {}): SessionOptions {
  return { startCredits: 200, bet: 1, spinCap: 200, progressiveMode: 'static', ...over }
}

describe('deriveSeed', () => {
  it('is deterministic and decorrelates adjacent indices', () => {
    expect(deriveSeed(123, 5)).toBe(deriveSeed(123, 5))
    expect(deriveSeed(123, 5)).not.toBe(deriveSeed(123, 6))
    expect(deriveSeed(123, 5)).not.toBe(deriveSeed(124, 5))
  })
})

describe('simulateSession', () => {
  it('is reproducible for the same seed', () => {
    const def = byId('diamond-doubler')
    const a = simulateSession(def, opts(), mulberry32(deriveSeed(1, 0)))
    const b = simulateSession(def, opts(), mulberry32(deriveSeed(1, 0)))
    expect(a).toEqual(b)
  })

  it('never lets the balance go negative and reports a non-negative drawdown', () => {
    const def = byId('diamond-doubler')
    for (let i = 0; i < 50; i++) {
      const r = simulateSession(def, opts({ startCredits: 50 }), mulberry32(deriveSeed(7, i)))
      expect(r.endBalance).toBeGreaterThanOrEqual(0)
      expect(r.maxDrawdown).toBeGreaterThanOrEqual(0)
      // peak must be at least the ending balance and at least the starting bankroll (50)
      expect(r.peak).toBeGreaterThanOrEqual(r.endBalance)
      expect(r.peak).toBeGreaterThanOrEqual(50)
    }
  })

  it('busts (not survives) when it runs out before the cap', () => {
    // Tiny bankroll, huge cap: on a negative-EV game it must bust.
    const def = byId('diamond-doubler')
    const r = simulateSession(def, opts({ startCredits: 5, spinCap: 100000 }), mulberry32(deriveSeed(2, 0)))
    expect(r.busted).toBe(true)
    expect(r.spinsPlayed).toBeLessThan(100000)
    // True invariant: busted means it couldn't afford the next paid spin (bet=1, credits are integers → endBalance === 0)
    expect(r.endBalance).toBeLessThan(1)
  })

  it('survives (not busts) when the cap is reached', () => {
    // Huge bankroll, small cap: cannot bust in so few spins.
    const def = byId('diamond-doubler')
    const r = simulateSession(def, opts({ startCredits: 1_000_000, spinCap: 10 }), mulberry32(deriveSeed(3, 0)))
    expect(r.busted).toBe(false)
    expect(r.spinsPlayed).toBe(10)
  })

  it('counts only paid spins toward the cap (free video features are free)', () => {
    // Canal Royale has free spins; a survived session plays exactly spinCap PAID spins.
    const def = byId('canal-royale')
    const r = simulateSession(def, opts({ startCredits: 1_000_000, bet: 25, spinCap: 40 }), mulberry32(deriveSeed(9, 0)))
    expect(r.busted).toBe(false)
    expect(r.spinsPlayed).toBe(40)
  })

  it('records a trajectory only when asked', () => {
    const def = byId('diamond-doubler')
    const off = simulateSession(def, opts(), mulberry32(deriveSeed(4, 0)), false)
    const on = simulateSession(def, opts(), mulberry32(deriveSeed(4, 0)), true)
    expect(off.trajectory).toEqual([])
    expect(on.trajectory.length).toBeGreaterThan(1)
    expect(on.trajectory[0]).toBe(200) // starts at startCredits
    expect(on.trajectory.length).toBeLessThanOrEqual(80) // downsampled
  })

  it('live progressive mode runs cleanly on a stepper progressive machine', () => {
    const def = byId('sevens-ablaze')
    const r = simulateSession(
      def,
      opts({ startCredits: 500, bet: def.maxCoins, spinCap: 100, progressiveMode: 'live' }),
      mulberry32(deriveSeed(10, 0))
    )
    expect(typeof r.busted).toBe('boolean')
    expect(r.endBalance).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(r.endBalance)).toBe(true)
    expect(r.totalIn).toBeGreaterThanOrEqual(0)
  })

  it('oddsLevel out of range throws for a pachislo machine', () => {
    const def = byId('stock-rush')
    const rand = mulberry32(deriveSeed(11, 0))
    expect(() =>
      simulateSession(def, opts({ bet: def.maxCoins, oddsLevel: 99 }), rand)
    ).toThrow()
    expect(() =>
      simulateSession(def, opts({ bet: def.maxCoins, oddsLevel: 0 }), mulberry32(deriveSeed(11, 1)))
    ).toThrow()
  })

  it('a pachislo session runs and returns a valid result', () => {
    const def = byId('stock-rush')
    const r = simulateSession(
      def,
      opts({ startCredits: 5000, bet: def.maxCoins, spinCap: 100 }),
      mulberry32(deriveSeed(12, 0))
    )
    expect(r.spinsPlayed).toBeGreaterThanOrEqual(0)
    expect(r.endBalance).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(r.endBalance)).toBe(true)
  })
})

describe('simulateSession — flameout-21 (crash)', () => {
  const def = byId('flameout-21')

  it('is reproducible for the same seed', () => {
    const a = simulateSession(def, opts({ startCredits: 100, bet: 5, spinCap: 200 }), mulberry32(deriveSeed(21, 0)))
    const b = simulateSession(def, opts({ startCredits: 100, bet: 5, spinCap: 200 }), mulberry32(deriveSeed(21, 0)))
    expect(a).toEqual(b)
  })

  it('charges exactly the ante per hand and never goes negative', () => {
    for (let i = 0; i < 50; i++) {
      const r = simulateSession(def, opts({ startCredits: 80, bet: 5, spinCap: 300 }), mulberry32(deriveSeed(22, i)))
      expect(r.endBalance).toBeGreaterThanOrEqual(0)
      expect(r.maxDrawdown).toBeGreaterThanOrEqual(0)
      expect(r.peak).toBeGreaterThanOrEqual(r.endBalance)
      expect(r.peak).toBeGreaterThanOrEqual(80) // peak is at least the starting bankroll
      // each hand charges exactly `bet` coins, so coins-in is hands × bet
      expect(r.totalIn).toBe(r.spinsPlayed * 5)
    }
  })

  it('busts on a tiny bankroll against a huge cap (RTP < 1)', () => {
    const r = simulateSession(def, opts({ startCredits: 5, bet: 1, spinCap: 1_000_000 }), mulberry32(deriveSeed(23, 0)))
    expect(r.busted).toBe(true)
    expect(r.spinsPlayed).toBeLessThan(1_000_000)
    expect(r.endBalance).toBeLessThan(1) // couldn't afford the next 1-coin ante
  })

  it('survives (does not bust) when the cap is reached with a huge bankroll', () => {
    const r = simulateSession(def, opts({ startCredits: 1_000_000, bet: 5, spinCap: 10 }), mulberry32(deriveSeed(24, 0)))
    expect(r.busted).toBe(false)
    expect(r.spinsPlayed).toBe(10)
  })

  it('records a trajectory only when asked', () => {
    const off = simulateSession(def, opts({ startCredits: 100, bet: 5, spinCap: 100 }), mulberry32(deriveSeed(25, 0)), false)
    const on = simulateSession(def, opts({ startCredits: 100, bet: 5, spinCap: 100 }), mulberry32(deriveSeed(25, 0)), true)
    expect(off.trajectory).toEqual([])
    expect(on.trajectory[0]).toBe(100) // starts at startCredits
    expect(on.trajectory.length).toBeGreaterThan(1)
    expect(on.trajectory.length).toBeLessThanOrEqual(80) // downsampled
  })

  it('empirical RTP over a long no-bust session tracks the exact ~96.96%', () => {
    const r = simulateSession(def, opts({ startCredits: 5_000_000, bet: 5, spinCap: 40_000 }), mulberry32(deriveSeed(26, 0)))
    expect(r.busted).toBe(false)
    expect(r.spinsPlayed).toBe(40_000)
    expect(r.totalIn).toBe(40_000 * 5)
    const rtp = r.totalOut / r.totalIn
    expect(rtp).toBeGreaterThan(0.92)
    expect(rtp).toBeLessThan(1.02)
  })
})
