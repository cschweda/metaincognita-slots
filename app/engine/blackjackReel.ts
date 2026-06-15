import type {
  BlackjackReelMachineDef,
  BlackjackReelSessionState,
  MachineSessionState,
  SpinOutcome,
  SymbolId
} from './types'
import type { RandomFn } from './rng'

// ---------- hand evaluation ----------

export interface HandEval {
  total: number // best total <= 21, or the minimum total if busted
  isSoft: boolean
  busted: boolean
  multSum: number
  saveSeen: boolean
}

/**
 * Narrow config for evaluateHand — accepts the full def or a test fixture with
 * just the four fields needed.
 */
type EvalCfg = Pick<BlackjackReelMachineDef, 'cardValues' | 'aceSymbol' | 'multiplierSymbols' | 'bustSaveSymbol'>

/**
 * Evaluate a blackjack hand.
 *
 * Multiplier symbols and the bust-save symbol contribute ZERO to the hand
 * total (they are special cards, not value cards) — only value cards and aces
 * can raise the total and therefore can cause a bust.
 *
 * Ace logic: each ace always contributes hard 1; if promoting exactly one ace
 * to 11 keeps the total <= 21 we do so (soft hand). At most one ace is ever
 * promoted (standard blackjack rule).
 */
export function evaluateHand(def: EvalCfg, cards: readonly SymbolId[]): HandEval {
  let hard = 0
  let aces = 0
  let multSum = 0
  let saveSeen = false
  for (const c of cards) {
    if (c === def.aceSymbol) {
      aces++
      hard += 1
      continue
    }
    if (c in def.multiplierSymbols) {
      multSum += def.multiplierSymbols[c]!
      continue
    }
    if (def.bustSaveSymbol !== null && c === def.bustSaveSymbol) {
      saveSeen = true
      continue
    }
    hard += def.cardValues[c] ?? 0
  }
  // promote one ace to 11 if it fits (adds 10 on top of the already-counted hard 1)
  let total = hard
  let isSoft = false
  if (aces > 0 && hard + 10 <= 21) {
    total = hard + 10
    isSoft = true
  }
  return { total, isSoft, busted: total > 21, multSum, saveSeen }
}

// ---------- fresh state ----------

export function freshBlackjackState(): BlackjackReelSessionState {
  return {
    phase: 'idle',
    cards: [],
    total: 0,
    isSoft: false,
    multSum: 0,
    saveHeld: false,
    busted: false,
    charlie: false,
    ante: 0
  }
}

// ---------- paytable helpers ----------

/**
 * Look up the per-coin payout for a given hand total.
 * Returns 0 if the total is not listed (e.g. busted or unlisted total).
 */
export function payEntry(paytable: { total: number, pay: number }[], total: number): number {
  return paytable.find(e => e.total === total)?.pay ?? 0
}

/**
 * Shared payout calculation for stand and charlie auto-resolve.
 * payout = payEntry(total) × max(1, multSum) × ante
 *        + (charlie ? charlieBonus × max(1, multSum) × ante : 0)
 */
function resolvePayout(def: BlackjackReelMachineDef, bj: BlackjackReelSessionState): number {
  const mult = Math.max(1, bj.multSum)
  const base = payEntry(def.paytable, bj.total) * mult * bj.ante
  const bonus = bj.charlie ? def.charlieBonus * mult * bj.ante : 0
  return base + bonus
}

// ---------- step functions ----------

/**
 * Apply an eval result back to the session state.
 * saveHeld is set to true if a save symbol is present AND the save has not
 * already been consumed this hand. We track this by checking saveSeen each
 * time: once consumed the card is removed from bj.cards so saveSeen returns
 * false on subsequent evaluations.
 */
function applyEval(bj: BlackjackReelSessionState, ev: HandEval): void {
  bj.total = ev.total
  bj.isSoft = ev.isSoft
  bj.busted = ev.busted
  bj.multSum = ev.multSum
  // saveHeld reflects whether an unspent save is visible in the current cards
  bj.saveHeld = ev.saveSeen
}

/**
 * Deal two initial cards. Resets any prior hand, charges the ante, and returns
 * a SpinOutcome with coinsIn = coins, totalPayout = 0.
 *
 * The grid is represented as a single row (the dealt cards); stops hold the
 * strip indices drawn.
 */
export function dealHand(
  def: BlackjackReelMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  // reset
  const bj = freshBlackjackState()
  bj.ante = coins
  bj.phase = 'dealt'
  state.blackjackReel = bj

  const stops: number[] = []

  // draw card 1 from strips[0], card 2 from strips[1]
  for (let r = 0; r < 2; r++) {
    const strip = def.strips[r]!
    const idx = Math.floor(rand() * strip.length)
    stops.push(idx)
    bj.cards.push(strip[idx]!)
  }

  const ev = evaluateHand(def, bj.cards)
  applyEval(bj, ev)

  // grid: one row of dealt symbols (cards are the visible positions)
  const grid: SymbolId[][] = bj.cards.map(c => [c])

  return {
    machineId: def.id,
    family: 'blackjack-reel',
    coins,
    gameKind: 'base',
    coinsIn: coins,
    stops,
    grid,
    wins: [],
    totalPayout: 0,
    progressiveEvents: [],
    featureEvents: [{ type: 'cards-dealt', cards: [...bj.cards] }],
    trace: { draws: [] }
  }
}

