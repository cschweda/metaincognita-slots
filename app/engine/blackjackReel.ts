// Flameout 21 engine — a crash game on the stop-the-reels chassis.
//
// The `blackjack-reel` family now implements the Flameout 21 crash model:
// reels 0–1 deal two cards (never crash) and set a LAUNCH multiplier + a climb
// VELOCITY from the hand; reels 2–4 either CLIMB (multiplier ×= velocity) or
// CRASH (lose everything). Cash out any reel after the first card to bank
// bet × multiplier. A 2-card 21 (natural) launches to a special multiplier.

import type {
  BlackjackReelMachineDef,
  BlackjackReelSessionState,
  FeatureEvent,
  GameKind,
  MachineSessionState,
  SpinOutcome,
  SymbolId
} from './types'
import type { RandomFn } from './rng'
import { buildDeck, shuffle, cardValue, isAce } from './deck'

// ---------- launch / velocity helpers ----------

/** The mult of the entry with the greatest atLeast <= total (order-independent). */
export function tableLookup(table: { atLeast: number, mult: number }[], total: number): number {
  let mult = 1
  let bestAtLeast = -Infinity
  for (const e of table) {
    if (total >= e.atLeast && e.atLeast > bestAtLeast) {
      bestAtLeast = e.atLeast
      mult = e.mult
    }
  }
  return mult
}

export function launchFor(def: BlackjackReelMachineDef, total: number): number {
  return tableLookup(def.launchTable, total)
}

export function velocityFor(def: BlackjackReelMachineDef, total: number): number {
  return tableLookup(def.velocityTable, total)
}

/** Best blackjack total of the dealt cards: sum of values, one ace promoted 1->11 when it fits. */
export function handTotal(cards: readonly SymbolId[]): number {
  let hard = 0
  let aces = 0
  for (const c of cards) {
    if (isAce(c)) {
      aces += 1
      hard += 1
    } else {
      hard += cardValue(c)
    }
  }
  return aces > 0 && hard + 10 <= 21 ? hard + 10 : hard
}

// ---------- fresh session state ----------

export function freshBlackjackState(): BlackjackReelSessionState {
  return {
    phase: 'idle',
    reelStrips: [],
    landed: [null, null, null, null, null],
    idx: 0,
    hand: [],
    velocity: 0,
    multiplier: 1,
    crashed: false,
    natural: false,
    ante: 0
  }
}

// ---------- outcome builder ----------

function outcome(
  def: BlackjackReelMachineDef,
  bj: BlackjackReelSessionState,
  coinsIn: number,
  featureEvents: FeatureEvent[],
  payout = 0,
  gameKind: GameKind = 'base'
): SpinOutcome {
  const entryId = bj.crashed ? 'crash' : bj.idx >= 5 ? 'topped' : 'cash'
  return {
    machineId: def.id,
    family: 'blackjack-reel',
    coins: bj.ante,
    gameKind,
    coinsIn,
    stops: [],
    grid: bj.landed.map(s => (s !== null ? [s] : [])),
    wins: payout > 0
      ? [{ line: 'hand', entryId, symbols: [...bj.hand], payCredits: payout, wildCount: 0, progressive: false }]
      : [],
    totalPayout: payout,
    progressiveEvents: [],
    featureEvents,
    trace: { draws: [] }
  }
}

// ---------- step functions ----------

/** Deal: build the dealt strips (CARD -> deck card; CLIMB/CRASH kept), lock the ante, start spinning. */
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
  bj.reelStrips = def.reels.map(slots => slots.map(tok => (tok === 'CARD' ? deck[di++]! : tok)))
  state.blackjackReel = bj
  return outcome(def, bj, coins, [{ type: 'cards-dealt', strips: bj.reelStrips.map(s => [...s]) }], 0, 'deal')
}

/**
 * Stop the next reel. Reels 0–1 lock a card and set the launch multiplier (and,
 * on reel 1, the velocity); they never crash. Reels 2–4 draw the strip: CLIMB
 * (multiplier ×= velocity) or CRASH (lose). Climbing past reel 4 tops out.
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

  if (r <= 1) {
    bj.hand.push(sym)
    const total = handTotal(bj.hand)
    if (r === 1 && total === 21) {
      bj.natural = true
      bj.multiplier = def.naturalLaunch
    } else {
      bj.multiplier = launchFor(def, total)
    }
    if (r === 1) bj.velocity = velocityFor(def, total)
    bj.idx = r + 1
    return outcome(def, bj, 0, [{ type: 'launch', reel: r, total, multiplier: bj.multiplier, velocity: bj.velocity, natural: bj.natural }])
  }

  if (sym === def.crashSymbol) {
    bj.crashed = true
    bj.phase = 'resolved'
    return outcome(def, bj, 0, [{ type: 'crash', reel: r, multiplier: bj.multiplier }], 0)
  }
  bj.multiplier *= bj.velocity
  bj.idx = r + 1
  if (bj.idx >= 5) {
    bj.phase = 'resolved'
    const payout = bj.ante * bj.multiplier
    return outcome(def, bj, 0, [{ type: 'topped-out', multiplier: bj.multiplier, payout }], payout)
  }
  return outcome(def, bj, 0, [{ type: 'climb', reel: r, multiplier: bj.multiplier }])
}

/** Cash out: bank bet × multiplier. Valid once the first card has landed (idx >= 1). */
export function cashOut(
  def: BlackjackReelMachineDef,
  state: MachineSessionState
): SpinOutcome {
  const bj = state.blackjackReel
  if (bj === null) throw new Error(`${def.id}: cashOut with no hand`)
  if (bj.phase !== 'spinning') throw new Error(`${def.id}: cashOut in phase ${bj.phase}`)
  if (bj.idx < 1) throw new Error(`${def.id}: cashOut before the first card`)
  bj.phase = 'resolved'
  const payout = bj.ante * bj.multiplier
  return outcome(def, bj, 0, [{ type: 'cash-out', reel: bj.idx, multiplier: bj.multiplier, payout }], payout)
}

/**
 * Play ONE hand to resolution: deal (charges the ante), then stop/cash under
 * `policy` until the hand resolves. The single Monte-Carlo driver shared by
 * simulateMachine and simulateSession, so their rand-consumption order can
 * never drift. `onWin` observes every win (entry tallies), if given.
 */
export function playBlackjackHand(
  def: BlackjackReelMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn,
  policy: (bj: BlackjackReelSessionState) => 'cash' | 'continue',
  onWin?: (w: SpinOutcome['wins'][number]) => void
): { coinsIn: number, payout: number } {
  const dealOut = dealReels(def, state, coins, rand)
  let payout = dealOut.totalPayout
  if (onWin) for (const w of dealOut.wins) onWin(w)
  const bj = state.blackjackReel!
  while (bj.phase === 'spinning') {
    const out = policy(bj) === 'cash' ? cashOut(def, state) : stopReel(def, state, rand)
    payout += out.totalPayout
    if (onWin) for (const w of out.wins) onWin(w)
  }
  return { coinsIn: dealOut.coinsIn, payout }
}
