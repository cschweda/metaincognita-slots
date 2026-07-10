import { describe, expect, it } from 'vitest'
import { MYTHS_SPINS, runMythsExperiment } from '../../app/utils/mythsExperiment'

describe('runMythsExperiment', () => {
  it('is deterministic and refutes streak memory: every bucket sits at the overall hit rate', () => {
    const r = runMythsExperiment()
    expect(r.spins).toBe(MYTHS_SPINS)
    expect(r.buckets.length).toBe(8)
    for (const b of r.buckets) {
      expect(b.samples, `bucket "${b.label}" must have real sample volume`).toBeGreaterThan(1000)
      expect(Math.abs(b.hitRate - r.overallHitRate), `bucket "${b.label}" must match the overall rate`).toBeLessThan(0.02)
    }
    expect(r.longestDrought).toBeGreaterThan(20)
    expect(r.jackpots).toBeGreaterThan(5)
    expect(r.jackpotGaps).not.toBeNull()
    expect(r.jackpotGaps!.min).toBeLessThan(r.jackpotGaps!.max)
    // engine-derived, not hardcoded: P(3×F7) = 27/72^3 = 1/13,824
    expect(r.expectedGap).toBeCloseTo(13824, 0)
    // Frozen (mulberry32(20260709)): the page publishes these; they must not drift.
    expect(r.overallHitRate).toBeCloseTo(0.157048, 6)
    expect(r.longestDrought).toBe(60)
    expect(r.jackpots).toBe(20)
    expect(r.jackpotGaps!.min).toBe(549)
    expect(r.jackpotGaps!.max).toBe(42247)
    const again = runMythsExperiment()
    expect(again).toEqual(r) // pure function of the fixed seed
  })
})
