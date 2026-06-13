import { describe, it, expect } from 'vitest'
import { addCoinToProgressive, initMachineState, simulateMachine, spin } from '../app/engine'
import { FLOOR } from '../app/machines'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { mulberry32 } from '../app/engine/rng'

describe('FLOOR', () => {
  it('contains the four Plan-1 machines, all valid', () => {
    expect(FLOOR.map(m => m.id).sort()).toEqual([
      'diamond-doubler', 'series-e-3line', 'series-e-multiplier', 'sevens-ablaze'
    ])
  })
})

describe('spin dispatch', () => {
  it('routes families to the right evaluator', () => {
    const s1 = spin(DIAMOND_DOUBLER, initMachineState(DIAMOND_DOUBLER), 1, mulberry32(1))
    expect(s1.family).toBe('stepper')
    const s2 = spin(SERIES_E_3LINE, initMachineState(SERIES_E_3LINE), 1, mulberry32(1))
    expect(s2.family).toBe('bally-em')
  })
})

describe('initMachineState', () => {
  it('initializes progressive meters at reset', () => {
    const st = initMachineState(SERIES_E_3LINE)
    expect(st.progressive?.kind).toBe('dual')
    if (st.progressive?.kind === 'dual') {
      expect(st.progressive.upper).toBe(5000)
      expect(st.progressive.lower).toBe(1000)
    }
    expect(initMachineState(DIAMOND_DOUBLER).progressive).toBeNull()
  })
})

describe('simulateMachine', () => {
  it('is reproducible by seed', () => {
    const a = simulateMachine(DIAMOND_DOUBLER, { spins: 10_000, coins: 1, seed: 7, progressiveMode: 'static' })
    const b = simulateMachine(DIAMOND_DOUBLER, { spins: 10_000, coins: 1, seed: 7, progressiveMode: 'static' })
    expect(a.rtp).toBe(b.rtp)
    expect(a.totalOut).toBe(b.totalOut)
  })

  it('accounts coin-in and payouts coherently', () => {
    const r = simulateMachine(DIAMOND_DOUBLER, { spins: 50_000, coins: 3, seed: 11, progressiveMode: 'static' })
    expect(r.totalIn).toBe(50_000 * 3)
    expect(r.rtp).toBeCloseTo(r.totalOut / r.totalIn, 12)
    expect(r.hitRate).toBeGreaterThan(0.10)
    expect(r.hitRate).toBeLessThan(0.20)
    expect(r.maxDrawdown).toBeGreaterThan(0)
  })

  it('live progressive mode feeds meters and pays above static on average', () => {
    // E-1203 jackpot is ~1/24k: 500k spins at 3 coins gives ~20 hits.
    const def = FLOOR.find(m => m.id === 'series-e-multiplier')!
    const live = simulateMachine(def, { spins: 500_000, coins: 3, seed: 13, progressiveMode: 'live' })
    expect(live.jackpotHits).toBeGreaterThan(5)
    // meters grew before each hit, so payout >= the static-reset accounting
    const stat = simulateMachine(def, { spins: 500_000, coins: 3, seed: 13, progressiveMode: 'static' })
    expect(live.totalOut).toBeGreaterThanOrEqual(stat.totalOut)
  })
})

describe('FO-5140 counter persistence across a jackpot hit', () => {
  it('dual toggle/coin counters continue through a hit; only the hit meter resets', () => {
    const def = SERIES_E_3LINE
    const state = initMachineState(def)
    const prog = state.progressive
    if (prog?.kind !== 'dual' || def.progressive?.kind !== 'dual') throw new Error('expected dual')
    // 7 coins, coinsPerToggle 1: upper sees coins 1,3,5,7 (counter 4 of 5); live ends 'lower'
    for (let i = 0; i < 7; i++) addCoinToProgressive(prog, def.progressive)
    expect(prog.upperCoins).toBe(4)
    expect(prog.live).toBe('lower')
    // force 5xS7 on the center line via rigged stops
    const stops = def.strips.map((strip) => {
      const idx = strip.indexOf('S7')
      return (idx - 1 + strip.length) % strip.length
    })
    let i = 0
    const rigged = () => (stops[i++]! + 0.5) / def.stops
    const out = spin(def, state, 1, rigged)
    expect(out.progressiveEvents).toHaveLength(1)
    // the LIVE (lower) meter paid and reset; counters and live did NOT reset
    expect(prog.lower).toBe(def.progressive.lower.reset)
    expect(prog.upperCoins).toBe(4)
    expect(prog.live).toBe('lower')
  })
})
