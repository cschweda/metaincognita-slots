// Lucky 21 — deck-depletion exact-RTP dynamic program (optimal stopping).
//
// Backward induction over the hand's Markovian sufficient statistic yields both
// the optimal cash/continue policy AND the exact return-to-player under it.
//
// ── Why the state is what it is ────────────────────────────────────────────
// Five reels are stopped left-to-right. A STOP is a uniform draw over the
// reel's dealt strip (`stopReel` in blackjackReel.ts). Cards are dealt from one
// shuffled 52-deck WITHOUT replacement, so by shuffle symmetry the landed cards
// across the card-slots are equivalent to dealing one card per slot from a
// depleting deck. The DP therefore tracks the remaining deck collapsed to
// counts BY BLACKJACK VALUE:
//
//   deck = { ace:4, v2:4, … v9:4, ten:16 }   (ten = T/J/Q/K aggregated)
//
// At most five cards are ever drawn, so the reachable deck states are bounded →
// exact enumeration (no Monte-Carlo, no second RNG).
//
//   reel      = index of the NEXT reel to stop (0..5); decision nodes 0..4
//   hard      = sum of value cards + 1 per ace, after minus subtractions (≥0)
//   aces      = aces held (one may promote to 11)
//   multSum   = additive multiplier face sum
//   bestTotal = high-water best total ≤ 21 reached (drives the payout)
//   natural   = a 2-card 21 was reached (reel index 1)
//   deck      = the value-count vector above
//
// ── Per-reel outcome distribution at reel r given remaining deck D ──────────
//   len = reels[r].length, cardSlots = count('CARD'), S = Σ D
//   • each special token x lands with prob count(x in reels[r]) / len
//   • a card lands with prob cardSlots / len, and GIVEN a card it has value v
//     with prob D[v] / S (drawing v decrements D[v])
//   (specials + cardSlots = len, and Σ_v D[v]/S = 1, so the masses sum to 1.)
//
// ── Transitions (mirror stopReel / applySymbol EXACTLY) ─────────────────────
//   • bustSymbol         → terminal payout 0
//   • multiplier face m  → multSum += m, advance reel (total unchanged)
//   • minus n            → hard = max(0, hard − n), advance reel (can't bust)
//   • card value v       → ace: aces++,hard+=1; else hard+=v. total = bestTotal.
//                          if total>21 → terminal 0; else ratchet bestTotal,
//                          set natural if reel===1 && total===21, decrement
//                          deck[v], advance reel.
//   After advancing, reel===5 (survived all five) → TERMINAL Five-Card Charlie.
//
// ── Values (per coin, ante = 1) ─────────────────────────────────────────────
//   cashValue(s)     = handPayout(def, {…s, charlie:false, busted:false})  (no Charlie)
//   charlieValue(s)  = handPayout(def, {…s, charlie:true,  busted:false})  (5th-reel survival)
//   decision value   = max(cashValue(s), continueEV(s)), cash winning ties
//   continueEV(s)    = Σ outcomes p · value(next); bust outcomes contribute 0
//   rtpPerCoin       = value(initial = reel 0, empty hand, full 52-deck)
//
// Terminal AND cash values are computed by constructing a BlackjackReelSessionState
// and calling the REAL handPayout — the single source of truth — so the DP and
// the live engine cannot diverge.

