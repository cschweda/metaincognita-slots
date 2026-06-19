// Stop & Lock 777 engine — a player-stopped hold-and-spin cash-collect machine.
//
// The `lock-reel` family: five reels over a 5 × `rows` grid. The reels spin
// nonstop; each STOP locks a reel's whole column at once via an HONEST UNIFORM
// draw of a contiguous `rows`-length window from that reel's strip (timing feels
// skillful but doesn't change the odds — the same stance as the pachislo and
// Flameout 21 skill-stops). Locked cash symbols and prizes accumulate; nothing
// is ever wiped out. Three 7s locked in one stop-through fire a free-spin
// hold-and-spin bonus immediately; two 7s leave a one-reel re-stop tease.
//
// Credit accounting is kept PER COIN (`collectCredits` = the bet-1 collect); the
// store/book layer scales by the ante and denomination, exactly like
// blackjack-reel (`totalPayout = ante * credits`, then bookOutcome multiplies by
// denominationCents). Every cash/prize value is a whole credit, so the collect
// stays whole-credit (no fractional-payout departure).

import type {
  LockReelMachineDef,
  LockReelSessionState,
  FeatureEvent,
  GameKind,
  MachineSessionState,
  SpinOutcome,
  SymbolId
} from './types'
import type { RandomFn } from './rng'

// ---------- fresh session state ----------

export function freshLockState(def: LockReelMachineDef): LockReelSessionState {
  return {
    phase: 'idle',
    grid: Array.from({ length: 5 }, () => new Array<SymbolId | null>(def.rows).fill(null)),
    idx: 0,
    sevenCount: 0,
    collectCredits: 0,
    respinsLeft: 0,
    ante: 0
  }
}

// ---------- helpers ----------

/** Per-coin credit value of a locked symbol: cash value, prize value, or 0 (seven/blank). */
function symbolCredits(def: LockReelMachineDef, sym: SymbolId): number {
  return def.cashValues[sym] ?? def.prizes[sym] ?? 0
}

/** Uniform contiguous `rows`-window of a strip starting at `start` (wraps around). */
function window(strip: readonly SymbolId[], start: number, rows: number): SymbolId[] {
  const out: SymbolId[] = []
  for (let i = 0; i < rows; i++) out.push(strip[(start + i) % strip.length]!)
  return out
}

/**
 * A cell is "empty" (respinnable in the bonus) when it is unstopped (`null`) or
 * holds the blank symbol; cash / prize / seven symbols are sticky.
 */
function isEmptyCell(def: LockReelMachineDef, cell: SymbolId | null): boolean {
  return cell === null || cell === def.blankSymbol
}

/** Every cell holds a sticky (non-blank, non-null) symbol — the grid is filled. */
export function lockGridFull(def: LockReelMachineDef, state: LockReelSessionState): boolean {
  return state.grid.every(col => col.every(c => !isEmptyCell(def, c)))
}

/**
 * The two-7s "tease": a resolved round with exactly two locked 7s. Exposed as a
 * derived flag (no stored field, no auto re-stop) — the UI/store wire the actual
 * one-reel free re-stop in a later task. The base RTP is therefore a clean
 * 5-stop collect + 3-seven bonus (the tease contributes nothing here), which is
 * what the exact-RTP module enumerates and the simulator below mirrors.
 */
export function teaseAvailable(state: LockReelSessionState): boolean {
  return state.phase === 'resolved' && state.sevenCount === 2
}

// ---------- outcome builder ----------

function outcome(
  def: LockReelMachineDef,
  lr: LockReelSessionState,
  coinsIn: number,
  featureEvents: FeatureEvent[],
  payout = 0,
  gameKind: GameKind = 'base'
): SpinOutcome {
  return {
    machineId: def.id,
    family: 'lock-reel',
    coins: lr.ante,
    gameKind,
    coinsIn,
    stops: [],
    grid: lr.grid.map(col => col.map(c => c ?? def.blankSymbol)),
    wins: payout > 0
      ? [{ line: 'collect', entryId: 'collect', symbols: [], payCredits: payout, wildCount: 0, progressive: false }]
      : [],
    totalPayout: payout,
    progressiveEvents: [],
    featureEvents,
    trace: { draws: [] }
  }
}

// ---------- step functions ----------

/** Deal: charge the ante, start the reels spinning, fresh empty grid. */
export function dealStart(
  def: LockReelMachineDef,
  state: MachineSessionState,
  coins: number,
  _rand: RandomFn
): SpinOutcome {
  const lr = freshLockState(def)
  lr.ante = coins
  lr.phase = 'spinning'
  state.lockReel = lr
  return outcome(def, lr, coins, [], 0, 'deal')
}

/**
 * Stop the next reel (`idx`): uniform-draw a contiguous `rows`-window from
 * `reels[idx]` (wraps), lock that column, tally its cash/prizes into
 * `collectCredits` (per coin) and its 7s into `sevenCount`. Advance `idx`; on the
 * fifth stop, resolve.
 */
