// tests/sessions.test.ts
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../app/engine'
import { ALL_MACHINES } from '../app/machines'
import { deriveSeed, simulateSession } from '../app/engine/sessions'
import type { SessionOptions } from '../app/engine/sessions'
import type { CascadeMachineDef } from '../app/engine/types'

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

describe('simulateSession — stop-and-lock-777 (lock-reel cash-collect)', () => {
  // Resolved from ALL_MACHINES — Stop & Lock 777 is parked (off the floor) but
  // resolvable, so the Sim Lab can run it. (Closes the gap Flameout 21 shipped
  // with, where selecting the machine in the Sim Lab errored.)
  const def = byId('stop-and-lock-777')

  it('runs without error and is reproducible for the same seed', () => {
    const a = simulateSession(def, opts({ startCredits: 1000, bet: 1, spinCap: 200 }), mulberry32(deriveSeed(31, 0)))
    const b = simulateSession(def, opts({ startCredits: 1000, bet: 1, spinCap: 200 }), mulberry32(deriveSeed(31, 0)))
    expect(a).toEqual(b)
  })

  it('charges exactly the ante per round and never goes negative', () => {
    for (let i = 0; i < 50; i++) {
      const r = simulateSession(def, opts({ startCredits: 2000, bet: 2, spinCap: 300 }), mulberry32(deriveSeed(32, i)))
      expect(r.endBalance).toBeGreaterThanOrEqual(0)
      expect(r.maxDrawdown).toBeGreaterThanOrEqual(0)
      expect(r.peak).toBeGreaterThanOrEqual(r.endBalance)
      expect(r.peak).toBeGreaterThanOrEqual(2000) // peak is at least the starting bankroll
      // each round charges exactly `bet` coins, so coins-in is rounds × bet
      expect(r.totalIn).toBe(r.spinsPlayed * 2)
    }
  })

  it('busts on a tiny bankroll against a huge cap (RTP < 1)', () => {
    const r = simulateSession(def, opts({ startCredits: 5, bet: 1, spinCap: 1_000_000 }), mulberry32(deriveSeed(33, 0)))
    expect(r.busted).toBe(true)
    expect(r.spinsPlayed).toBeLessThan(1_000_000)
    expect(r.endBalance).toBeLessThan(1) // couldn't afford the next 1-coin ante
  })

  it('survives (does not bust) when the cap is reached with a huge bankroll', () => {
    const r = simulateSession(def, opts({ startCredits: 1_000_000, bet: 1, spinCap: 10 }), mulberry32(deriveSeed(34, 0)))
    expect(r.busted).toBe(false)
    expect(r.spinsPlayed).toBe(10)
  })

  it('records a trajectory only when asked', () => {
    const off = simulateSession(def, opts({ startCredits: 1000, bet: 1, spinCap: 150 }), mulberry32(deriveSeed(35, 0)), false)
    const on = simulateSession(def, opts({ startCredits: 1000, bet: 1, spinCap: 150 }), mulberry32(deriveSeed(35, 0)), true)
    expect(off.trajectory).toEqual([])
    expect(on.trajectory[0]).toBe(1000) // starts at startCredits
    expect(on.trajectory.length).toBeGreaterThan(1)
    expect(on.trajectory.length).toBeLessThanOrEqual(80) // downsampled
  })

  it('empirical RTP over long no-bust sessions sits in a sane band around ~0.945', () => {
    // The lock-reel collect has a heavy GRAND tail (~1-in-10,600, ~4.6% of RTP),
    // so pool several long no-bust sessions for a tight estimate of E[collect].
    let totalIn = 0
    let totalOut = 0
    for (let i = 0; i < 4; i++) {
      const r = simulateSession(def, opts({ startCredits: 50_000_000, bet: 1, spinCap: 400_000 }), mulberry32(deriveSeed(36, i)))
      expect(r.busted).toBe(false)
      expect(r.spinsPlayed).toBe(400_000)
      expect(r.totalIn).toBe(400_000) // bet 1 → coins-in = rounds
      totalIn += r.totalIn
      totalOut += r.totalOut
    }
    const rtp = totalOut / totalIn
    expect(rtp).toBeGreaterThan(0.92)
    expect(rtp).toBeLessThan(0.98)
  })
})

describe('live progressive parity — cascade', () => {
  // A grand-happy cascade def: 2×2 grid, grandTrigger 3 idols (~1 in 9 spins),
  // fat feedRate so a live-fed meter visibly outpays the static reset on hits.
  function grandHappy(): CascadeMachineDef {
    return {
      id: 'grand-happy-cascade',
      name: 'Grand Happy',
      family: 'cascade',
      denominationCents: 1,
      maxCoins: 1,
      cols: 2,
      rows: 2,
      minMatch: 3,
      weights: { A: 1, B: 1, I: 1 },
      paytable: {
        A: [{ countAtLeast: 3, pay: 2 }],
        B: [{ countAtLeast: 3, pay: 1 }]
      },
      multiplierLadder: [1, 3, 5],
      maxTumbles: 10,
      idolSymbol: 'I',
      grandTrigger: 3,
      progressive: { kind: 'percent', reset: 100, max: 100000, feedRate: 5 },
      symbols: { A: { label: 'A' }, B: { label: 'B' }, I: { label: 'Idol' } },
      history: 'test'
    }
  }

  it('live mode feeds the Grand per coin-in, mirroring simulateMachine', () => {
    const def = grandHappy()
    const run = (mode: 'static' | 'live') => simulateSession(
      def,
      opts({ startCredits: 100_000, spinCap: 300, progressiveMode: mode }),
      mulberry32(deriveSeed(21, 0))
    )
    const stat = run('static')
    const live = run('live')
    // Feeding consumes no randomness: identical spin sequence, identical coins-in.
    expect(live.totalIn).toBe(stat.totalIn)
    // The drifted path never fed cascade, leaving every grand at the reset value.
    expect(live.totalOut).toBeGreaterThan(stat.totalOut)
  })
})
