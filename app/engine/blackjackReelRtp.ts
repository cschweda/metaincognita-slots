import type { ExactRtpBreakdownEntry, ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { BlackjackReelMachineDef, BlackjackReelSessionState, SymbolId } from './types'
import { applyCard, bestTotal, freshAcc, payEntry } from './blackjackReel'

/**
 * Optimal-stopping dynamic program for the blackjack-reel family.
 *
 * Backward induction over the hand's Markovian sufficient statistic yields both
 * the optimal hit/stand policy and the EXACT return-to-player under it.
 *
 * ── Why the state is what it is ────────────────────────────────────────────
 * The live engine (`hitCard` in blackjackReel.ts) draws the next card from
 * `strips[cards.length]` and, on a bust-save, replaces the busting card IN PLACE
 * with a VOID sentinel — so `cards.length` INCREASES by 1 (as with any hit) and
 * the reel index always advances monotonically. The DP mirrors this exactly: on a
 * saved bust, handSize increments (the slot is consumed) while saveCount decrements.
 *
 *   handSize  = number of symbols currently in hand = the next reel index
 *   hard      = sum of value cards + 1 per ace
 *   aces      = aces held (one may promote to 11)
 *   multSum   = additive multiplier face sum
 *   saveCount = unspent bust-save symbols held
 *
 * Cards are folded in with the SAME `applyCard`/`bestTotal` primitives
 * `evaluateHand` uses, so the DP and the live engine cannot diverge.
 *
 * ── The recursion (EV per coin, ante = 1) ──────────────────────────────────
 *   standEV(s)  = payEntry(total) × max(1, multSum)
 *   charlieEV(s)= (payEntry(total) + charlieBonus) × max(1, multSum)   (handSize 5)
 *   hitEV(s)    = Σ over distinct symbols c on strips[handSize] of
 *                   p(c) × valueAfterDraw(s, c)         (only if handSize < 5)
 *   value(s)    = handSize < 5 ? max(standEV, hitEV) : charlieEV
 *
 *   valueAfterDraw(s, c): fold c in.
 *     • busts, save held → void the card in-place (handSize+1, saveCount−1,
 *       value/ace contribution reverted to pre-draw); recurse.
 *     • busts, no save   → 0.
 *     • otherwise        → recurse on the grown state.
 *
 * Memoized by a state key; the reachable state space is tiny (handSize ≤ 5).
 */

interface DpState {
  handSize: number
  hard: number
  aces: number
  multSum: number
  saveCount: number
}

interface Solution {
  value: number
  action: 'hit' | 'stand'
}

/** A discrete outcome distribution: payout-per-coin → probability. */
type OutcomeDist = Map<number, number>

const MAX_REELS = 5

function stateKey(s: DpState): string {
  return `${s.handSize}|${s.hard}|${s.aces}|${s.multSum}|${s.saveCount}`
}

/** Per-symbol probabilities on reel r: count(symbol) / strip length. */
function reelProbs(def: BlackjackReelMachineDef, r: number): Map<SymbolId, number> {
  const strip = def.strips[r]!
  const counts = new Map<SymbolId, number>()
  for (const sym of strip) counts.set(sym, (counts.get(sym) ?? 0) + 1)
  const probs = new Map<SymbolId, number>()
  for (const [sym, n] of counts) probs.set(sym, n / strip.length)
  return probs
}

/** payEntry(total) × max(1, multSum); the value of standing now. */
function standEV(def: BlackjackReelMachineDef, s: DpState): number {
  const { total } = bestTotal(s.hard, s.aces)
  return payEntry(def.paytable, total) * Math.max(1, s.multSum)
}

/** (payEntry(total) + charlieBonus) × max(1, multSum); a forced 5-card stand. */
function charlieEV(def: BlackjackReelMachineDef, s: DpState): number {
  const { total } = bestTotal(s.hard, s.aces)
  return (payEntry(def.paytable, total) + def.charlieBonus) * Math.max(1, s.multSum)
}

/**
 * Engine that solves a def: memoized backward induction returning, per state,
 * the optimal action and its value. `dist` reuses the SAME memoized policy so
 * the RTP, hit frequency, and variance all describe one consistent strategy.
 */
function makeSolver(def: BlackjackReelMachineDef) {
  const memoSolve = new Map<string, Solution>()
  const memoDist = new Map<string, OutcomeDist>()
  const probCache = new Map<number, Map<SymbolId, number>>()

  const probsFor = (r: number): Map<SymbolId, number> => {
    let p = probCache.get(r)
    if (p === undefined) {
      p = reelProbs(def, r)
      probCache.set(r, p)
    }
    return p
  }

  /**
   * State reached after drawing `card` into `s` (no decision yet):
   *  null  → the draw busts with no save (terminal payout 0)
   *  state → the (non-busted) state to recurse on; on a save-consume this is
   *          the post-void state: the slot is consumed (handSize+1) but the
   *          busting card's value/ace contribution is reverted, saveCount−1.
   */
  const afterDraw = (s: DpState, card: SymbolId): DpState | null => {
    const acc = { hard: s.hard, aces: s.aces, multSum: s.multSum, saveCount: s.saveCount }
    applyCard(acc, def, card)
    const { total } = bestTotal(acc.hard, acc.aces)
    if (total > 21) {
      if (s.saveCount > 0) {
        // Bust-Save void-in-place: the slot is consumed (handSize advances) but
        // the busting card's value/ace contribution is reverted. multSum is
        // unchanged (only value cards can bust). saveCount decrements.
        return {
          handSize: s.handSize + 1,
          hard: s.hard,
          aces: s.aces,
          multSum: s.multSum,
          saveCount: s.saveCount - 1
        }
      }
      return null // bust, no save
    }
    return {
      handSize: s.handSize + 1,
      hard: acc.hard,
      aces: acc.aces,
      multSum: acc.multSum,
      saveCount: acc.saveCount
    }
  }

  const solve = (s: DpState): Solution => {
    const key = stateKey(s)
    const hit = memoSolve.get(key)
    if (hit !== undefined) return hit

    let result: Solution
    if (s.handSize >= MAX_REELS) {
      // Reached five cards without busting: forced stand + Five-Card Charlie.
      result = { value: charlieEV(def, s), action: 'stand' }
    } else {
      const stand = standEV(def, s)
      const probs = probsFor(s.handSize)
      let hitEV = 0
      for (const [card, p] of probs) {
        const next = afterDraw(s, card)
        hitEV += p * (next === null ? 0 : solve(next).value)
      }
      // Tiebreak: prefer STAND on ties (never higher variance; the
      // conventional safe choice). The distribution pass uses this same rule.
      result = hitEV > stand
        ? { value: hitEV, action: 'hit' }
        : { value: stand, action: 'stand' }
    }
    memoSolve.set(key, result)
    return result
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
    if (s.handSize >= MAX_REELS) {
      addOutcome(out, charlieEV(def, s), 1)
    } else if (solve(s).action === 'stand') {
      addOutcome(out, standEV(def, s), 1)
    } else {
      const probs = probsFor(s.handSize)
      for (const [card, p] of probs) {
        const next = afterDraw(s, card)
        if (next === null) {
          addOutcome(out, 0, p) // bust, no save
        } else {
          for (const [payout, q] of dist(next)) addOutcome(out, payout, p * q)
        }
      }
    }
    memoDist.set(key, out)
    return out
  }

  return { solve, dist, afterDraw, probsFor }
}

/**
 * Map a live session state onto the DP's summary state via shared primitives.
 *
 * saveCount is taken from bj.saveHeld (the explicit state flag) rather than
 * re-derived from the cards array. After a bust-save void-in-place the SAVE
 * card remains in bj.cards but saveHeld is false (save consumed), so counting
 * cards would give saveCount=1 incorrectly.
 */
function summarize(def: BlackjackReelMachineDef, bj: BlackjackReelSessionState): DpState {
  const acc = freshAcc()
  for (const c of bj.cards) applyCard(acc, def, c)
  return {
    handSize: bj.cards.length,
    hard: acc.hard,
    aces: acc.aces,
    multSum: acc.multSum,
    // Use the explicit saveHeld flag, not acc.saveCount derived from cards.
    // A SAVE card left in cards after consumption must not re-grant the mechanic.
    saveCount: bj.saveHeld ? 1 : 0
  }
}

/**
 * The optimal hit/stand decision at a live decision state. Accepts the live
 * `BlackjackReelSessionState` directly (mapped to the DP's summary state).
 */
export function optimalAction(
  def: BlackjackReelMachineDef,
  partialState: BlackjackReelSessionState
): 'hit' | 'stand' {
  const { solve } = makeSolver(def)
  return solve(summarize(def, partialState)).action
}

/**
 * PAR sheet strategy matrix helper: the optimal action for a hard hand of
 * `hardTotal` at `numCards` cards (no aces, no multipliers, no save held).
 *
 * Constructs the DP state directly from the numeric parameters — no card
 * fabrication needed — so the result is guaranteed to match `optimalAction`
 * for any equivalent live session state with the same (handSize, hard) tuple.
 *
 * This is the single source of truth for every cell of the PAR sheet's
 * card-count × total matrix, which ensures the table can never contradict
 * the live X-ray.
 */
export function strategyMatrixCell(
  def: BlackjackReelMachineDef,
  hardTotal: number,
  numCards: number,
  opts: { saveHeld?: boolean, multSum?: number } = {}
): 'hit' | 'stand' {
  const { solve } = makeSolver(def)
  const s: DpState = {
    handSize: numCards,
    hard: hardTotal, // no aces → hard === best total
    aces: 0,
    multSum: opts.multSum ?? 0,
    saveCount: opts.saveHeld ? 1 : 0
  }
  return solve(s).action
}

/**
 * EV of hitting vs. standing at the current decision point, plus the optimal
 * action. Useful for the X-ray panel: "the casino never shows you this."
 *
 * Returns null when the hand is not in a decision state (phase !== 'dealt' or
 * already at 5 cards / forced stand).
 */
export function decisionEvs(
  def: BlackjackReelMachineDef,
  partialState: BlackjackReelSessionState
): { evHit: number, evStand: number, action: 'hit' | 'stand' } | null {
  if (partialState.phase !== 'dealt') return null
  const s = summarize(def, partialState)
  if (s.handSize >= MAX_REELS) return null // forced charlie — no decision
  const { solve, afterDraw, probsFor } = makeSolver(def)
  const evStand = standEV(def, s)
  const probs = probsFor(s.handSize)
  let evHit = 0
  for (const [card, p] of probs) {
    const next = afterDraw(s, card)
    evHit += p * (next === null ? 0 : solve(next).value)
  }
  const action = evHit > evStand ? 'hit' : 'stand'
  return { evHit, evStand, action }
}

/**
 * Exact RTP, hit frequency, and variance for a blackjack-reel machine under
 * optimal stopping. Enumerates the two-card deal (strips 0 × 1); for each deal
 * runs the DP for the post-deal value and outcome distribution under the
 * optimal policy, then averages.
 *
 * `rtpPerCoin = E[payout]` (ante = 1) = EV(initial); `hitFrequency` =
 * P(resolved payout > 0); `variancePerCoin` = Var(payout) (per-coin ≡ per-unit
 * at ante 1). The breakdown buckets resolved hands by total / charlie / bust.
 */
export function blackjackReelExactRtp(
  def: BlackjackReelMachineDef,
  _opts: ExactRtpOptions = {}
): ExactRtpReport {
  if (def.strips.length !== MAX_REELS) {
    throw new Error(`${def.id}: blackjack-reel needs exactly ${MAX_REELS} strips`)
  }
  const { dist } = makeSolver(def)
  const deal0 = reelProbs(def, 0)
  const deal1 = reelProbs(def, 1)

  // Global terminal-payout distribution, averaged over every two-card deal.
  const global: OutcomeDist = new Map()
  for (const [c0, p0] of deal0) {
    for (const [c1, p1] of deal1) {
      const acc = freshAcc()
      applyCard(acc, def, c0)
      applyCard(acc, def, c1)
      const initial: DpState = {
        handSize: 2,
        hard: acc.hard,
        aces: acc.aces,
        multSum: acc.multSum,
        saveCount: acc.saveCount
      }
      const w = p0 * p1
      for (const [payout, q] of dist(initial)) {
        global.set(payout, (global.get(payout) ?? 0) + w * q)
      }
    }
  }

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

  // Breakdown: bucket the deal-weighted resolved hands by outcome label.
  const buckets = makeBreakdown(def)
  const breakdown: ExactRtpBreakdownEntry[] = [...buckets.entries()]
    .map(([entryId, v]) => ({
      entryId,
      probability: v.pSum,
      avgPayPerCoin: v.pSum > 0 ? v.evSum / v.pSum : 0,
      contribution: v.evSum
    }))
    .filter(e => e.probability > 0)
    .sort((a, b) => b.contribution - a.contribution)

  return { rtpPerCoin, hitFrequency, variancePerCoin, breakdown }
}

/**
 * Deal-weighted probability and EV per outcome label (`total-<N>` for a stand
 * resolving at total N, `charlie` for a five-card survival, `bust` for a wipe).
 * Contributions sum to rtpPerCoin.
 */
function makeBreakdown(def: BlackjackReelMachineDef): Map<string, { pSum: number, evSum: number }> {
  const { solve, afterDraw, probsFor } = makeSolver(def)
  const buckets = new Map<string, { pSum: number, evSum: number }>()
  const add = (id: string, p: number, ev: number): void => {
    const slot = buckets.get(id) ?? { pSum: 0, evSum: 0 }
    slot.pSum += p
    slot.evSum += ev
    buckets.set(id, slot)
  }

  // Walk every reachable resolution under the optimal policy, accumulating
  // labelled probability mass. Memoize the per-state labelled distribution.
  const memo = new Map<string, Map<string, { p: number, ev: number }>>()
  const labelled = (s: DpState): Map<string, { p: number, ev: number }> => {
    const key = stateKey(s)
    const hitC = memo.get(key)
    if (hitC !== undefined) return hitC

    const out = new Map<string, { p: number, ev: number }>()
    const put = (id: string, p: number, ev: number): void => {
      const slot = out.get(id) ?? { p: 0, ev: 0 }
      slot.p += p
      slot.ev += ev
      out.set(id, slot)
    }
    if (s.handSize >= MAX_REELS) {
      put('charlie', 1, charlieEV(def, s))
    } else if (solve(s).action === 'stand') {
      const { total } = bestTotal(s.hard, s.aces)
      put(`total-${total}`, 1, standEV(def, s))
    } else {
      const probs = probsFor(s.handSize)
      for (const [card, p] of probs) {
        const next = afterDraw(s, card)
        if (next === null) {
          put('bust', p, 0)
        } else {
          for (const [id, sub] of labelled(next)) put(id, p * sub.p, p * sub.ev)
        }
      }
    }
    memo.set(key, out)
    return out
  }

  const deal0 = reelProbs(def, 0)
  const deal1 = reelProbs(def, 1)
  for (const [c0, p0] of deal0) {
    for (const [c1, p1] of deal1) {
      const acc = freshAcc()
      applyCard(acc, def, c0)
      applyCard(acc, def, c1)
      const initial: DpState = {
        handSize: 2, hard: acc.hard, aces: acc.aces, multSum: acc.multSum, saveCount: acc.saveCount
      }
      const w = p0 * p1
      for (const [id, sub] of labelled(initial)) add(id, w * sub.p, w * sub.ev)
    }
  }
  return buckets
}
