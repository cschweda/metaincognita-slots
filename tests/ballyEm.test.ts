import { describe, it, expect } from 'vitest'
import { spinBallyEm } from '../app/engine/ballyEm'
import { initMachineState, mulberry32 } from '../app/engine'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { SERIES_E_MULTIPLIER } from '../app/machines/series-e-multiplier'
import type { MachineSessionState } from '../app/engine/types'

/** RNG stub: returns values that make floor(v * stops) land on the wanted stops. */
function riggedStops(stops: number[], stopCount: number) {
  let i = 0
  return () => (stops[i++]! + 0.5) / stopCount
}

/** stop index such that the CENTER row (stop+1) shows the strip's first S7 */
function stopForCenterSymbol(strip: string[], symbol: string): number {
  const idx = strip.indexOf(symbol)
  return (idx - 1 + strip.length) % strip.length
}

function freshState(def: typeof SERIES_E_3LINE | typeof SERIES_E_MULTIPLIER): MachineSessionState {
  return initMachineState(def)
}

describe('spinBallyEm — grid and lines', () => {
  it('grid rows are [top, center, bottom] = strip[stop], strip[stop+1], strip[stop+2]', () => {
    const def = SERIES_E_3LINE
    const rng = riggedStops([0, 0, 0, 0, 0], 22)
    const out = spinBallyEm(def, freshState(def), 1, rng)
    out.grid.forEach((col, r) => {
      const strip = def.strips[r]!
      expect(col).toEqual([strip[0], strip[1], strip[2]])
    })
  })

  it('1 coin pays center line only; 3 coins pay center, top, bottom', () => {
    const def = SERIES_E_3LINE
    // place a cherry on reel 1 TOP row: stop = index of CH
    const chTop = def.strips[0]!.indexOf('CH')
    // reels 2-5 stops chosen at blanks so no other win interferes on any row:
    // any stop works because awards need runs starting at reel 1; reel-1 rows:
    // top=CH (run1 on top line), center/bottom = whatever follows.
    const stops = [chTop, 0, 0, 0, 0]
    const oneCoin = spinBallyEm(def, freshState(def), 1, riggedStops(stops, 22))
    // top line not active at 1 coin
    expect(oneCoin.wins.every(w => w.line !== 'top')).toBe(true)

    const threeCoin = spinBallyEm(def, freshState(def), 3, riggedStops(stops, 22))
    const topWin = threeCoin.wins.find(w => w.line === 'top')
    expect(topWin?.entryId).toBe('chx1')
    expect(topWin?.payCredits).toBe(2)
  })
})

describe('spinBallyEm — progressive paths (rigged)', () => {
  it('E-1202: 5xS7 on center pays the LIVE meter and resets it', () => {
    const def = SERIES_E_3LINE
    const stops = def.strips.map(strip => stopForCenterSymbol(strip, 'S7'))
    const state = freshState(def)
    // make the lower jackpot live and inflate it to prove it pays current value
    const prog = state.progressive as Extract<NonNullable<MachineSessionState['progressive']>, { kind: 'dual' }>
    prog.live = 'lower'
    prog.lower = 1234
    const out = spinBallyEm(def, state, 1, riggedStops(stops, 22))
    const jackpotWin = out.wins.find(w => w.entryId === 's7x5')!
    expect(jackpotWin.progressive).toBe(true)
    expect(jackpotWin.payCredits).toBe(1234)
    expect(out.progressiveEvents).toEqual([{ type: 'hit', meter: 'lower', amountCredits: 1234 }])
    expect(prog.lower).toBe(def.progressive!.kind === 'dual' ? def.progressive!.lower.reset : 0)
  })

  it('E-1203: 4xS7 pays meter at 3 coins, 1000 x coins below max', () => {
    const def = SERIES_E_MULTIPLIER
    const stops = def.strips.map(strip => stopForCenterSymbol(strip, 'S7'))
    const at1 = spinBallyEm(def, freshState(def), 1, riggedStops(stops, 25))
    expect(at1.totalPayout).toBe(1000)
    expect(at1.progressiveEvents).toEqual([])

    const state3 = freshState(def)
    const at3 = spinBallyEm(def, state3, 3, riggedStops(stops, 25))
    expect(at3.totalPayout).toBe(6000)
    expect(at3.progressiveEvents).toEqual([{ type: 'hit', meter: 'single', amountCredits: 6000 }])
    expect((state3.progressive as { value: number }).value).toBe(6000) // reset
  })

  it('multiplier machine pays x coins on normal wins', () => {
    const def = SERIES_E_MULTIPLIER
    // center row all bells: find stop where center = BE on each reel
    const stops = def.strips.map(strip => stopForCenterSymbol(strip, 'BE'))
    // rig only reels 1-3 to bells; reel 4 to a blank-centered stop so run is exactly 3
    const blankStop = stopForCenterSymbol(def.strips[3]!, 'BL')
    const out = spinBallyEm(def, freshState(def), 2, riggedStops([stops[0]!, stops[1]!, stops[2]!, blankStop], 25))
    const win = out.wins.find(w => w.entryId === 'bex3')!
    expect(win.payCredits).toBe(40) // 20 x 2 coins
  })
})

describe('physical-stop distribution (uniform, pre-Telnaes)', () => {
  it('chi-squared over 200k spins stays under the df=21 critical value', () => {
    // E-1202 reel 1 has 22 uniform stops -> df = 21; chi2_0.999(21) = 46.80.
    // Fixed seed makes this deterministic; bound 50 leaves slack while a
    // weighted reel (any stop +/-30% off uniform) lands in the thousands.
    const def = SERIES_E_3LINE
    const state = initMachineState(def)
    const rand = mulberry32(777)
    const counts = new Array<number>(def.stops).fill(0)
    const spins = 200_000
    for (let i = 0; i < spins; i++) {
      const out = spinBallyEm(def, state, 1, rand)
      counts[out.stops[0]!]!++
    }
    const expected = spins / def.stops
    const chi2 = counts.reduce((s, c) => s + (c - expected) ** 2 / expected, 0)
    expect(chi2).toBeLessThan(50)
  })

  it('throws when coins are out of range', () => {
    const state = initMachineState(SERIES_E_3LINE)
    expect(() => spinBallyEm(SERIES_E_3LINE, state, 0, mulberry32(1))).toThrow(/out of range/)
    expect(() => spinBallyEm(SERIES_E_3LINE, state, 4, mulberry32(1))).toThrow(/out of range/)
  })
})