/**
 * Hit: draw one card from strips[cards.length] (the next reel).
 *
 * Cases:
 *  - Busted + saveHeld: void the busting card (pop it), re-evaluate, consume
 *    the save (saveHeld → false since the save card remains but saveSeen will
 *    be false after removal of the busting card; to avoid re-granting, we
 *    explicitly set saveHeld = false after consume). Phase stays 'dealt'.
 *  - Busted + no save: busted = true, phase = 'resolved', payout 0.
 *  - 5 cards drawn without bust: charlie = true, auto-resolve.
 *  - Otherwise: stay 'dealt'.
 *
 * coinsIn is always 0 (hits are free).
 */
export function hitCard(
  def: BlackjackReelMachineDef,
  state: MachineSessionState,
  rand: RandomFn
): SpinOutcome {
  const bj = state.blackjackReel
  if (bj === null) throw new Error(`${def.id}: no blackjackReel state`)
  if (bj.phase !== 'dealt') throw new Error(`${def.id}: hitCard called in phase '${bj.phase}'`)

  const reelIdx = bj.cards.length // 2, 3, or 4 (0-indexed; deal used 0+1)
  const strip = def.strips[reelIdx]!
  const idx = Math.floor(rand() * strip.length)
  const drawnCard = strip[idx]!
  bj.cards.push(drawnCard)

  const ev = evaluateHand(def, bj.cards)
  applyEval(bj, ev)

  const baseGrid: SymbolId[][] = bj.cards.map(c => [c])

  // --- bust handling ---
  if (bj.busted) {
    if (bj.saveHeld) {
      // consume the save: void the busting card (pop it) AND remove the SAVE
      // symbol from bj.cards so subsequent evaluateHand calls return saveSeen=false
      // (save is truly spent).
      const voidedCard = bj.cards.pop()!
      // Remove the save card from the hand record so it cannot re-trigger
      const saveIdx = def.bustSaveSymbol !== null
        ? bj.cards.indexOf(def.bustSaveSymbol)
        : -1
      if (saveIdx !== -1) bj.cards.splice(saveIdx, 1)
      const evAfter = evaluateHand(def, bj.cards)
      applyEval(bj, evAfter)
      // saveHeld is now false because saveSeen is false (card removed)
      bj.saveHeld = false

      const gridAfter: SymbolId[][] = bj.cards.map(c => [c])
      return {
        machineId: def.id,
        family: 'blackjack-reel',
        coins: bj.ante,
        gameKind: 'base',
        coinsIn: 0,
        stops: [idx],
        grid: gridAfter,
        wins: [],
        totalPayout: 0,
        progressiveEvents: [],
        featureEvents: [{ type: 'bust-saved', voidedCard }],
        trace: { draws: [] }
      }
    }

    // no save: bust out
    bj.phase = 'resolved'
    return {
      machineId: def.id,
      family: 'blackjack-reel',
      coins: bj.ante,
      gameKind: 'base',
      coinsIn: 0,
      stops: [idx],
      grid: baseGrid,
      wins: [],
      totalPayout: 0,
      progressiveEvents: [],
      featureEvents: [{ type: 'bust' }],
      trace: { draws: [] }
    }
  }

  // --- charlie: 5 cards, no bust ---
  if (bj.cards.length === 5) {
    bj.charlie = true
    bj.phase = 'resolved'
    const payout = resolvePayout(def, bj)
    return {
      machineId: def.id,
      family: 'blackjack-reel',
      coins: bj.ante,
      gameKind: 'base',
      coinsIn: 0,
      stops: [idx],
      grid: baseGrid,
      wins: payout > 0
        ? [{ line: 'charlie', entryId: 'charlie', symbols: [...bj.cards], payCredits: payout, wildCount: 0, progressive: false }]
        : [],
      totalPayout: payout,
      progressiveEvents: [],
      featureEvents: [{ type: 'charlie', cards: [...bj.cards] }],
      trace: { draws: [] }
    }
  }

  // --- normal hit, continue ---
  return {
    machineId: def.id,
    family: 'blackjack-reel',
    coins: bj.ante,
    gameKind: 'base',
    coinsIn: 0,
    stops: [idx],
    grid: baseGrid,
    wins: [],
    totalPayout: 0,
    progressiveEvents: [],
    featureEvents: [{ type: 'hit', card: drawnCard }],
    trace: { draws: [] }
  }
}

/**
 * Stand: resolve the hand at its current total.
 * payout = payEntry(total) × max(1, multSum) × ante
 */
export function standHand(
  def: BlackjackReelMachineDef,
  state: MachineSessionState
): SpinOutcome {
  const bj = state.blackjackReel
  if (bj === null) throw new Error(`${def.id}: no blackjackReel state`)
  if (bj.phase !== 'dealt') throw new Error(`${def.id}: standHand called in phase '${bj.phase}'`)

  bj.phase = 'resolved'
  const payout = resolvePayout(def, bj)

  return {
    machineId: def.id,
    family: 'blackjack-reel',
    coins: bj.ante,
    gameKind: 'base',
    coinsIn: 0,
    stops: [],
    grid: bj.cards.map(c => [c]),
    wins: payout > 0
      ? [{ line: 'hand', entryId: `total-${bj.total}`, symbols: [...bj.cards], payCredits: payout, wildCount: 0, progressive: false }]
      : [],
    totalPayout: payout,
    progressiveEvents: [],
    featureEvents: [{ type: 'stand', total: bj.total, payout }],
    trace: { draws: [] }
  }
}
