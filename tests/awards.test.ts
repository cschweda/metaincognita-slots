import { describe, it, expect } from 'vitest'
import { leftRun, ballyAwardForLine, bestStepperAward } from '../app/engine/awards'
import type { BallyAward, StepperAward } from '../app/engine/types'

describe('leftRun', () => {
  it('counts the run from the left', () => {
    expect(leftRun(['S7', 'S7', 'BE'], 'S7')).toBe(2)
    expect(leftRun(['BE', 'S7', 'S7'], 'S7')).toBe(0)
    expect(leftRun(['S7', 'S7', 'S7'], 'S7')).toBe(3)
    expect(leftRun([], 'S7')).toBe(0)
  })
})

describe('ballyAwardForLine — exact-length run + allOf', () => {
  const pays: BallyAward[] = [
    { id: '7x3', kind: 'run', symbol: 'S7', length: 3, pay: 100 },
    { id: 'bars', kind: 'allOf', symbol: 'BAR', pay: 150 },
    { id: 'be3', kind: 'run', symbol: 'BE', length: 3, pay: 20 },
    { id: 'ch2', kind: 'run', symbol: 'CH', length: 2, pay: 5 },
    { id: 'ch1', kind: 'run', symbol: 'CH', length: 1, pay: 2 }
  ]

  it('matches an exact run', () => {
    expect(ballyAwardForLine(['S7', 'S7', 'S7'], pays)?.id).toBe('7x3')
  })

  it('a longer run does NOT match a shorter exact-length entry', () => {
    // 4-reel line, run of 4 sevens, but only a length-3 entry exists → no match
    const fourReel: BallyAward[] = [{ id: '7x3', kind: 'run', symbol: 'S7', length: 3, pay: 100 }]
    expect(ballyAwardForLine(['S7', 'S7', 'S7', 'S7'], fourReel)).toBeNull()
  })

  it('run must start at reel 1', () => {
    expect(ballyAwardForLine(['BE', 'S7', 'S7'], pays)).toBeNull()
  })

  it('allOf matches only a full line of the symbol', () => {
    expect(ballyAwardForLine(['BAR', 'BAR', 'BAR'], pays)?.id).toBe('bars')
    expect(ballyAwardForLine(['BAR', 'BAR', 'BE'], pays)).toBeNull()
  })

  it('cherry runs pay by exact length', () => {
    expect(ballyAwardForLine(['CH', 'BE', 'BAR'], pays)?.id).toBe('ch1')
    expect(ballyAwardForLine(['CH', 'CH', 'BAR'], pays)?.id).toBe('ch2')
  })
})

describe('bestStepperAward — max pay wins, wild doubling', () => {
  const paytable: StepperAward[] = [
    { id: '3dw', kind: 'allWild', pay: 1000 },
    { id: '3s7', kind: 'allSame', symbol: 'S7', pay: 80 },
    { id: '3b3', kind: 'allSame', symbol: 'B3', pay: 40 },
    { id: '3b2', kind: 'allSame', symbol: 'B2', pay: 25 },
    { id: '3b1', kind: 'allSame', symbol: 'B1', pay: 10 },
    { id: '3ch', kind: 'allSame', symbol: 'CH', pay: 10 },
    { id: 'anybar', kind: 'anyOf', symbols: ['B1', 'B2', 'B3'], pay: 5 },
    { id: 'ch2', kind: 'count', symbol: 'CH', n: 2, pay: 5 },
    { id: 'ch1', kind: 'count', symbol: 'CH', n: 1, pay: 2 }
  ]
  const def = { paytable, wildSymbol: 'DW', wildMultiplier: 2 }

  it('three wilds pay allWild flat (not allSame x multiplier)', () => {
    const r = bestStepperAward(['DW', 'DW', 'DW'], def)
    expect(r?.entry.id).toBe('3dw')
    expect(r?.payCredits).toBe(1000)
  })

  it('one wild doubles, two wilds quadruple', () => {
    expect(bestStepperAward(['B1', 'B1', 'DW'], def)?.payCredits).toBe(20)
    expect(bestStepperAward(['B1', 'DW', 'DW'], def)?.payCredits).toBe(40)
    expect(bestStepperAward(['S7', 'DW', 'S7'], def)?.payCredits).toBe(160)
  })

  it('mixed bars pay anyOf, wilds double it, but a pure triple beats it', () => {
    expect(bestStepperAward(['B1', 'B2', 'B3'], def)?.payCredits).toBe(5)
    expect(bestStepperAward(['B1', 'B2', 'DW'], def)?.payCredits).toBe(10) // anybar x2
    expect(bestStepperAward(['B1', 'B1', 'B1'], def)?.entry.id).toBe('3b1') // 10 > 5
  })

  it('count entries see actual symbols only — no wild help, no doubling', () => {
    expect(bestStepperAward(['CH', 'BL', 'BL'], def)?.payCredits).toBe(2)
    expect(bestStepperAward(['CH', 'CH', 'BL'], def)?.payCredits).toBe(5)
    // CH + 2 wilds: allSame CH (10) x4 = 40 beats count(CH,1) = 2
    expect(bestStepperAward(['CH', 'DW', 'DW'], def)?.payCredits).toBe(40)
  })

  it('wild + blanks pay nothing', () => {
    expect(bestStepperAward(['BL', 'DW', 'DW'], def)).toBeNull()
    expect(bestStepperAward(['BL', 'BL', 'BL'], def)).toBeNull()
  })

  it('works without a wild symbol', () => {
    const noWild = { paytable, wildSymbol: null, wildMultiplier: 1 }
    expect(bestStepperAward(['B1', 'B1', 'B1'], noWild)?.payCredits).toBe(10)
    expect(bestStepperAward(['B1', 'B1', 'DW'], noWild)).toBeNull()
  })
})
