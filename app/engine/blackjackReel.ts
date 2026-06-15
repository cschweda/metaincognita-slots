import type {
  BlackjackReelMachineDef,
  BlackjackReelSessionState,
  MachineSessionState,
  SpinOutcome,
  SymbolId
} from './types'
import type { RandomFn } from './rng'

// ---------- VOID sentinel ----------

/**
 * Sentinel SymbolId placed in the cards array when a bust-save fires.
 * It occupies the reel slot (so cards.length advances monotonically) but
 * contributes 0 to the hand total, multiplier sum, and save count.
 */
export const VOID_CARD: SymbolId = 'VOID'

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
export type EvalCfg = Pick<BlackjackReelMachineDef, 'cardValues' | 'aceSymbol' | 'multiplierSymbols' | 'bustSaveSymbol'>

/**
 * The Markovian sufficient statistic of a hand, accumulated card-by-card.
 *
 *  - `hard`     : sum of value cards plus 1 per ace (every ace counts hard 1).
 *  - `aces`     : number of aces held (so exactly one may be promoted to 11).
 *  - `multSum`  : additive multiplier face sum (0 ⇒ pays ×1).
 *  - `saveCount`: number of unspent bust-save symbols held.
 *
 * This is the EXACT state both `evaluateHand` (live engine) and the
 * optimal-stopping DP derive their answers from, so the two code paths cannot
 * diverge.
 */
export interface HandAcc {
  hard: number
  aces: number
  multSum: number
  saveCount: number
}

export function freshAcc(): HandAcc {
  return { hard: 0, aces: 0, multSum: 0, saveCount: 0 }
}

/**
 * Fold a single drawn symbol into the accumulator (the one shared primitive for
 * the live engine and the DP). Multiplier symbols, the bust-save symbol, and the
 * VOID sentinel all contribute ZERO to the hand total — only value cards and aces
 * can raise the total and therefore can cause a bust.
 */
export function applyCard(acc: HandAcc, def: EvalCfg, card: SymbolId): HandAcc {
  // VOID sentinel: occupies a reel slot but contributes nothing
  if (card === VOID_CARD) return acc
  if (card === def.aceSymbol) {
    acc.aces++
    acc.hard += 1
    return acc
  }
  if (card in def.multiplierSymbols) {
    acc.multSum += def.multiplierSymbols[card]!
    return acc
  }
  if (def.bustSaveSymbol !== null && card === def.bustSaveSymbol) {
    acc.saveCount++
    return acc
  }
  acc.hard += def.cardValues[card] ?? 0
  return acc
}

/**
 * Best blackjack total for a given hard sum + ace count.
 *
 * Each ace already contributes hard 1; if promoting exactly one ace to 11 keeps
 * the total <= 21 we do so (soft hand). At most one ace is ever promoted
 * (standard blackjack rule — two soft aces would be 22). Returns the busting
 * minimum total when even the all-hard sum exceeds 21.
 */
export function bestTotal(hard: number, aces: number): { total: number, isSoft: boolean } {
  if (aces > 0 && hard + 10 <= 21) return { total: hard + 10, isSoft: true }
  return { total: hard, isSoft: false }
}

/**
 * Evaluate a blackjack hand.
 *
 * Multiplier symbols and the bust-save symbol contribute ZERO to the hand
 * total (they are special cards, not value cards) — only value cards and aces
 * can raise the total and therefore can cause a bust.
 *
 * Built on the same `applyCard` + `bestTotal` primitives the DP uses so the two
 * are guaranteed to agree.
 */
export function evaluateHand(def: EvalCfg, cards: readonly SymbolId[]): HandEval {
  const acc = freshAcc()
  for (const c of cards) applyCard(acc, def, c)
  const { total, isSoft } = bestTotal(acc.hard, acc.aces)
  return { total, isSoft, busted: total > 21, multSum: acc.multSum, saveSeen: acc.saveCount > 0 }
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
 *
 * saveHeld is managed as EXPLICIT state — this function does NOT touch it.
 * It is set to true when a SAVE symbol is first drawn (in dealHand or hitCard),
 * and set to false when the save is consumed (in hitCard's bust-save path).
 * A SAVE card left in bj.cards after consumption must NOT re-grant the save,
 * so we must never re-derive saveHeld from saveSeen here.
 */
function applyEval(bj: BlackjackReelSessionState, ev: HandEval): void {
  bj.total = ev.total
  bj.isSoft = ev.isSoft
  bj.busted = ev.busted
  bj.multSum = ev.multSum
  // saveHeld is intentionally NOT updated here — see comment above.
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
  // Set saveHeld explicitly from the initial deal evaluation.
  // After this point saveHeld is only updated explicitly (set true on SAVE draw,
  // false on save consume) — never re-derived from evaluateHand.
  bj.saveHeld = ev.saveSeen

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
 *  - Busted + saveHeld: void the busting card IN PLACE (replace cards[last]
 *    with VOID_CARD so cards.length stays the same — the slot is consumed but
 *    contributes 0). Set saveHeld = false explicitly. Phase stays 'dealt'. The
 *    next hit draws from the NEXT reel (monotonically advancing reel index).
 *  - Busted + no save: busted = true, phase = 'resolved', payout 0.
 *  - 5 cards reached without bust: charlie = true, auto-resolve.
 *  - Otherwise: stay 'dealt'.
 *
 * saveHeld is managed as EXPLICIT state — this function sets it true when a
 * SAVE card is drawn (so subsequent bust triggers it) and false on consume.
 * It is never re-derived from evaluateHand so a SAVE left in bj.cards after
 * consumption cannot re-grant the mechanic.
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

  // Set saveHeld explicitly when a SAVE symbol is drawn.
  if (def.bustSaveSymbol !== null && drawnCard === def.bustSaveSymbol) {
    bj.saveHeld = true
  }

  const ev = evaluateHand(def, bj.cards)
  applyEval(bj, ev)

  const baseGrid: SymbolId[][] = bj.cards.map(c => [c])

  // --- bust handling ---
  if (bj.busted) {
    if (bj.saveHeld) {
      // Bust-Save: void the busting card IN PLACE so the reel index advances
      // monotonically. cards.length stays the same (the slot is consumed with 0
      // contribution). saveHeld is set false via explicit state — the SAVE card
      // remains in bj.cards but must NOT re-grant on future evaluations.
      const voidedCard = drawnCard
      bj.cards[bj.cards.length - 1] = VOID_CARD
      bj.saveHeld = false

      // Re-evaluate with VOID in place so total/busted are correct.
      const evAfter = evaluateHand(def, bj.cards)
      applyEval(bj, evAfter)

      const gridAfter: SymbolId[][] = bj.cards.map(c => [c])

      // If the voided card was the 5th reel slot, the hand survives all 5 reels
      // via the save: trigger Five-Card Charlie immediately.
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
          grid: gridAfter,
          wins: payout > 0
            ? [{ line: 'charlie', entryId: 'charlie', symbols: [...bj.cards], payCredits: payout, wildCount: 0, progressive: false }]
            : [],
          totalPayout: payout,
          progressiveEvents: [],
          featureEvents: [{ type: 'bust-saved', voidedCard }, { type: 'charlie', cards: [...bj.cards] }],
          trace: { draws: [] }
        }
      }

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
