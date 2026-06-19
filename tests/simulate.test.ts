import { describe, it, expect } from 'vitest'
import { addCoinToProgressive, initMachineState, simulateMachine, spin } from '../app/engine'
import { FLOOR } from '../app/machines'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { CANAL_ROYALE } from '../app/machines/canal-royale'
import { DRAGONS_HOARD } from '../app/machines/dragons-hoard'
import { THUNDER_VAULT } from '../app/machines/thunder-vault'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import { mulberry32 } from '../app/engine/rng'

describe('FLOOR', () => {
  it('contains the nine floor machines (Flameout 21 + Stop & Lock 777 are parked), all valid', () => {
    expect(FLOOR.map(m => m.id).sort()).toEqual([
      'canal-royale', 'diamond-doubler', 'dragons-hoard', 'ruby-of-gargoyle', 'series-e-3line', 'series-e-multiplier', 'sevens-ablaze', 'stock-rush', 'thunder-vault'
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
    expect(r.hitFrequency).toBeGreaterThan(0.10)
    expect(r.hitFrequency).toBeLessThan(0.20)
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

describe('simulateMachine v2 — feature-aware cycles', () => {
  it('video: totalIn is exactly spins x coins (free spins cost 0; features drain)', () => {
    const sim = simulateMachine(CANAL_ROYALE, {
      spins: 50_000, coins: 25, seed: 11, progressiveMode: 'static'
    })
    expect(sim.totalIn).toBe(50_000 * 25)
    expect(sim.spins).toBe(50_000)
    expect(sim.rtp).toBeGreaterThan(0.80)
    expect(sim.rtp).toBeLessThan(1.05)
    expect(sim.byEntry['sc3'] ?? 0).toBeGreaterThan(0)
    expect(sim.maxDrawdown).toBeGreaterThan(0)
  })

  it('thunder-vault static: every Grand pays exactly the reset value', () => {
    const sim = simulateMachine(THUNDER_VAULT, {
      spins: 60_000, coins: 25, seed: 12, progressiveMode: 'static'
    })
    expect(sim.totalIn).toBe(60_000 * 25)
    // P(fill) = 1/5138 per base spin -> ~11.7 expected Grand hits; 3.5 sigma ~ 12
    expect(sim.jackpotHits).toBeGreaterThan(1)
    expect(sim.jackpotHits).toBeLessThan(25)
    expect(sim.byEntry['grand'] ?? 0).toBe(sim.jackpotHits)
  })

  it('pachislo: replays make totalIn less than 3 x games; oddsLevel moves RTP', () => {
    const l1 = simulateMachine(STOCK_RUSH, {
      spins: 50_000, coins: 3, seed: 13, progressiveMode: 'static', oddsLevel: 1
    })
    const l6 = simulateMachine(STOCK_RUSH, {
      spins: 50_000, coins: 3, seed: 13, progressiveMode: 'static', oddsLevel: 6
    })
    expect(l1.spins).toBe(50_000)
    // replay rate 2245/16384 -> totalIn ~ 3 x 50k x (1 - 0.137) plus ~1/game bonus tokens
    expect(l1.totalIn).toBeLessThan(3 * 50_000)
    expect(l1.totalIn).toBeGreaterThan(2.3 * 50_000)
    expect(l6.rtp).toBeGreaterThan(l1.rtp + 0.3) // 120.0% vs 66.0% exact gap, huge margin
  })

  it('pachislo bonus accounting: jac wins = 8 x REG + 24 x BIG, exactly (drain closes bonuses)', () => {
    const sim = simulateMachine(STOCK_RUSH, {
      spins: 200_000, coins: 3, seed: 14, progressiveMode: 'static', oddsLevel: 6
    })
    const reg = sim.byEntry['reg'] ?? 0
    const big = sim.byEntry['big'] ?? 0
    expect(reg).toBeGreaterThan(0)
    expect(big).toBeGreaterThan(0)
    expect(sim.byEntry['jac'] ?? 0).toBe(8 * reg + 24 * big)
    // interludes: at most 10 bells per BIG (2 x cap 5)
    expect(sim.byEntry['interlude-bell'] ?? 0).toBeLessThanOrEqual(10 * big)
  })

  it('dragon\'s hoard: retriggered free spins drain and totalIn stays exact', () => {
    const sim = simulateMachine(DRAGONS_HOARD, {
      spins: 30_000, coins: 25, seed: 15, progressiveMode: 'static'
    })
    expect(sim.totalIn).toBe(30_000 * 25)
    expect(sim.rtp).toBeGreaterThan(0.80)
    expect(sim.rtp).toBeLessThan(1.10)
    expect(sim.maxDrawdown).toBeGreaterThan(0)
  })

  it('pachislo: oddsLevel guard rejects out-of-range values', () => {
    expect(() => simulateMachine(STOCK_RUSH, {
      spins: 10, coins: 3, seed: 1, progressiveMode: 'static', oddsLevel: 7
    })).toThrow(/out of range/)
    expect(() => simulateMachine(STOCK_RUSH, {
      spins: 10, coins: 3, seed: 1, progressiveMode: 'static', oddsLevel: 0
    })).toThrow(/out of range/)
  })
})