import type { ExactRtpBreakdownEntry, ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { BlackjackReelMachineDef, BlackjackReelSessionState, SymbolId } from './types'
import { bestTotal, freshBlackjackState, handPayout } from './blackjackReel'
import { cardValue, isAce } from './deck'

const MAX_REELS = 5

// ---------- deck (value-count vector) ----------

// Fixed bucket order: ace, 2..9, ten. Index 0 = ace, 1..8 = values 2..9, 9 = ten.
type Deck = number[]

const TEN_INDEX = 9

/** A full 52-card deck collapsed to value counts: ace 4, 2..9 four each, ten 16. */
function fullDeck(): Deck {
  return [4, 4, 4, 4, 4, 4, 4, 4, 4, 16]
}

/** Map a card SymbolId to its deck bucket index (ace 0, 2..9 → 1..8, ten 9). */
function deckIndex(card: SymbolId): number {
  if (isAce(card)) return 0
  const v = cardValue(card) // 2..10
  return v === 10 ? TEN_INDEX : v - 1
}

/** The blackjack value a bucket index represents (ace 11, ten 10, else index+1). */
function bucketValue(i: number): number {
  if (i === 0) return 11
  if (i === TEN_INDEX) return 10
  return i + 1
}

function sumDeck(d: Deck): number {
  let s = 0
  for (const n of d) s += n
  return s
}

// ---------- DP state ----------

interface DpState {
  reel: number
  hard: number
  aces: number
  multSum: number
  bestTotal: number
  natural: boolean
  deck: Deck
}

interface Solution {
  value: number
  action: 'cash' | 'continue'
}

/** A discrete outcome distribution: payout-per-coin → probability. */
type OutcomeDist = Map<number, number>

function stateKey(s: DpState): string {
  return `${s.reel}|${s.hard}|${s.aces}|${s.multSum}|${s.bestTotal}|${s.natural ? 1 : 0}|${s.deck.join(',')}`
}

/**
 * Reuse the live handPayout as the single source of truth for terminal and cash
 * values. Builds a resolved BlackjackReelSessionState carrying only the fields
 * handPayout reads (busted/multSum/charlie/bestTotal/natural/ante), ante = 1.
 */
function payoutOf(
  def: BlackjackReelMachineDef,
  s: DpState,
  charlie: boolean
): number {
  const bj: BlackjackReelSessionState = {
    ...freshBlackjackState(),
    phase: 'resolved',
    multSum: s.multSum,
    bestTotal: s.bestTotal,
    natural: s.natural,
    charlie,
    busted: false,
    ante: 1
  }
  return handPayout(def, bj)
}

/** Value of cashing now: the real handPayout with charlie = false. */
function cashValue(def: BlackjackReelMachineDef, s: DpState): number {
  return payoutOf(def, s, false)
}

/** Value of surviving all five reels: the real handPayout with charlie = true. */
function charlieValue(def: BlackjackReelMachineDef, s: DpState): number {
  return payoutOf(def, s, true)
}

// ---------- per-reel outcome enumeration ----------

interface SpecialOutcome {
  kind: 'mult' | 'minus' | 'bust'
  amount: number // additive face (mult) or points removed (minus); 0 for bust
  p: number
}

interface ReelOutcomes {
  specials: SpecialOutcome[]
  /** total probability mass on the card branch (cardSlots / len) */
  cardMass: number
}

/**
 * Special-token probabilities for reel r (count / len), classified by role.
 * Independent of the deck, so memoizable per reel index.
 */
function reelSpecials(def: BlackjackReelMachineDef, r: number): ReelOutcomes {
  const strip = def.reels[r]!
  const len = strip.length
  const counts = new Map<SymbolId, number>()
  let cardSlots = 0
  for (const tok of strip) {
    if (tok === 'CARD') {
      cardSlots++
    } else {
      counts.set(tok, (counts.get(tok) ?? 0) + 1)
    }
  }
  const specials: SpecialOutcome[] = []
  for (const [sym, n] of counts) {
    const p = n / len
    if (sym === def.bustSymbol) {
      specials.push({ kind: 'bust', amount: 0, p })
    } else if (sym in def.multiplierSymbols) {
      specials.push({ kind: 'mult', amount: def.multiplierSymbols[sym]!, p })
    } else if (sym in def.minusSymbols) {
      specials.push({ kind: 'minus', amount: def.minusSymbols[sym]!, p })
    } else {
      // Unknown special: treat as a no-op token that simply advances (mirrors
      // applySymbol falling through to a 0-value card add). Validation rejects
      // these defs, but model it harmlessly rather than dropping its mass.
      specials.push({ kind: 'minus', amount: 0, p })
    }
  }
  return { specials, cardMass: cardSlots / len }
}

// ---------- solver ----------

interface BreakdownSlot {
  p: number
  ev: number
}

/**
 * Solve a def: memoized backward induction returning, per state, the optimal
 * action + value; plus a memoized terminal-payout distribution and a labelled
 * breakdown — all sharing the SAME policy so RTP, hit frequency, variance and
 * the breakdown describe one consistent strategy.
 */
function makeSolver(def: BlackjackReelMachineDef) {
  const memoSolve = new Map<string, Solution>()
  const memoDist = new Map<string, OutcomeDist>()
  const memoLabelled = new Map<string, Map<string, BreakdownSlot>>()
  const specialCache = new Map<number, ReelOutcomes>()

  const specialsFor = (r: number): ReelOutcomes => {
    let o = specialCache.get(r)
    if (o === undefined) {
      o = reelSpecials(def, r)
      specialCache.set(r, o)
    }
    return o
  }

  /**
   * State reached after applying a SPECIAL at reel s.reel (no decision yet):
   *  null  → the bust symbol (terminal payout 0)
   *  state → the advanced state (multiplier raised multSum, or minus lowered
   *          hard; bestTotal/natural/deck unchanged — specials never bust and
   *          never deplete the deck).
   */
  const afterSpecial = (s: DpState, o: SpecialOutcome): DpState | null => {
    if (o.kind === 'bust') return null
    const next: DpState = {
      reel: s.reel + 1,
      hard: o.kind === 'minus' ? Math.max(0, s.hard - o.amount) : s.hard,
      aces: s.aces,
      multSum: o.kind === 'mult' ? s.multSum + o.amount : s.multSum,
      bestTotal: s.bestTotal,
      natural: s.natural,
      deck: s.deck
    }
    return next
  }

  /**
   * State reached after drawing the card in bucket `bi` at reel s.reel:
   *  null  → over-21 (terminal payout 0)
   *  state → the advanced, ratcheted state with deck[bi] decremented.
   */
  const afterCard = (s: DpState, bi: number): DpState | null => {
    const ace = bi === 0
    const hard = s.hard + (ace ? 1 : bucketValue(bi))
    const aces = s.aces + (ace ? 1 : 0)
    const { total } = bestTotal(hard, aces)
    if (total > 21) return null // over-21 bust
    const deck = s.deck.slice()
    deck[bi]!--
    return {
      reel: s.reel + 1,
      hard,
      aces,
      multSum: s.multSum,
      bestTotal: Math.max(s.bestTotal, total),
      // natural fires when stopping reel index 1 (the second reel) to 21.
      natural: s.natural || (s.reel === 1 && total === 21),
      deck
    }
  }

  const solve = (s: DpState): Solution => {
    const key = stateKey(s)
    const hit = memoSolve.get(key)
    if (hit !== undefined) return hit

    let result: Solution
    if (s.reel >= MAX_REELS) {
      // Survived all five reels: forced Five-Card Charlie resolution.
      result = { value: charlieValue(def, s), action: 'cash' }
    } else {
      const cash = cashValue(def, s)
      const cont = continueEV(s)
      // Tiebreak: prefer CASH on ties (lock the value; the conventional safe
      // choice and never higher variance). The dist/labelled passes match it.
      result = cont > cash
        ? { value: cont, action: 'continue' }
        : { value: cash, action: 'cash' }
    }
    memoSolve.set(key, result)
    return result
  }

  /** Σ over the reel's outcomes of p · value(next); bust outcomes contribute 0. */
  const continueEV = (s: DpState): number => {
    const { specials, cardMass } = specialsFor(s.reel)
    let ev = 0
    for (const o of specials) {
      const next = afterSpecial(s, o)
      ev += o.p * (next === null ? 0 : solve(next).value)
    }
    if (cardMass > 0) {
      const S = sumDeck(s.deck)
      if (S > 0) {
        for (let bi = 0; bi < s.deck.length; bi++) {
          const n = s.deck[bi]!
          if (n === 0) continue
          const p = cardMass * (n / S)
          const next = afterCard(s, bi)
          ev += p * (next === null ? 0 : solve(next).value)
        }
      }
    }
    return ev
  }

  const addOutcome = (dist: OutcomeDist, payout: number, p: number): void => {
    dist.set(payout, (dist.get(payout) ?? 0) + p)
  }

  /** The terminal payout distribution from `s` under the optimal policy. */
  const dist = (s: DpState): OutcomeDist => {
    const key = stateKey(s)
    const hit = memoDist.get(key)
    if (hit !== undefined) return hit

    const out: OutcomeDist = new Map()
    if (s.reel >= MAX_REELS) {
      addOutcome(out, charlieValue(def, s), 1)
    } else if (solve(s).action === 'cash') {
      addOutcome(out, cashValue(def, s), 1)
    } else {
      const { specials, cardMass } = specialsFor(s.reel)
      for (const o of specials) {
        const next = afterSpecial(s, o)
        if (next === null) addOutcome(out, 0, o.p)
        else for (const [payout, q] of dist(next)) addOutcome(out, payout, o.p * q)
      }
      if (cardMass > 0) {
        const S = sumDeck(s.deck)
        for (let bi = 0; bi < s.deck.length; bi++) {
          const n = s.deck[bi]!
          if (n === 0) continue
          const p = cardMass * (n / S)
          const next = afterCard(s, bi)
          if (next === null) addOutcome(out, 0, p)
          else for (const [payout, q] of dist(next)) addOutcome(out, payout, p * q)
        }
      }
    }
    memoDist.set(key, out)
    return out
  }

  /**
   * Labelled terminal distribution: probability + EV bucketed by outcome id
   * (`total-<N>` for a cash resolving at total N, `charlie`, `bust`). Mirrors
   * the optimal policy exactly. Memoized per state.
   */
  const labelled = (s: DpState): Map<string, BreakdownSlot> => {
    const key = stateKey(s)
    const hit = memoLabelled.get(key)
    if (hit !== undefined) return hit

    const out = new Map<string, BreakdownSlot>()
    const put = (id: string, p: number, ev: number): void => {
      const slot = out.get(id) ?? { p: 0, ev: 0 }
      slot.p += p
      slot.ev += ev
      out.set(id, slot)
    }
    if (s.reel >= MAX_REELS) {
      put('charlie', 1, charlieValue(def, s))
    } else if (solve(s).action === 'cash') {
      put(`total-${s.bestTotal}`, 1, cashValue(def, s))
    } else {
      const { specials, cardMass } = specialsFor(s.reel)
      for (const o of specials) {
        const next = afterSpecial(s, o)
        if (next === null) put('bust', o.p, 0)
        else for (const [id, sub] of labelled(next)) put(id, o.p * sub.p, o.p * sub.ev)
      }
      if (cardMass > 0) {
        const S = sumDeck(s.deck)
        for (let bi = 0; bi < s.deck.length; bi++) {
          const n = s.deck[bi]!
          if (n === 0) continue
          const p = cardMass * (n / S)
          const next = afterCard(s, bi)
          if (next === null) put('bust', p, 0)
          else for (const [id, sub] of labelled(next)) put(id, p * sub.p, p * sub.ev)
        }
      }
    }
    memoLabelled.set(key, out)
    return out
  }

  return { solve, dist, labelled, continueEV, cashValue: (s: DpState) => cashValue(def, s) }
}

/** The initial state: reel 0, empty hand, full 52-deck. */
function initialState(): DpState {
  return { reel: 0, hard: 0, aces: 0, multSum: 0, bestTotal: 0, natural: false, deck: fullDeck() }
}

/**
 * Map a live session state onto a DP state. The numeric hand fields are copied
 * directly from the live state (already maintained by stopReel via the same
 * applySymbol/bestTotal primitives); the deck is the full 52 counts MINUS the
 * value-cards already in bj.hand (specials/minus never deplete the deck).
 */
function summarize(def: BlackjackReelMachineDef, bj: BlackjackReelSessionState): DpState {
  const deck = fullDeck()
  for (const sym of bj.hand) {
    if (sym === def.bustSymbol) continue
    if (sym in def.multiplierSymbols || sym in def.minusSymbols) continue
    deck[deckIndex(sym)]!--
  }
  return {
    reel: bj.idx,
    hard: bj.hard,
    aces: bj.aces,
    multSum: bj.multSum,
    bestTotal: bj.bestTotal,
    natural: bj.natural,
    deck
  }
}

// ---------- public API ----------

/**
 * The optimal cash/continue decision at a live decision state. Accepts the live
 * BlackjackReelSessionState directly (mapped to a DP state via summarize). At a
 * forced 5th-reel state there is no decision; the DP returns 'cash' there.
 */
export function optimalStop(
  def: BlackjackReelMachineDef,
  bj: BlackjackReelSessionState
): 'cash' | 'continue' {
  const { solve } = makeSolver(def)
  return solve(summarize(def, bj)).action
}

/**
 * EV of continuing vs. cashing at the current decision point, plus the optimal
 * action — the live X-ray surface ("the casino never shows you this").
 *
 * Returns null when not in a decision state (phase !== 'spinning' or already at
 * the forced 5th reel, bj.idx >= 5).
 */
export function decisionEvs(
  def: BlackjackReelMachineDef,
  bj: BlackjackReelSessionState
): { evCash: number, evContinue: number, action: 'cash' | 'continue' } | null {
  if (bj.phase !== 'spinning' || bj.idx >= MAX_REELS) return null
  const { continueEV, cashValue } = makeSolver(def)
  const s = summarize(def, bj)
  const evCash = cashValue(s)
  const evContinue = continueEV(s)
  return { evCash, evContinue, action: evContinue > evCash ? 'continue' : 'cash' }
}

/**
 * PAR-sheet strategy-matrix helper: the optimal action for a HARD hand of
 * `total` (no aces) at decision `reel`, under the FULL 52-deck assumption
 * (deterministic and documented — the live, deck-aware per-hand surface is
 * decisionEvs). Built on the same solver, so it can never contradict it.
 */
export function strategyMatrixCell(
  def: BlackjackReelMachineDef,
  total: number,
  reel: number,
  opts: { multSum?: number } = {}
): 'cash' | 'continue' {
  const { solve } = makeSolver(def)
  const s: DpState = {
    reel,
    hard: total, // no aces → hard === best total
    aces: 0,
    multSum: opts.multSum ?? 0,
    bestTotal: total,
    natural: false,
    deck: fullDeck()
  }
  return solve(s).action
}

/**
 * Exact RTP, hit frequency, and variance for a Lucky 21 machine under optimal
 * stopping. Enumerates the full state tree from the initial node (reel 0, empty
 * hand, full deck); the reachable deck states are bounded (≤ 5 draws) so this is
 * exact — no Monte-Carlo.
 *
 * rtpPerCoin = E[payout] (ante = 1) = value(initial); hitFrequency =
 * P(resolved payout > 0); variancePerCoin = Var(payout) over the optimal-play
 * terminal distribution. The breakdown buckets resolutions by total / charlie /
 * bust; contributions sum to rtpPerCoin.
 */
export function blackjackReelExactRtp(
  def: BlackjackReelMachineDef,
  _opts: ExactRtpOptions = {}
): ExactRtpReport {
  if (def.reels.length !== MAX_REELS) {
    throw new Error(`${def.id}: blackjack-reel needs exactly ${MAX_REELS} reels`)
  }
  const solver = makeSolver(def)
  const init = initialState()

  // Terminal-payout distribution under the optimal policy from the initial node.
  const global = solver.dist(init)

  let mean = 0
  let m2 = 0
  let hitFrequency = 0
  for (const [payout, p] of global) {
    mean += p * payout
    m2 += p * payout * payout
    if (payout > 0) hitFrequency += p
  }
  const rtpPerCoin = mean
  const variancePerCoin = m2 - mean * mean

  // Breakdown: labelled probability + EV mass from the initial node.
  const buckets = solver.labelled(init)
  const breakdown: ExactRtpBreakdownEntry[] = [...buckets.entries()]
    .map(([entryId, v]) => ({
      entryId,
      probability: v.p,
      avgPayPerCoin: v.p > 0 ? v.ev / v.p : 0,
      contribution: v.ev
    }))
    .filter(e => e.probability > 0)
    .sort((a, b) => b.contribution - a.contribution)

  return { rtpPerCoin, hitFrequency, variancePerCoin, breakdown }
}
