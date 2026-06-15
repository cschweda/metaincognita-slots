// Lucky 21 engine — hand evaluation (Task 3) + step functions + payout (Task 4).

import type {
  BlackjackReelMachineDef,
  BlackjackReelSessionState,
  FeatureEvent,
  MachineSessionState,
  SpinOutcome,
  SymbolId
} from './types'
import type { RandomFn } from './rng'
import { buildDeck, shuffle, cardValue, isAce } from './deck'

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

// ---------- Task 4: fresh session state ----------

export function freshBlackjackState(): BlackjackReelSessionState {
  return {
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
}

// ---------- Task 4: payout ----------

/** Look up a total in the paytable; returns 0 when absent. */
export function payEntry(paytable: { total: number, pay: number }[], total: number): number {
  return paytable.find(e => e.total === total)?.pay ?? 0
}

/**
 * Best-total paytable × additive multiplier × Charlie ×, with the qualify
 * floor and natural premium. Returns whole credits.
 */
export function handPayout(def: BlackjackReelMachineDef, bj: BlackjackReelSessionState): number {
  if (bj.busted) return 0
  const mult = Math.max(1, bj.multSum)
  let base: number
  if (bj.charlie) {
    base = Math.max(payEntry(def.paytable, bj.bestTotal), payEntry(def.paytable, def.qualifyMin))
  } else {
    base = payEntry(def.paytable, bj.bestTotal)
  }
  // natural (2-card 21) and charlie (survived all 5) are mutually exclusive; guard so a
  // future variant can't let the natural premium silently bypass the Charlie multiplier.
  if (bj.natural && !bj.charlie && bj.bestTotal === 21) base = def.naturalPay
  const charlieMul = bj.charlie ? def.charlieMultiplier : 1
  return base * mult * charlieMul * bj.ante
}

// ---------- Task 4: internal outcome builder ----------

function outcome(
  def: BlackjackReelMachineDef,
  bj: BlackjackReelSessionState,
  coins: number,
  coinsIn: number,
  featureEvents: FeatureEvent[],
  payout = 0
): SpinOutcome {
  return {
    machineId: def.id,
    family: 'blackjack-reel',
    coins,
    gameKind: 'base',
    coinsIn,
    stops: [],
    grid: bj.landed.map(s => (s !== null ? [s] : [])),
    wins: payout > 0
      ? [{
          line: 'hand',
          entryId: bj.charlie ? 'charlie' : `total-${bj.bestTotal}`,
          symbols: [...bj.hand],
          payCredits: payout,
          wildCount: 0,
          progressive: false
        }]
      : [],
    totalPayout: payout,
    progressiveEvents: [],
    featureEvents,
    trace: { draws: [] }
  }
}

// ---------- Task 4: step functions ----------

/**
 * Deal phase: builds dealt reel strips (resolving 'CARD' tokens to unique deck
 * cards), locks ante, transitions to 'spinning'.
 */
export function dealReels(
  def: BlackjackReelMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  const bj = freshBlackjackState()
  bj.ante = coins
  bj.phase = 'spinning'
  const deck = shuffle(buildDeck(), rand)
  let di = 0
  bj.reelStrips = def.reels.map(slots =>
    slots.map(tok => (tok === 'CARD' ? deck[di++]! : tok)))
  state.blackjackReel = bj
  return outcome(def, bj, coins, coins, [{ type: 'cards-dealt', strips: bj.reelStrips.map(s => [...s]) }])
}

/**
 * Stop the next reel: picks a uniform random symbol from that reel's dealt
 * strip, applies it to the hand, updates best total (ratchet), checks for
 * bust/BUST, natural, and Five-Card-Charlie auto-resolve.
 */
export function stopReel(
  def: BlackjackReelMachineDef,
  state: MachineSessionState,
  rand: RandomFn
): SpinOutcome {
  const bj = state.blackjackReel
  if (bj === null) throw new Error(`${def.id}: stopReel with no hand`)
  if (bj.phase !== 'spinning') throw new Error(`${def.id}: stopReel in phase ${bj.phase}`)
  const r = bj.idx
  const strip = bj.reelStrips[r]!
  const sym = strip[Math.floor(rand() * strip.length)]!
  bj.landed[r] = sym
  bj.idx = r + 1
  // BUST symbol: instant loss, no card added to hand
  if (sym === def.bustSymbol) {
    bj.busted = true
    bj.bustBySymbol = true
    bj.phase = 'resolved'
    return outcome(def, bj, bj.ante, 0, [{ type: 'bust', reel: r, bySymbol: true }])
  }
  // Add symbol to hand and recompute
  bj.hand.push(sym)
  const acc = freshAcc()
  for (const s of bj.hand) applySymbol(acc, def, s)
  const bt = bestTotal(acc.hard, acc.aces)
  bj.hard = acc.hard
  bj.aces = acc.aces
  bj.multSum = acc.multSum
  // Over-21 bust
  if (bt.total > 21) {
    bj.busted = true
    bj.phase = 'resolved'
    return outcome(def, bj, bj.ante, 0, [{ type: 'bust', reel: r, bySymbol: false }])
  }
  // Ratchet: only advance bestTotal upward
  if (bt.total > bj.bestTotal) bj.bestTotal = bt.total
  // Natural: 2-card 21
  if (r === 1 && bt.total === 21) bj.natural = true // second reel = 2-card 21 → natural
  // Five-Card Charlie: survived all five reels
  if (bj.idx === 5) {
    bj.charlie = true
    bj.phase = 'resolved'
    const pay = handPayout(def, bj)
    return outcome(def, bj, bj.ante, 0, [{ type: 'charlie', cards: [...bj.hand] }], pay)
  }
  return outcome(def, bj, bj.ante, 0, [{ type: 'reel-stopped', reel: r, symbol: sym }])
}

/**
 * Cash out: resolve the hand at its current best total. May be called at any
 * point while phase === 'spinning'.
 */
export function cashOut(
  def: BlackjackReelMachineDef,
  state: MachineSessionState
): SpinOutcome {
  const bj = state.blackjackReel
  if (bj === null) throw new Error(`${def.id}: cashOut with no hand`)
  if (bj.phase !== 'spinning') throw new Error(`${def.id}: cashOut in phase ${bj.phase}`)
  bj.phase = 'resolved'
  const pay = handPayout(def, bj)
  return outcome(def, bj, bj.ante, 0, [{ type: 'cash-out', bestTotal: bj.bestTotal, payout: pay }], pay)
}
