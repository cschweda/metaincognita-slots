import { describe, it, expect } from 'vitest'
import { spinStepper } from '../app/engine/stepper'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'
import { mulberry32 } from '../app/engine/rng'
import type { MachineSessionState } from '../app/engine/types'

/** rig virtual indices: floor(v * 72) lands on the wanted entries */
function riggedVirtual(indices: number[]) {
  let i = 0
  return () => (indices[i++]! + 0.5) / 72
}

function noProg(): MachineSessionState {
  return { progressive: null }
}

describe('spinStepper — virtual to physical mapping', () => {
  it('payline symbol = strip[vmap[virtualIndex]], grid = [above, payline, below]', () => {
    const def = DIAMOND_DOUBLER
    const out = spinStepper(def, noProg(), 1, riggedVirtual([0, 0, 0]))
    out.stops.forEach((stop, r) => {
      expect(stop).toBe(def.virtualMaps[r]![0])
      const strip = def.physicalStrips[r]!
      const len = strip.length
      expect(out.grid[r]).toEqual([
        strip[(stop - 1 + len) % len], strip[stop], strip[(stop + 1) % len]
      ])
    })
  })

  it('records virtual-stop trace with Telnaes weights', () => {
    const def = DIAMOND_DOUBLER
    // virtual index 0 on reel 1 -> physical 0 = DW, weight 3 (3 entries land on DW)
    const out = spinStepper(def, noProg(), 1, riggedVirtual([0, 0, 0]))
    const t = out.trace.virtualStops![0]!
    expect(t.virtualIndex).toBe(0)
    expect(t.virtualSize).toBe(72)
    expect(t.symbol).toBe('DW')
    expect(t.weight).toBe(3)
  })

  it('pays are linear in coins', () => {
    const def = DIAMOND_DOUBLER
    // all three reels: first B1 entry in each vmap.
    // Find a virtual index per reel whose strip symbol is B1.
    const idx = def.virtualMaps.map((vmap, r) =>
      vmap.findIndex(p => def.physicalStrips[r]![p] === 'B1'))
    const at1 = spinStepper(def, noProg(), 1, riggedVirtual(idx))
    const at3 = spinStepper(def, noProg(), 3, riggedVirtual(idx))
    expect(at1.totalPayout).toBe(10)
    expect(at3.totalPayout).toBe(30)
  })
})

describe('spinStepper — sevens-ablaze progressive', () => {
  function f7Indices() {
    return SEVENS_ABLAZE.virtualMaps.map((vmap, r) =>
      vmap.findIndex(p => SEVENS_ABLAZE.physicalStrips[r]![p] === 'F7'))
  }

  it('3xF7 at 1 coin pays fixed 1000, no progressive event', () => {
    const out = spinStepper(SEVENS_ABLAZE, {
      progressive: { kind: 'percent', value: 2500 }
    }, 1, riggedVirtual(f7Indices()))
    expect(out.totalPayout).toBe(1000)
    expect(out.progressiveEvents).toEqual([])
  })

  it('3xF7 at max coins pays the meter (floored) and resets it', () => {
    const state: MachineSessionState = { progressive: { kind: 'percent', value: 2500.75 } }
    const out = spinStepper(SEVENS_ABLAZE, state, 2, riggedVirtual(f7Indices()))
    expect(out.totalPayout).toBe(2500)
    expect(out.progressiveEvents).toEqual([{ type: 'hit', meter: 'percent', amountCredits: 2500 }])
    expect((state.progressive as { value: number }).value).toBe(2000)
  })
})

describe('spinStepper — distribution sanity (chi-squared on virtual draws)', () => {
  it('200k draws on reel 1 match uniform over 72 virtual entries (df=71, p=0.001 crit 112.32)', () => {
    const def = DIAMOND_DOUBLER
    const rand = mulberry32(424242)
    const bins = new Array(72).fill(0)
    const n = 200_000
    for (let i = 0; i < n; i++) {
      const out = spinStepper(def, noProg(), 1, rand)
      bins[out.trace.virtualStops![0]!.virtualIndex]++
    }
    const expected = n / 72
    const chi2 = bins.reduce((s, o) => s + (o - expected) ** 2 / expected, 0)
    expect(chi2).toBeLessThan(112.32)
  })
})
