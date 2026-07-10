import { describe, expect, it } from 'vitest'
import { LDW_PAID_SPINS, runLdwExperiment } from '../../app/utils/ldwExperiment'

describe('runLdwExperiment', () => {
  it('is seeded and frozen — the published 63.34% LDW share must not drift', () => {
    const r = runLdwExperiment()
    // Deterministic (mulberry32(20260703)): same numbers every run, every visit.
    expect(r.ldwShareOfWins).toBeCloseTo(0.6334, 3)
    expect(r.wins).toBe(r.trueWins + r.ldw)
    expect(r.hitPct).toBeCloseTo(r.wins / LDW_PAID_SPINS, 10)
    expect(r.nearMissLosses).toBeGreaterThan(0)
    const again = runLdwExperiment()
    expect(again).toEqual(r) // pure function of the fixed seed
  })
})