export function stopReel(
  def: LockReelMachineDef,
  state: MachineSessionState,
  rand: RandomFn
): SpinOutcome {
  const lr = state.lockReel
  if (lr === null) throw new Error(`${def.id}: stopReel with no round`)
  if (lr.phase !== 'spinning') throw new Error(`${def.id}: stopReel in phase ${lr.phase}`)
  const r = lr.idx
  const strip = def.reels[r]!
  const start = Math.floor(rand() * strip.length)
  const col = window(strip, start, def.rows)
  lr.grid[r] = col

  let cash = 0
  let sevens = 0
  for (const sym of col) {
    if (sym === def.sevenSymbol) sevens += 1
    else cash += symbolCredits(def, sym)
  }
  lr.collectCredits += cash
  lr.sevenCount += sevens

  const events: FeatureEvent[] = [{ type: 'column-locked', reel: r, locked: [...col] }]
  if (cash > 0) events.push({ type: 'cash-locked', credits: cash })
  if (sevens > 0) events.push({ type: 'seven-locked', count: lr.sevenCount })
  lr.idx = r + 1

  if (lr.idx < 5) return outcome(def, lr, 0, events)
  return resolveBase(def, lr, events)
}

/**
 * Resolve after the fifth stop. Three or more 7s → enter the bonus (held grid,
 * `bonus.respins` free respins). Otherwise pay the collect (`ante × credits`).
 */
function resolveBase(
  def: LockReelMachineDef,
  lr: LockReelSessionState,
  events: FeatureEvent[]
): SpinOutcome {
  if (lr.sevenCount >= 3) {
    lr.phase = 'bonus'
    lr.respinsLeft = def.bonus.respins
    events.push({ type: 'bonus-triggered' })
    return outcome(def, lr, 0, events, 0, 'base')
  }
  lr.phase = 'resolved'
  const payout = lr.ante * lr.collectCredits
  events.push({ type: 'collect', credits: lr.collectCredits })
  return outcome(def, lr, 0, events, payout, 'base')
}

/**
 * Resolve ONE bonus respin. Every still-empty (blank) cell re-draws a single
 * symbol uniformly from its reel's strip; any non-blank locks (sticky). Any new
 * lock resets `respinsLeft`; a pure miss decrements it. Filling the grid awards
 * the GRAND. The feature ends at 0 respins or a full grid — and only the
 * resolving call delivers the payout.
 *
 * Fully auto-playable: the simulator loops this with an RNG until
 * `phase === 'resolved'`; the math is identical whether stepped by a player or
 * auto-looped (each call resolves exactly one respin over all empty cells).
 */
export function bonusStop(
  def: LockReelMachineDef,
  state: MachineSessionState,
  rand: RandomFn
): SpinOutcome {
  const lr = state.lockReel
  if (lr === null) throw new Error(`${def.id}: bonusStop with no round`)
  if (lr.phase !== 'bonus') throw new Error(`${def.id}: bonusStop in phase ${lr.phase}`)

  const events: FeatureEvent[] = []
  let landed = 0
  for (let r = 0; r < 5; r++) {
    const strip = def.reels[r]!
    const col = lr.grid[r]!
    for (let row = 0; row < def.rows; row++) {
      if (!isEmptyCell(def, col[row] ?? null)) continue
      const sym = strip[Math.floor(rand() * strip.length)]!
      col[row] = sym
      if (sym === def.blankSymbol) continue
      landed += 1
      if (sym === def.sevenSymbol) lr.sevenCount += 1
      else lr.collectCredits += symbolCredits(def, sym)
      events.push({ type: 'column-locked', reel: r, locked: [sym] })
    }
  }

  const full = lockGridFull(def, lr)
  let ended: boolean
  if (landed > 0) {
    lr.respinsLeft = def.bonus.respins
    ended = full
  } else if (full) {
    ended = true
  } else {
    lr.respinsLeft -= 1
    ended = lr.respinsLeft <= 0
  }
  events.push({ type: 'respin', left: lr.respinsLeft })

  if (!ended) return outcome(def, lr, 0, events, 0, 'respin')
  return resolveBonus(def, lr, events, full)
}

/**
 * Finalize the bonus: sticky 7s each pay `bonus.sevenUpgrade`, a filled grid
 * pays the GRAND, then pay the full grid collect (`ante × credits`).
 */
function resolveBonus(
  def: LockReelMachineDef,
  lr: LockReelSessionState,
  events: FeatureEvent[],
  full: boolean
): SpinOutcome {
  lr.collectCredits += lr.sevenCount * def.bonus.sevenUpgrade
  if (full) {
    lr.collectCredits += def.prizes[def.bonus.grandOnFill]!
    events.push({ type: 'grand' })
  }
  lr.phase = 'resolved'
  const payout = lr.ante * lr.collectCredits
  events.push({ type: 'collect', credits: lr.collectCredits })
  return outcome(def, lr, 0, events, payout, 'respin')
}
