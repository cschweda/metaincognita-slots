import { describe, expect, it } from 'vitest'
import { initMachineState, mulberry32, nextSpinCost, spin } from '../app/engine'
import { drawWedgeIndex, spinWheel, totalWedgeWeight } from '../app/engine/wheelGame'
import { WONDER_WHEEL } from '../app/machines/wonder-wheel'

const def = WONDER_WHEEL

function armedState(seedStart = 1): { state: ReturnType<typeof initMachineState>, spins: number } {
  // spin at max coins until the wheel arms (seeded, deterministic)
  const state = initMachineState(def)
  const rand = mulberry32(seedStart)
  let spins = 0
  while (state.wheel!.pending === false) {
    spinWheel(def, state, def.maxCoins, rand)
    spins++
    if (spins > 5000) throw new Error('never armed — def or seed broken')
  }
  return { state, spins }
}

describe('spinWheel — base game', () => {
  it('is a Telnaes stepper spin routed through the barrel spin()', () => {
    const state = initMachineState(def)
    const out = spin(def, state, 3, mulberry32(7))
    expect(out.family).toBe('wheel')
    expect(out.gameKind).toBe('base')
    expect(out.coinsIn).toBe(3)
    expect(out.stops.length).toBe(3)
    expect(out.trace.virtualStops!.length).toBe(3)
  })

  it('arms the topper on reel-3 WHEEL at max coins — and the next spin is free', () => {
    const { state } = armedState()
    expect(state.wheel!.pending).toBe(true)
    expect(nextSpinCost(def, state, def.maxCoins)).toBe(0)
  })

  it('under max coins the WHEEL is wasted: an event, no arming, no pay', () => {
    const state = initMachineState(def)
    const rand = mulberry32(1)
    let wasted = 0
    for (let i = 0; i < 3000 && wasted === 0; i++) {
      const out = spinWheel(def, state, 1, rand)
      if (out.featureEvents.some(e => e.type === 'wheel-wasted')) {
        wasted++
        expect(state.wheel!.pending).toBe(false)
        expect(out.wins.every(w => !w.entryId.startsWith('wedge-'))).toBe(true)
      }
      expect(state.wheel!.pending).toBe(false)
    }
    expect(wasted).toBe(1)
  })
})

describe('spinWheel — the topper resolve', () => {
  it('pays a FIXED-credit wedge on a free spin and clears pending', () => {
    const { state } = armedState()
    const out = spinWheel(def, state, def.maxCoins, mulberry32(99))
    expect(out.gameKind).toBe('wheel')
    expect(out.coinsIn).toBe(0)
    expect(state.wheel!.pending).toBe(false)
    const landed = out.featureEvents.find(e => e.type === 'wheel-landed')
    expect(landed).toBeDefined()
    const wedge = def.wedges[(landed as { wedgeIndex: number }).wedgeIndex]!
    expect(out.totalPayout).toBe(wedge.credits)
    expect(out.wins[0]!.entryId).toBe(`wedge-${wedge.credits}`)
    expect(out.trace.draws[0]!.label).toBe('wheel wedge')
  })

  it('drawWedgeIndex is the exact weighted lottery (frequencies track weights)', () => {
    const rand = mulberry32(2026)
    const counts = new Array<number>(def.wedges.length).fill(0)
    const N = 200_000
    for (let i = 0; i < N; i++) counts[drawWedgeIndex(def, rand).index]++
    const W = totalWedgeWeight(def)
    def.wedges.forEach((w, i) => {
      const expected = (w.weight / W) * N
      // 5σ binomial band — loose enough to be stable, tight enough to catch bias
      const sigma = Math.sqrt(N * (w.weight / W) * (1 - w.weight / W))
      expect(Math.abs(counts[i]! - expected), `wedge ${w.credits}`).toBeLessThanOrEqual(5 * sigma + 1)
    })
  })
})
