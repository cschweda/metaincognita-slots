// Flameout 21 — exact-RTP dynamic program (crash model, optimal cash/climb).
//
// The hand is dealt from one shuffled 52-deck (reels 0–1, no replacement); by
// shuffle symmetry that equals dealing one card per slot from a depleting deck,
// so the 2-card deal distribution is an exact enumeration over deck VALUE counts
// (ace, 2..9, ten). The 2-card total fixes the LAUNCH multiplier and the climb
// VELOCITY. Reels 2–4 are independent uniform strip draws: CLIMB (× velocity) or
// CRASH (0), with per-reel crash probability count(CRASH)/len. Because the climb
// value is linear in the multiplier, the optimal cash/climb policy is closed-form
// per (reel, velocity): climb iff pClimb · velocity · c[next] > 1.

import type { ExactRtpOptions, ExactRtpReport, ExactRtpBreakdownEntry } from './exactRtp'
import type { BlackjackReelMachineDef, BlackjackReelSessionState } from './types'
import { launchFor, velocityFor } from './blackjackReel'

const DEAL_REELS = 2
const TOTAL_REELS = 5
const TEN_INDEX = 9

type Deck = number[]
function fullDeck(): Deck {
  return [4, 4, 4, 4, 4, 4, 4, 4, 4, 16]
}
function bucketValue(i: number): number {
  return i === 0 ? 11 : i === TEN_INDEX ? 10 : i + 1
}
function bucketIsAce(i: number): boolean {
  return i === 0
}

/** 2-card best total from two deck buckets (one ace promoted to 11 if it fits). */
function twoCardTotal(a: number, b: number): number {
  let hard = 0
  let aces = 0
  for (const i of [a, b]) {
    if (bucketIsAce(i)) {
      aces += 1
      hard += 1
    } else {
      hard += bucketValue(i)
    }
  }
  return aces > 0 && hard + 10 <= 21 ? hard + 10 : hard
}

/** Per-climb-reel crash probabilities, index 0 -> reel 2, 1 -> reel 3, 2 -> reel 4. */
function crashProbs(def: BlackjackReelMachineDef): number[] {
  const ps: number[] = []
  for (let r = DEAL_REELS; r < TOTAL_REELS; r++) {
    const strip = def.reels[r]!
    const crashes = strip.filter(s => s === def.crashSymbol).length
    ps.push(crashes / strip.length)
  }
  return ps
}

/**
 * Value-multiple per climb reel for a given velocity. Returns [c2, c3, c4, 1]
 * where c[k] = max(1, pClimb[k] · velocity · c[k+1]); the trailing 1 is the
 * topped-out terminal at reel 5.
 */
function climbMultiples(pCrash: number[], velocity: number): number[] {
  const c = [0, 0, 0, 1]
  for (let k = 2; k >= 0; k--) {
    const pClimb = 1 - pCrash[k]!
    c[k] = Math.max(1, pClimb * velocity * c[k + 1]!)
  }
  return c
}

interface HandStat { p: number, launch: number, velocity: number }

/** The 2-card deal distribution: probability, launch, velocity per ordered draw. */
function dealDistribution(def: BlackjackReelMachineDef): HandStat[] {
  const deck = fullDeck()
  const N = 52
  const hands: HandStat[] = []
  for (let a = 0; a < deck.length; a++) {
    if (deck[a]! === 0) continue
    const pa = deck[a]! / N
    for (let b = 0; b < deck.length; b++) {
      const remaining = a === b ? deck[b]! - 1 : deck[b]!
      if (remaining === 0) continue
      const p = pa * (remaining / (N - 1))
      const total = twoCardTotal(a, b)
      const natural = total === 21
      hands.push({
        p,
        launch: natural ? def.naturalLaunch : launchFor(def, total),
        velocity: velocityFor(def, total)
      })
    }
  }
  return hands
}

/**
 * Exact RTP, hit frequency, variance, and a labelled breakdown under optimal
 * cash/climb play. Enumerates the 2-card deal distribution, then walks each
 * hand through the closed-form climb policy to a terminal payout distribution.
 */
