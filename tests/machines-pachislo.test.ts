import { describe, it, expect } from 'vitest'
import { validateMachineDef } from '../app/engine/validate'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import { FLOOR, PARKED, ALL_MACHINES } from '../app/machines'

describe('stock-rush — machine integrity', () => {
  it('is a valid machine', () => {
    expect(() => validateMachineDef(STOCK_RUSH)).not.toThrow()
  })
  it('strip compositions match the searched layout', () => {
    const counts = STOCK_RUSH.strips.map((strip) => {
      const c: Record<string, number> = {}
      strip.forEach((s) => {
        c[s] = (c[s] ?? 0) + 1
      })
      return c
    })
    expect(counts[0]).toEqual({ CH: 3, BE: 5, RP: 5, WM: 3, R7: 2, BL: 3 })
    expect(counts[1]).toEqual({ BE: 5, RP: 5, WM: 3, R7: 3, BB: 2, BL: 3 })
    expect(counts[2]).toEqual({ BE: 5, RP: 5, WM: 3, R7: 3, BB: 4, BL: 1 })
  })
  it('the floor is complete: 10 machines, all valid, ids unique', () => {
    expect(FLOOR).toHaveLength(10)
    expect(new Set(FLOOR.map(m => m.id)).size).toBe(10)
    for (const def of FLOOR) expect(() => validateMachineDef(def)).not.toThrow()
    expect(FLOOR.map(m => m.family)).toEqual([
      'video', 'video', 'video', 'video', 'stepper', 'stepper', 'bally-em', 'bally-em', 'pachislo', 'lock-reel'
    ])
    // Stop & Lock 777 (lock-reel cash-collect) is the Featured machine on the floor.
    expect(FLOOR.some(m => m.id === 'stop-and-lock-777')).toBe(true)
    // Flameout 21 (blackjack-reel crash) is PARKED — off the floor, kept in the code.
    expect(FLOOR.some(m => m.id === 'flameout-21')).toBe(false)
  })
  it('the parked roster is resolvable + valid, but off the floor', () => {
    // Flameout 21 (blackjack-reel crash) is PARKED — kept in the code and resolvable,
    // but not shown on the floor screen / Sim Lab listing / verify.
    expect(PARKED.map(m => m.id)).toEqual(['flameout-21'])
    for (const def of PARKED) expect(() => validateMachineDef(def)).not.toThrow()
    expect(FLOOR.some(m => m.id === 'flameout-21')).toBe(false)
    // the store resolves everything (floor + parked) so the parked game still loads
    expect(ALL_MACHINES).toHaveLength(11)
    expect(ALL_MACHINES.some(m => m.id === 'flameout-21')).toBe(true)
    expect(ALL_MACHINES.some(m => m.id === 'stop-and-lock-777')).toBe(true)
  })
})
