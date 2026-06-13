import { describe, it, expect } from 'vitest'
import {
  LINES25, cellAt, evalLine, evalWays, orbCells, scatterVisibleCount
} from '../app/engine/videoAwards'
import type { VideoMachineDef } from '../app/engine/types'

// Tiny 6-cell strips keep expectations hand-checkable; evaluators are
// length-agnostic (the 24-cell rule is a validator concern, Task 9).
const WAYS_DEF = {
  family: 'video',
  strips: [
    ['DR', 'KK', 'KK', 'QQ', 'DR', 'QQ'],
    ['WD', 'QQ', 'DR', 'KK', 'QQ', 'KK'],
    ['DR', 'QQ', 'KK', 'WD', 'QQ', 'KK'],
    ['QQ', 'KK', 'DR', 'QQ', 'KK', 'QQ'],
    ['KK', 'QQ', 'QQ', 'DR', 'KK', 'QQ']
  ],
  betMode: { kind: 'ways' },
  wildSymbol: 'WD',
  scatter: null,
  holdAndSpin: null,
  paytable: [
    { id: 'dr3', symbol: 'DR', length: 3, pay: 20 },
    { id: 'dr4', symbol: 'DR', length: 4, pay: 60 },
    { id: 'dr5', symbol: 'DR', length: 5, pay: 250 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 5 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 10 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 25 }
  ]
} as unknown as VideoMachineDef

describe('LINES25', () => {
  it('is 25 distinct 5-reel row patterns, center line first', () => {
    expect(LINES25).toHaveLength(25)
    expect(LINES25[0]).toEqual([1, 1, 1, 1, 1])
    const seen = new Set(LINES25.map(p => p.join('')))
    expect(seen.size).toBe(25)
    for (const p of LINES25) {
      expect(p).toHaveLength(5)
      for (const row of p) expect([0, 1, 2]).toContain(row)
    }
  })
})

describe('cellAt', () => {
  it('wraps the circular strip', () => {
    expect(cellAt(['A', 'B', 'C'], 2, 0)).toBe('C')
    expect(cellAt(['A', 'B', 'C'], 2, 1)).toBe('A')
    expect(cellAt(['A', 'B', 'C'], 2, 2)).toBe('B')
  })
})

describe('evalLine', () => {
  const def = { paytable: WAYS_DEF.paytable, wildSymbol: 'WD' as string | null }
  it('pays the exact run length anchored on reel 1', () => {
    expect(evalLine(['DR', 'DR', 'DR', 'KK', 'QQ'], def)!.entry.id).toBe('dr3')
    expect(evalLine(['DR', 'DR', 'DR', 'DR', 'KK'], def)!.entry.id).toBe('dr4')
    expect(evalLine(['DR', 'DR', 'DR', 'DR', 'DR'], def)!.entry.id).toBe('dr5')
  })
  it('substitutes wilds after the anchor and counts them', () => {
    const r = evalLine(['DR', 'WD', 'DR', 'WD', 'KK'], def)!
    expect(r.entry.id).toBe('dr4')
    expect(r.wildCount).toBe(2)
  })
  it('returns null for runs under 3, wild anchors, and unknown anchors', () => {
    expect(evalLine(['DR', 'DR', 'KK', 'DR', 'DR'], def)).toBeNull()
    expect(evalLine(['WD', 'DR', 'DR', 'DR', 'DR'], def)).toBeNull()
    expect(evalLine(['SC', 'SC', 'SC', 'SC', 'SC'], def)).toBeNull()
  })
})

describe('evalWays', () => {
  it('multiplies per-reel symbol-or-wild counts over the run', () => {
    // windows at stops 0: r1 [DR,KK,KK], r2 [WD,QQ,DR], r3 [DR,QQ,KK],
    // r4 [QQ,KK,DR], r5 [KK,QQ,QQ]
    const wins = evalWays(WAYS_DEF, [0, 0, 0, 0, 0])
    const dr = wins.find(w => w.entry.symbol === 'DR')!
    // DR-or-WD counts: 1,2,1,1,0 -> run stops at 4, ways 1*2*1*1 = 2
    expect(dr.entry.id).toBe('dr4')
    expect(dr.ways).toBe(2)
    expect(dr.payCredits).toBe(120)
    const kk = wins.find(w => w.entry.symbol === 'KK')!
    // KK-or-WD counts: 2,1,1,1,1 -> run 5, ways 2
    expect(kk.entry.id).toBe('kk5')
    expect(kk.payCredits).toBe(50)
  })
  it('requires the symbol on reel 1 (anchored) and run >= 3', () => {
    // stop r1 window [QQ,DR,KK]... QQ has no paytable entries -> only DR/KK probed
    const wins = evalWays(WAYS_DEF, [3, 1, 1, 1, 1])
    // r1 window [QQ,DR,QQ]: DR count 1; r2 [QQ,DR,KK]: 1; r3 [QQ,KK,WD]: 1 (wild);
    // r4 [KK,DR,QQ]: 1; r5 [QQ,QQ,DR]: 1 -> DR run 5 ways 1
    const dr = wins.find(w => w.entry.symbol === 'DR')!
    expect(dr.entry.id).toBe('dr5')
    expect(dr.ways).toBe(1)
    // KK: r1 window [QQ,DR,QQ] has 0 KK -> no KK win despite later reels
    expect(wins.find(w => w.entry.symbol === 'KK')).toBeUndefined()
  })
})

describe('scatter and orb windows', () => {
  const def = {
    ...WAYS_DEF,
    strips: [
      ['SC', 'AA', 'AA', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'SC', 'AA', 'AA', 'AA'],
      ['AA', 'AA', 'AA', 'AA', 'AA', 'AA'],
      ['OR', 'OR', 'AA', 'AA', 'AA', 'OR'],
      ['AA', 'OR', 'AA', 'AA', 'AA', 'AA']
    ],
    scatter: { symbol: 'SC', pays: { 3: 2 }, triggerCount: 3 },
    holdAndSpin: {
      orbSymbol: 'OR', triggerCount: 6, respins: 3,
      respinOrbNumer: 2, respinOrbDenom: 24, orbValues: [{ credits: 25, weight: 1 }],
      emptySymbol: 'EM'
    }
  } as unknown as VideoMachineDef
  it('counts at most one scatter per reel window', () => {
    // r1 stop 0 window [SC,AA,AA] -> 1; r2 stop 0 [AA,AA,SC] -> 1; rest 0
    expect(scatterVisibleCount(def, [0, 0, 0, 0, 0])).toBe(2)
    expect(scatterVisibleCount(def, [1, 3, 0, 0, 0])).toBe(0)
  })
  it('reports orb cells as reel*3+row', () => {
    // r4 stop 5 window [OR,OR,OR] (wraps 5,0,1) -> cells 9,10,11; r5 stop 0 [AA,OR,AA] -> cell 13
    expect(orbCells(def, [1, 1, 0, 5, 0]).map(o => o.cell)).toEqual([9, 10, 11, 13])
  })
  it('returns 0 / [] when the machine has no scatter or orbs', () => {
    expect(scatterVisibleCount(WAYS_DEF, [0, 0, 0, 0, 0])).toBe(0)
    expect(orbCells(WAYS_DEF, [0, 0, 0, 0, 0])).toEqual([])
  })
})