export function blackjackReelExactRtp(
  def: BlackjackReelMachineDef,
  _opts: ExactRtpOptions = {}
): ExactRtpReport {
  if (def.reels.length !== TOTAL_REELS) {
    throw new Error(`${def.id}: blackjack-reel needs exactly ${TOTAL_REELS} reels`)
  }
  const pCrash = crashProbs(def)
  const hands = dealDistribution(def)

  const dist = new Map<number, number>()
  const buckets = new Map<string, { p: number, ev: number }>()
  const add = (payout: number, p: number, id: string): void => {
    if (p <= 0) return
    dist.set(payout, (dist.get(payout) ?? 0) + p)
    const slot = buckets.get(id) ?? { p: 0, ev: 0 }
    slot.p += p
    slot.ev += p * payout
    buckets.set(id, slot)
  }

  for (const h of hands) {
    const c = climbMultiples(pCrash, h.velocity)
    let m = h.launch
    let reach = h.p
    let done = false
    for (let k = 0; k < 3; k++) {
      const pClimb = 1 - pCrash[k]!
      const climb = pClimb * h.velocity * c[k + 1]! > 1
      if (!climb) {
        add(m, reach, 'cash')
        done = true
        break
      }
      add(0, reach * pCrash[k]!, 'crash')
      reach *= pClimb
      m *= h.velocity
    }
    if (!done) add(m, reach, 'topped')
  }

  let mean = 0
  let m2 = 0
  let hitFrequency = 0
  for (const [payout, p] of dist) {
    mean += p * payout
    m2 += p * payout * payout
    if (payout > 0) hitFrequency += p
  }
  const breakdown: ExactRtpBreakdownEntry[] = [...buckets.entries()]
    .map(([entryId, v]) => ({
      entryId,
      probability: v.p,
      avgPayPerCoin: v.p > 0 ? v.ev / v.p : 0,
      contribution: v.ev
    }))
    .filter(e => e.probability > 0)
    .sort((a, b) => b.contribution - a.contribution)

  return { rtpPerCoin: mean, hitFrequency, variancePerCoin: m2 - mean * mean, breakdown }
}

// ---------- live decision surface ----------

/** Optimal cash/continue at a live decision state (reuse for the sim). */
export function makeOptimalStopFn(
  def: BlackjackReelMachineDef
): (bj: BlackjackReelSessionState) => 'cash' | 'continue' {
  const pCrash = crashProbs(def)
  return (bj) => {
    if (bj.idx < DEAL_REELS) return 'continue' // deal reels: always draw the card
    if (bj.idx >= TOTAL_REELS) return 'cash' // forced topped state (no decision)
    const k = bj.idx - DEAL_REELS
    const c = climbMultiples(pCrash, bj.velocity)
    return (1 - pCrash[k]!) * bj.velocity * c[k + 1]! > 1 ? 'continue' : 'cash'
  }
}

export function optimalStop(
  def: BlackjackReelMachineDef,
  bj: BlackjackReelSessionState
): 'cash' | 'continue' {
  return makeOptimalStopFn(def)(bj)
}

/**
 * EV (per coin, in multiplier units) of cashing now vs. pushing the next reel,
 * plus the optimal action — the live X-ray surface. Null when not at a climb
 * decision (phase !== 'spinning', or idx is a deal reel / the topped state).
 */
export function decisionEvs(
  def: BlackjackReelMachineDef,
  bj: BlackjackReelSessionState
): { evCash: number, evContinue: number, action: 'cash' | 'continue' } | null {
  if (bj.phase !== 'spinning' || bj.idx < DEAL_REELS || bj.idx >= TOTAL_REELS) return null
  const pCrash = crashProbs(def)
  const k = bj.idx - DEAL_REELS
  const c = climbMultiples(pCrash, bj.velocity)
  const evCash = bj.multiplier
  const evContinue = (1 - pCrash[k]!) * bj.velocity * c[k + 1]! * bj.multiplier
  return { evCash, evContinue, action: evContinue > evCash ? 'continue' : 'cash' }
}

/** Per-climb-reel crash probabilities (reel 3,4,5 one-indexed) for the X-ray / PAR. */
export function crashOdds(def: BlackjackReelMachineDef): number[] {
  return crashProbs(def)
}
