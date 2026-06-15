// Lucky 21 engine — hand evaluation layer (Task 3).
// Step functions (dealReels/stopReel/cashOut/handPayout) are Task 4 stubs.

import type { BlackjackReelMachineDef, SymbolId } from './types'
import { cardValue, isAce } from './deck'

// ---------- accumulator ----------

export interface HandAcc {
  hard: number
  aces: number
  multSum: number
}

export function freshAcc(): HandAcc {
  return { hard: 0, aces: 0, multSum: 0 }
}

// ---------- types ----------

export type EvalCfg = Pick<BlackjackReelMachineDef, 'multiplierSymbols' | 'minusSymbols' | 'bustSymbol'>

export interface HandEval {
  total: number
  isSoft: boolean
  softLow: number
  busted: boolean
  multSum: number
}

// ---------- helpers ----------

/**
 * Fold one symbol into the accumulator.
 * BUST is never passed here — the step function handles instant loss.
 * Multiplier symbols add to multSum and contribute 0 to the hard total.
 * Minus symbols subtract from the hard total, floored at 0.
 * Aces count as 1 in the hard total; a single ace may be promoted to 11 by bestTotal.
 */
export function applySymbol(acc: HandAcc, def: EvalCfg, sym: SymbolId): HandAcc {
  if (sym in def.multiplierSymbols) {
    acc.multSum += def.multiplierSymbols[sym]!
    return acc
  }
  if (sym in def.minusSymbols) {
    acc.hard = Math.max(0, acc.hard - def.minusSymbols[sym]!)
    return acc
  }
  if (isAce(sym)) {
    acc.aces++
    acc.hard += 1
    return acc
  }
  acc.hard += cardValue(sym)
  return acc
}

/**
 * Compute the best total ≤ 21, promoting at most one ace from 1 → 11 when it fits.
 * Returns the all-hard value as softLow (the "dual display" low number, e.g. "7 or 17").
 */
export function bestTotal(
  hard: number,
  aces: number
): { total: number, isSoft: boolean, softLow: number } {
  if (aces > 0 && hard + 10 <= 21) {
    return { total: hard + 10, isSoft: true, softLow: hard }
  }
  return { total: hard, isSoft: false, softLow: hard }
}

/** Evaluate a complete sequence of symbols and return the hand result. */
export function evaluateHand(def: EvalCfg, syms: readonly SymbolId[]): HandEval {
  const acc = freshAcc()
  for (const s of syms) {
    applySymbol(acc, def, s)
  }
  const bt = bestTotal(acc.hard, acc.aces)
  return {
    total: bt.total,
    isSoft: bt.isSoft,
    softLow: bt.softLow,
    busted: bt.total > 21,
    multSum: acc.multSum
  }
}

// ---------- Task 4 stubs (DO NOT IMPLEMENT HERE) ----------

export function dealReels(): never {
  throw new Error('dealReels: not implemented — later task')
}

export function stopReel(): never {
  throw new Error('stopReel: not implemented — later task')
}

export function cashOut(): never {
  throw new Error('cashOut: not implemented — later task')
}

export function handPayout(): never {
  throw new Error('handPayout: not implemented — later task')
}
