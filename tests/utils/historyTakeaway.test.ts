import { describe, expect, it } from 'vitest'
import type { SpinRecord } from '../../app/stores/slots'
import { edgeKey, takeawaySums } from '../../app/utils/historyTakeaway'

const row = (over: Partial<SpinRecord>): SpinRecord => ({
  id: 1, machineId: 'sevens-ablaze', gameKind: 'base', coins: 2,
  coinsInCents: 200, payoutCents: 0, entryIds: [], t: 0, ...over
})

describe('takeawaySums', () => {
  it('accumulates wagered, expected net (at the exact edge), and actual net over covered rows', () => {
    const edges = new Map([[edgeKey('sevens-ablaze', 2), 0.055]])
    const rows = [
      row({ id: 1, payoutCents: 0 }), //   in 200, out 0
      row({ id: 2, payoutCents: 400 }), // in 200, out 400
      row({ id: 3, payoutCents: 100 }) //  in 200, out 100 (an LDW)
    ]
    const s = takeawaySums(rows, edges)
    expect(s.coveredRows).toBe(3)
    expect(s.excludedRows).toBe(0)
    expect(s.wageredCents).toBe(600)
    expect(s.expectedNetCents).toBeCloseTo(-600 * 0.055, 6)
    expect(s.actualNetCents).toBe(500 - 600)
  })

  it('excludes rows whose machine edge is unknown, counting them honestly', () => {
    const edges = new Map([[edgeKey('sevens-ablaze', 2), 0.055]])
    const rows = [row({ id: 1 }), row({ id: 2, machineId: 'retired-machine' })]
    const s = takeawaySums(rows, edges)
    expect(s.coveredRows).toBe(1)
    expect(s.excludedRows).toBe(1)
    expect(s.wageredCents).toBe(200) // covered rows only — apples to apples
  })

  it('is empty-safe', () => {
    const s = takeawaySums([], new Map())
    expect(s).toEqual({ wageredCents: 0, expectedNetCents: 0, actualNetCents: 0, coveredRows: 0, excludedRows: 0 })
  })
})
