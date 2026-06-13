import { describe, it, expect } from 'vitest'
import { nearMisses } from '../app/engine/nearMiss'
import { initMachineState, mulberry32, spin } from '../app/engine'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { CANAL_ROYALE } from '../app/machines/canal-royale'
import { THUNDER_VAULT } from '../app/machines/thunder-vault'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import { FLOOR } from '../app/machines'
import type { SpinOutcome } from '../app/engine'

/** Minimal hand-built outcome: only the fields nearMisses reads. */
function outcomeFor(partial: Partial<SpinOutcome>): SpinOutcome {
  return {
    machineId: 'x', family: 'stepper', coins: 1, gameKind: 'base', coinsIn: 1,
    stops: [], grid: [], wins: [], totalPayout: 0, progressiveEvents: [],
    featureEvents: [], trace: { draws: [] },
    ...partial
  } as SpinOutcome
}

describe('stepper near-misses (Telnaes teasing is real and quantified)', () => {
  it('flags the top symbol one stop off the payline with its virtual weight', () => {
    // DW is diamond-doubler's allWild top symbol; put it on row 0 of reel 0.
    // Physical strip 0: ['DW','B1','S7',...] so stop=1 => row0=DW(phys 0), row1=B1(phys 1).
    const out = outcomeFor({
      machineId: 'diamond-doubler',
      stops: [1, 0, 0],
      grid: [['DW', 'B1', 'BL'], ['B2', 'B1', 'BL'], ['B3', 'B1', 'BL']],
      wins: []
    })
    const calls = nearMisses(DIAMOND_DOUBLER, out)
    const tease = calls.find(c => c.kind === 'engineered-tease')!
    expect(tease.reels).toEqual([0])
    expect(tease.message).toMatch(/Diamond Wild/)
    expect(tease.message).toMatch(/72/) // quotes the virtual reel size
  })

  it('flags two of three jackpot symbols ON the payline', () => {
    const out = outcomeFor({
      machineId: 'diamond-doubler',
      grid: [['BL', 'DW', 'B1'], ['BL', 'DW', 'B1'], ['BL', 'B2', 'B1']],
      wins: [] // (a real 2-wild line would pay; hand-built to isolate the rule)
    })
    const calls = nearMisses(DIAMOND_DOUBLER, out)
    expect(calls.some(c => c.kind === 'two-of-three')).toBe(true)
  })
})

describe('bally near-misses (there are none — uniform truth)', () => {
  it('emits uniform-truth when a jackpot symbol is visible, never a tease', () => {
    const out = outcomeFor({
      machineId: 'series-e-3line',
      family: 'bally-em',
      grid: [['OR', 'S7', 'PL'], ['OR', 'BE', 'PL'], ['OR', 'BE', 'PL'], ['OR', 'BE', 'PL'], ['OR', 'BE', 'PL']],
      wins: []
    })
    const calls = nearMisses(SERIES_E_3LINE, out)
    expect(calls.some(c => c.kind === 'uniform-truth')).toBe(true)
    expect(calls.some(c => c.kind === 'engineered-tease')).toBe(false)
  })

  it('uniform-truth stays contextual: fires on under 25% of seeded series-e-3line spins', () => {
    const state = initMachineState(SERIES_E_3LINE)
    const rand = mulberry32(424242)
    let fired = 0
    const N = 20_000
    for (let i = 0; i < N; i++) {
      const out = spin(SERIES_E_3LINE, state, 1, rand)
      if (nearMisses(SERIES_E_3LINE, out).some(c => c.kind === 'uniform-truth')) fired++
    }
    expect(fired / N).toBeLessThan(0.25)
    expect(fired).toBeGreaterThan(0)
  })
})

describe('video near-misses', () => {
  it('one scatter short of the trigger', () => {
    const grid = CANAL_ROYALE.strips.map(s => [s[0]!, s[1]!, s[2]!])
    grid[0] = ['SC', 'JJ', 'TT']
    grid[1] = ['SC', 'JJ', 'TT']
    grid[2] = ['JJ', 'TT', 'AA']
    grid[3] = ['JJ', 'TT', 'AA']
    grid[4] = ['JJ', 'TT', 'AA']
    const out = outcomeFor({ machineId: 'canal-royale', family: 'video', grid, wins: [] })
    const calls = nearMisses(CANAL_ROYALE, out)
    expect(calls.some(c => c.kind === 'one-scatter-short')).toBe(true)
  })

  it('one orb short of the hold-and-spin trigger', () => {
    const grid = [
      ['OR', 'OR', 'AA'], ['OR', 'OR', 'AA'], ['OR', 'AA', 'KK'],
      ['AA', 'KK', 'QQ'], ['AA', 'KK', 'QQ']
    ]
    const out = outcomeFor({ machineId: 'thunder-vault', family: 'video', grid, wins: [] })
    const calls = nearMisses(THUNDER_VAULT, out)
    expect(calls.some(c => c.kind === 'one-orb-short')).toBe(true)
  })
})

describe('pachislo near-misses (stocked flags only — nothing else is honest)', () => {
  it('reports a stocked flag with the slips used', () => {
    const out = outcomeFor({
      machineId: 'stock-rush', family: 'pachislo',
      featureEvents: [{ type: 'flag-drawn', flag: 'big' }, { type: 'flag-stocked', flag: 'big', queueDepth: 1 }],
      trace: {
        draws: [],
        presses: [
          { reel: 0, press: 3, stop: 5, slipUsed: 2, target: 'big' },
          { reel: 1, press: 8, stop: 8, slipUsed: 0, target: 'big' },
          { reel: 2, press: 12, stop: 16, slipUsed: 4, target: 'big' }
        ]
      }
    })
    const calls = nearMisses(STOCK_RUSH, out)
    const stocked = calls.find(c => c.kind === 'flag-stocked')!
    expect(stocked.message).toMatch(/big/i)
    expect(stocked.message).toMatch(/2\/0\/4/)
  })
})

describe('invariance: purely presentational', () => {
  it('never mutates inputs (deep-frozen) and never throws across a seeded floor sweep', () => {
    for (const def of FLOOR) {
      const state = initMachineState(def)
      const rand = mulberry32(20260612)
      const coins = def.family === 'bally-em' && def.payMode === 'lines' ? 1 : def.maxCoins
      for (let i = 0; i < 2_000; i++) {
        const out = spin(def, state, coins, rand)
        deepFreeze(out)
        expect(() => nearMisses(def, out)).not.toThrow()
      }
    }
  })

  it('financial results are identical with and without near-miss analysis', () => {
    const run = (analyze: boolean) => {
      const totals: Record<string, number> = {}
      for (const def of FLOOR) {
        const state = initMachineState(def)
        const rand = mulberry32(777_000 + def.id.length)
        const coins = def.family === 'bally-em' && def.payMode === 'lines' ? 1 : def.maxCoins
        let out = 0
        for (let i = 0; i < 3_000; i++) {
          const o = spin(def, state, coins, rand)
          if (analyze) nearMisses(def, o)
          out += o.totalPayout
        }
        totals[def.id] = out
      }
      return totals
    }
    expect(run(true)).toEqual(run(false))
  })
})

function deepFreeze<T>(obj: T): T {
  if (obj !== null && typeof obj === 'object') {
    Object.freeze(obj)
    for (const v of Object.values(obj as object)) deepFreeze(v)
  }
  return obj
}
