import { describe, it, expect } from 'vitest'
import { validateMachineDef } from '../app/engine/validate'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import { FLOOR } from '../app/machines'

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
      'video', 'video', 'video', 'video', 'stepper', 'stepper', 'bally-em', 'bally-em', 'pachislo', 'blackjack-reel'
    ])
    // Flameout 21 (blackjack-reel crash) is on the floor in the last slot.
    expect(FLOOR.at(-1)!.id).toBe('flameout-21')
    expect(FLOOR.at(-1)!.name).toBe('Flameout 21')
  })
})
