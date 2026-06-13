import { describe, it, expect } from 'vitest'
import { controlStops, payingHits } from '../app/engine/pachislo'
import { STOCK_RUSH } from '../app/machines/stock-rush'
import type { ControlTarget } from '../app/engine/pachislo'

const N = 21

describe('control avoidance — the no-win-without-a-flag guarantee', () => {
  for (const tokens of [1, 2, 3]) {
    it(`finds a win-free stop for every press triple at ${tokens} token(s)`, () => {
      for (let q1 = 0; q1 < N; q1++) {
        for (let q2 = 0; q2 < N; q2++) {
          for (let q3 = 0; q3 < N; q3++) {
            const r = controlStops(STOCK_RUSH, [q1, q2, q3], tokens, null)
            expect(r.realized).toBe(false)
            expect(payingHits(STOCK_RUSH, r.stops, tokens)).toHaveLength(0)
            for (let i = 0; i < 3; i++) {
              expect(r.slips[i]).toBeGreaterThanOrEqual(0)
              expect(r.slips[i]).toBeLessThanOrEqual(STOCK_RUSH.slip)
              expect(r.stops[i]).toBe((([q1, q2, q3][i]! + r.slips[i]!) % N))
            }
          }
        }
      }
    })
  }
})

describe('FROZEN: realization service over the full 21^3 press grid at 3 tokens', () => {
  const service = (target: ControlTarget) => {
    let ok = 0
    for (let q1 = 0; q1 < N; q1++) {
      for (let q2 = 0; q2 < N; q2++) {
        for (let q3 = 0; q3 < N; q3++) {
          const r = controlStops(STOCK_RUSH, [q1, q2, q3], 3, target)
          if (r.realized) ok++
        }
      }
    }
    return ok
  }
  // These exact counts came from the planning-time exhaustive verification.
  // A change in DELTAS ordering, hit detection, or strips moves them.
  it('bell lands from 6082/9261 press triples (65.67%)', () => {
    expect(service({ kind: 'combo', flag: 'bell' })).toBe(6082)
  })
  it('watermelon: 1780/9261 (19.22%)', () => {
    expect(service({ kind: 'combo', flag: 'watermelon' })).toBe(1780)
  })
  it('replay: 3060/9261 (33.04%)', () => {
    expect(service({ kind: 'combo', flag: 'replay' })).toBe(3060)
  })
  it('REG (7-7-bar): 1710/9261 (18.46%)', () => {
    expect(service({ kind: 'combo', flag: 'reg' })).toBe(1710)
  })
  it('BIG (7-7-7): 845/9261 (9.12%)', () => {
    expect(service({ kind: 'combo', flag: 'big' })).toBe(845)
  })
  it('cherry on each row: 6615/9261 (5/7)', () => {
    expect(service({ kind: 'cherry', row: 0 })).toBe(6615)
    expect(service({ kind: 'cherry', row: 1 })).toBe(6615)
    expect(service({ kind: 'cherry', row: 2 })).toBe(6615)
  })
})
