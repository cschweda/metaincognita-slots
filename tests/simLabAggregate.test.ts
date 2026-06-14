// tests/simLabAggregate.test.ts
import { describe, expect, it } from 'vitest'
import { aggregateSessions, createSimLabRun } from '../app/engine/sessions'
import type { SessionRecord, SimLabContext, SimLabOptions } from '../app/engine/sessions'
import { FLOOR } from '../app/machines'

const byId = (id: string) => FLOOR.find(m => m.id === id)!

function labOpts(over: Partial<SimLabOptions> = {}): SimLabOptions {
  return {
    machineId: 'diamond-doubler', startCredits: 200, bet: 1, spinCap: 200,
    progressiveMode: 'static', sessions: 300, seed: 42, ...over
  }
}

function ctx(over: Partial<SimLabContext> = {}): SimLabContext {
  return {
    machineId: 'test', startCredits: 100, bet: 1, spinCap: 10,
    houseEdge: 0.1, empiricalRtp: 0.9, survivalBins: 10, histogramBins: 4, ...over
  }
}

// 4 records: 2 bust (end 0), 1 even (end 100), 1 ahead (end 300)
const recs: SessionRecord[] = [
  { endBalance: 0, maxDrawdown: 100, spinsPlayed: 3, busted: true },
  { endBalance: 0, maxDrawdown: 100, spinsPlayed: 5, busted: true },
  { endBalance: 100, maxDrawdown: 20, spinsPlayed: 10, busted: false },
  { endBalance: 300, maxDrawdown: 10, spinsPlayed: 10, busted: false }
]

describe('aggregateSessions', () => {
  it('computes headline stats', () => {
    const r = aggregateSessions(recs, [], ctx())
    expect(r.sessions).toBe(4)
    expect(r.riskOfRuin).toBe(0.5)
    expect(r.pctAhead).toBe(0.25) // only the 300 ends above 100
    expect(r.meanEnd).toBe(100) // (0+0+100+300)/4
    expect(r.medianEnd).toBe(50) // avg of middle two (0,100)
    expect(r.avgSpins).toBeCloseTo((3 + 5 + 10 + 10) / 4)
    expect(r.avgMaxDrawdown).toBeCloseTo((100 + 100 + 20 + 10) / 4)
  })

  it('survival curve starts at 1 and decays to the survival rate', () => {
    const r = aggregateSessions(recs, [], ctx())
    expect(r.survival[0]!.fraction).toBe(1)
    expect(r.survival[r.survival.length - 1]!.spins).toBe(10)
    expect(r.survival[r.survival.length - 1]!.fraction).toBe(0.5) // 2 of 4 reach the cap
  })

  it('end histogram has the right total count and a separate bust count', () => {
    const r = aggregateSessions(recs, [], ctx())
    expect(r.endHistogram.counts.reduce((a, b) => a + b, 0)).toBe(4)
    expect(r.endHistogram.bustCount).toBe(2)
    expect(r.endHistogram.binEdges.length).toBe(r.endHistogram.counts.length + 1)
  })

  it('passes through and caps sample trajectories', () => {
    const samples = [
      { busted: true, points: [100, 0] },
      { busted: false, points: [100, 120] }
    ]
    const r = aggregateSessions(recs, samples, ctx())
    expect(r.sampleTrajectories).toHaveLength(2)
  })

  it('handles an all-survive set without NaNs', () => {
    const surv: SessionRecord[] = [{ endBalance: 100, maxDrawdown: 0, spinsPlayed: 10, busted: false }]
    const r = aggregateSessions(surv, [], ctx())
    expect(r.riskOfRuin).toBe(0)
    expect(Number.isNaN(r.medianEnd)).toBe(false)
    expect(r.drawdownHistogram.counts.reduce((a, b) => a + b, 0)).toBe(1)
  })
})

describe('createSimLabRun', () => {
  it('runs to completion in batches and is batch-size independent', () => {
    const def = byId('diamond-doubler')
    const big = createSimLabRun(def, labOpts())
    expect(big.runBatch(10_000).done).toBe(true)
    const r1 = big.result()

    const small = createSimLabRun(def, labOpts())
    let done = false
    while (!done) done = small.runBatch(37).done
    const r2 = small.result()

    expect(r2).toEqual(r1) // identical regardless of batch size
    expect(r1.sessions).toBe(300)
    expect(r1.houseEdge).toBeGreaterThan(0)
    expect(r1.empiricalRtp).toBeGreaterThan(0)
  })

  it('keeps a mix of busted and survived sample trajectories', () => {
    // small bankroll + moderate cap → both fates occur
    const def = byId('diamond-doubler')
    const run = createSimLabRun(def, labOpts({ startCredits: 40, spinCap: 300, sessions: 400 }))
    run.runBatch(10_000)
    const r = run.result()
    expect(r.sampleTrajectories.length).toBeGreaterThan(0)
    expect(r.sampleTrajectories.some(t => t.busted)).toBe(true)
    expect(r.sampleTrajectories.some(t => !t.busted)).toBe(true)
  })

  it('property: more bankroll lowers risk of ruin', () => {
    const def = byId('diamond-doubler')
    const low = createSimLabRun(def, labOpts({ startCredits: 30, spinCap: 500, sessions: 500 }))
    const high = createSimLabRun(def, labOpts({ startCredits: 300, spinCap: 500, sessions: 500 }))
    low.runBatch(10_000)
    high.runBatch(10_000)
    expect(high.result().riskOfRuin).toBeLessThan(low.result().riskOfRuin)
  })
})
