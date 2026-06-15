import { describe, expect, it } from 'vitest'
import type { BlackjackReelMachineDef, BlackjackReelSessionState } from '../app/engine/types'
import { freshAcc, applySymbol, bestTotal, evaluateHand } from '../app/engine/blackjackReel'
import type { EvalCfg } from '../app/engine/blackjackReel'

// Lucky 21: Task 1 — type shape test. Old Hit-or-Bust engine tests removed;
// restored progressively in Tasks 3–5.

// Minimal fixture — only the fields that eval needs.
const fix: EvalCfg = {
  multiplierSymbols: { MX2: 2, MX3: 3 },
  minusSymbols: { MM2: 2, MM3: 3 },
  bustSymbol: 'BUST'
}

describe('lucky-21 hand evaluation', () => {
  it('freshAcc returns zeroed accumulator', () => {
    expect(freshAcc()).toEqual({ hard: 0, aces: 0, multSum: 0 })
  })

  it('applySymbol accumulates a plain card', () => {
    const acc = freshAcc()
    applySymbol(acc, fix, '7C')
    expect(acc.hard).toBe(7)
    expect(acc.aces).toBe(0)
    expect(acc.multSum).toBe(0)
  })

  it('applySymbol counts aces as 1 in hard', () => {
    const acc = freshAcc()
    applySymbol(acc, fix, 'AS')
    expect(acc.hard).toBe(1)
    expect(acc.aces).toBe(1)
  })

  it('applySymbol adds multiplier to multSum, 0 to hard', () => {
    const acc = freshAcc()
    applySymbol(acc, fix, 'MX2')
    expect(acc.multSum).toBe(2)
    expect(acc.hard).toBe(0)
  })

  it('applySymbol subtracts minus from hard, floored at 0', () => {
    const acc = freshAcc()
    acc.hard = 5
    applySymbol(acc, fix, 'MM3')
    expect(acc.hard).toBe(2)
    const acc2 = freshAcc()
    applySymbol(acc2, fix, 'MM3')
    expect(acc2.hard).toBe(0)
  })

  it('bestTotal promotes ace to 11 when it fits', () => {
    expect(bestTotal(7, 1)).toEqual({ total: 17, isSoft: true, softLow: 7 })
  })

  it('bestTotal keeps ace as 1 when 11 would bust', () => {
    expect(bestTotal(12, 1)).toEqual({ total: 12, isSoft: false, softLow: 12 })
  })

  it('bestTotal with no aces is just hard', () => {
    expect(bestTotal(17, 0)).toEqual({ total: 17, isSoft: false, softLow: 17 })
  })

  it('sums hard cards', () => {
    expect(evaluateHand(fix, ['7C', 'KD']).total).toBe(17)
  })

  it('ace soft then hard', () => {
    expect(evaluateHand(fix, ['AS', '7C'])).toMatchObject({ total: 18, isSoft: true })
    expect(evaluateHand(fix, ['AS', '7C', 'KD'])).toMatchObject({ total: 18, isSoft: false })
  })

  it('dual best total: 6 + ace = 7 or 17', () => {
    const e = evaluateHand(fix, ['6C', 'AS'])
    expect(e.total).toBe(17)
    expect(e.softLow).toBe(7)
  })

  it('minus subtracts, floored at 0', () => {
    expect(evaluateHand(fix, ['6C', '8D', 'MM3']).total).toBe(11)
    expect(evaluateHand(fix, ['2C', 'MM3', 'MM3']).total).toBe(0)
  })

  it('multipliers add, contribute 0 to total', () => {
    const e = evaluateHand(fix, ['KD', 'MX2', '7C', 'MX3'])
    expect(e.total).toBe(17)
    expect(e.multSum).toBe(5)
  })

  it('over 21 busts', () => {
    expect(evaluateHand(fix, ['KD', 'KS', '2C']).busted).toBe(true)
  })
})

describe('lucky-21 types', () => {
  it('has the lucky-21 def shape', () => {
    const d: Pick<BlackjackReelMachineDef, 'family' | 'qualifyMin' | 'charlieMultiplier'>
      = { family: 'blackjack-reel', qualifyMin: 15, charlieMultiplier: 3 }
    expect(d.qualifyMin).toBe(15)
  })

  it('has the lucky-21 session state shape', () => {
    const s: BlackjackReelSessionState = {
      phase: 'idle',
      reelStrips: [],
      landed: [null, null, null, null, null],
      idx: 0,
      hand: [],
      hard: 0,
      aces: 0,
      multSum: 0,
      bestTotal: 0,
      natural: false,
      busted: false,
      bustBySymbol: false,
      charlie: false,
      ante: 0
    }
    expect(s.phase).toBe('idle')
    expect(s.landed).toHaveLength(5)
  })
})
