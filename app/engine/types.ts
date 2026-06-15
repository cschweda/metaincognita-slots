// Single source of truth for engine types. Pure data + pure functions only —
// nothing in app/engine may import from Vue, Nuxt, or Pinia.

export type MachineFamily = 'stepper' | 'bally-em' | 'video' | 'pachislo' | 'blackjack-reel'

export type SymbolId = string

// ---------- paytables ----------

/** Stepper award. Resolution: every entry is tested, HIGHEST pay wins. */
export type StepperAward
  = | { id: string, kind: 'allWild', pay: number }
    | { id: string, kind: 'allSame', symbol: SymbolId, pay: number, progressiveAtMaxCoins?: boolean }
    | { id: string, kind: 'anyOf', symbols: SymbolId[], pay: number }
    | { id: string, kind: 'count', symbol: SymbolId, n: number, pay: number }

/**
 * Bally-EM award. Resolution: first matching entry wins; `run` matches on
 * EXACT left-run length (list every length separately).
 */
export type BallyAward
  = | { id: string, kind: 'run', symbol: SymbolId, length: number, pay: number, progressive?: 'live' | 'maxCoins' }
    | { id: string, kind: 'allOf', symbol: SymbolId, pay: number }
// progressive: 'live'      → pays the live meter of the dual controller (any coin level)
// progressive: 'maxCoins'  → pays the single meter at max coins, else pay × coins

/** Video line/ways award: exact run length 3..5 anchored on reel 1. */
export interface VideoPayEntry {
  id: string
  symbol: SymbolId
  length: 3 | 4 | 5
  /** per 1-coin line bet (lines mode) or per way-unit (ways mode) */
  pay: number
}

export interface ScatterConfig {
  symbol: SymbolId
  /** pays by count of reels showing the scatter, x TOTAL bet */
  pays: Record<number, number>
  /** visible-reel count that triggers free spins (null = pays only) */
  triggerCount: number | null
}

export interface FreeSpinsConfig {
  count: number
  multiplier: number
  /** another triggerCount scatters during free spins adds `count` more spins */
  retrigger: boolean
}

/** A credit gem: sticks a credit value to its cell. */
export interface OrbCreditEntry {
  /** credits at maxCoins bet */
  credits: number
  weight: number
  label?: 'mini' | 'minor' | 'major'
}

/** A Gargoyle's-Eye-style gem: carries an additive multiplier face, no credits. */
export interface OrbMultiplierEntry {
  /** additive multiplier face (>= 2); collected faces sum and scale the credit total */
  mult: number
  weight: number
}

export type OrbValueEntry = OrbCreditEntry | OrbMultiplierEntry

/** A locked hold-and-spin perch: a credit gem or a Gargoyle's-Eye multiplier gem. */
export type LockedCell = { credits: number, label?: 'mini' | 'minor' | 'major' } | { mult: number }

/**
 * Hold-and-spin (orb) feature configuration.
 * Filling all 15 cells pays the percent progressive (the Grand).
 */
export interface HoldAndSpinConfig {
  orbSymbol: SymbolId
  /** total visible orbs that lock and start the feature (15-cell grid) */
  triggerCount: number
  respins: number
  /** per unlocked cell, per respin: P(orb) = respinOrbNumer / respinOrbDenom */
  respinOrbNumer: number
  respinOrbDenom: number
  orbValues: OrbValueEntry[]
  /** what unlocked cells show in respin grids (declared in symbols, never on strips) */
  emptySymbol: SymbolId
}

// ---------- progressives (Bally FO-5140 semantics) ----------

export interface RateStep {
  /** live coins counted before one increment fires */
  coinsPer: number
  /** credits added per increment */
  amount: number
}

export interface MeterConfig {
  reset: number
  max: number
  rate1: RateStep
  /** once value >= rate1Limit, rate2 applies */
  rate1Limit: number
  rate2: RateStep
}

export interface DualProgressiveConfig {
  kind: 'dual'
  upper: MeterConfig
  lower: MeterConfig
  /** coins-in before the live jackpot toggles (FO-5140: 1–255) */
  coinsPerToggle: number
}

export interface SingleProgressiveConfig {
  kind: 'single'
  meter: MeterConfig
}

export interface PercentProgressiveConfig {
  kind: 'percent'
  reset: number
  max: number
  /** fraction of coin-in fed to the meter, e.g. 0.01 */
  feedRate: number
}

export type ProgressiveConfig
  = DualProgressiveConfig | SingleProgressiveConfig | PercentProgressiveConfig

export interface DualProgressiveState {
  kind: 'dual'
  upper: number
  lower: number
  live: 'upper' | 'lower'
  coinsTowardToggle: number
  /** live-coin counters per meter (FO-5140: NOT reset on jackpot hit) */
  upperCoins: number
  lowerCoins: number
}

export interface SingleProgressiveState {
  kind: 'single'
  value: number
  coins: number
}

export interface PercentProgressiveState {
  kind: 'percent'
  value: number
}

export type ProgressiveState
  = DualProgressiveState | SingleProgressiveState | PercentProgressiveState

// ---------- machines ----------

export interface MachineDefBase {
  id: string
  name: string
  family: MachineFamily
  /** denomination of one coin/credit, in cents */
  denominationCents: number
  maxCoins: number
  /** symbol id → display label + optional icon id (see components/game/symbols/registry) */
  symbols: Record<SymbolId, { label: string, icon?: string }>
  /** prose history connecting the machine to its real-world archetype */
  history: string
}

export interface StepperMachineDef extends MachineDefBase {
  family: 'stepper'
  /** physical strip per reel (length = physical stop count, e.g. 22) */
  physicalStrips: SymbolId[][]
  /**
   * Telnaes virtual reel per physical reel: array of physical stop indices.
   * The RNG draws uniformly over this array; symbol weights = how often each
   * symbol's stops appear here. (Telnaes patent US 4,448,419.)
   */
  virtualMaps: number[][]
  wildSymbol: SymbolId | null
  /** pay multiplier applied per wild in a winning allSame/anyOf line */
  wildMultiplier: number
  paytable: StepperAward[]
  progressive: PercentProgressiveConfig | null
}

export interface BallyEmMachineDef extends MachineDefBase {
  family: 'bally-em'
  /** physical stop count per reel (uniform random — no weighting, pre-Telnaes) */
  stops: number
  strips: SymbolId[][]
  /**
   * 'lines': coin k activates payline k (1=center, 2=+top, 3=+bottom), pays per line.
   * 'multiplier': center line only, pays × coins.
   */
  payMode: 'lines' | 'multiplier'
  paytable: BallyAward[]
  progressive: DualProgressiveConfig | SingleProgressiveConfig | null
}

export interface VideoMachineDef extends MachineDefBase {
  family: 'video'
  /** 5 circular strips; window = 3 consecutive cells; all strips same length */
  strips: SymbolId[][]
  /**
   * 'lines': coins = active line count, lines[i] = row per reel (0 top..2 bottom).
   * 'ways': left-anchored any-adjacent ways; maxCoins buys all ways.
   */
  betMode: { kind: 'lines', lines: number[][] } | { kind: 'ways' }
  /** true => spin() only accepts coins === maxCoins (feature-bearing machines) */
  fixedBet: boolean
  /** never on reel-1 strips (anchoring rule, validator-enforced) */
  wildSymbol: SymbolId | null
  scatter: ScatterConfig | null
  freeSpins: FreeSpinsConfig | null
  holdAndSpin: HoldAndSpinConfig | null
  paytable: VideoPayEntry[]
  /** Thunder Vault Grand; null for machines without one */
  progressive: PercentProgressiveConfig | null
}

export type PachisloFlag
  = 'cherry-top' | 'cherry-mid' | 'cherry-bot' | 'watermelon' | 'bell' | 'replay' | 'reg' | 'big'

/** Per-level lottery rates, integer counts out of 16384. */
export interface PachisloLevelRates {
  bell: number
  reg: number
  big: number
}

export interface PachisloMachineDef extends MachineDefBase {
  family: 'pachislo'
  /** 3 strips x 21 stops */
  strips: SymbolId[][]
  /** max forward slip from the press position (4 on real hardware) */
  slip: number
  /** which symbol plays which role in combos/control */
  roles: {
    cherry: SymbolId
    watermelon: SymbolId
    bell: SymbolId
    replay: SymbolId
    seven: SymbolId
    /** REG combo = seven seven bar */
    bar: SymbolId
    blank: SymbolId
  }
  /** level-independent lottery rates /16384 (cherry is per ROW; x3 rows total) */
  baseRates: { cherryPerRow: number, watermelon: number, replay: number }
  /** index 0..5 = operator levels 1..6 */
  oddsLevels: PachisloLevelRates[]
  /** 1-based; the level a fresh session starts at */
  defaultOddsLevel: number
  pays: { cherryPerLine: number, watermelon: number, bell: number, bonusLined: number }
  jac: { perRound: number, pay: number, cost: number }
  bigRounds: number
  interlude: { bellWeight: number, endWeight: number, weightDenom: number, bellPay: number, maxBells: number, cost: number }
  progressive: null
}

export interface BlackjackReelMachineDef extends MachineDefBase {
  family: 'blackjack-reel'
  /** 5 reel compositions; token 'CARD' = deal next deck card, else a special SymbolId */
  reels: SymbolId[][]
  /** special multiplier-card -> additive face (e.g. {MX2:2,MX3:3,MX5:5,MX10:10}) */
  multiplierSymbols: Record<SymbolId, number>
  /** minus-card -> points removed from the hard total (e.g. {MM2:2,MM3:3}) */
  minusSymbols: Record<SymbolId, number>
  /** instant-loss symbol */
  bustSymbol: SymbolId
  /** per-coin payout by best non-bust total; totals < qualifyMin are absent (=> 0) */
  paytable: { total: number, pay: number }[]
  /** minimum best total that pays anything (15) */
  qualifyMin: number
  /** per-coin base for a 2-card 21 (natural), replacing paytable(21) when it occurs in two cards */
  naturalPay: number
  /** multiplier applied to the whole payout for surviving all five reels (Five-Card Charlie) */
  charlieMultiplier: number
  progressive: null
}

export interface BlackjackReelSessionState {
  phase: 'idle' | 'spinning' | 'resolved'
  /** the dealt strips for this hand (CARD tokens resolved to concrete deck ids) */
  reelStrips: SymbolId[][]
  /** landed symbol per reel; null until that reel is stopped */
  landed: (SymbolId | null)[]
  /** index of the next reel to stop (0..5) */
  idx: number
  /** symbols applied to the hand, in stop order (cards + specials) */
  hand: SymbolId[]
  hard: number // sum of value cards + 1 per ace, after minus subtractions (floored at 0)
  aces: number // aces held (one may count as 11)
  multSum: number // additive multiplier sum
  bestTotal: number // high-water best total <=21 reached (drives the payout)
  natural: boolean // a 2-card 21 was reached
  busted: boolean
  bustBySymbol: boolean // true if the loss was a BUST symbol (vs over-21)
  charlie: boolean // survived all five reels
  ante: number // coins wagered (locks the payout scale)
}

export type MachineDef = StepperMachineDef | BallyEmMachineDef | VideoMachineDef | PachisloMachineDef | BlackjackReelMachineDef

// ---------- spin results ----------

export type VideoFeatureState
  = | {
    kind: 'freeSpins'
    remaining: number
    multiplier: number
    /** the triggering bet, replayed at cost 0 */
    coins: number
  }
  | {
    kind: 'holdAndSpin'
    /** 15 cells (cell = reel*3 + row); null = unlocked. A cell is a credit gem or a multiplier gem. */
    locked: (LockedCell | null)[]
    respins: number
    coins: number
  }

export interface PachisloBonusState {
  type: 'reg' | 'big'
  /** 1-based JAC round */
  round: number
  jacLeft: number
  /** non-null while playing an increased-odds interlude (between BIG rounds) */
  interlude: { index: 1 | 2, bells: number } | null
}

export interface PachisloSessionState {
  /** 1-based operator level, set by the in-app operator key */
  oddsLevel: number
  /** stocked small flags, FIFO (cherry rows, watermelon, bell, replay) */
  smallQueue: PachisloFlag[]
  /** stocked bonus flags, FIFO */
  bonusQueue: ('reg' | 'big')[]
  /**
   * A realized replay makes the next normal game free (coinsIn = 0). The
   * engine enforces the constant full bet: every normal game is called with
   * maxCoins tokens; the free replay inherits that bet automatically.
   */
  replayNext: boolean
  bonus: PachisloBonusState | null
}

export interface MachineSessionState {
  progressive: ProgressiveState | null
  videoFeature: VideoFeatureState | null
  pachislo: PachisloSessionState | null
  blackjackReel: BlackjackReelSessionState | null
}

export interface RngDraw {
  label: string
  /** raw uniform in [0,1) */
  raw: number
  /** integer result derived from raw */
  value: number
  /** size of the integer range */
  range: number
}

export interface VirtualStopTrace {
  reel: number
  virtualIndex: number
  virtualSize: number
  physicalStop: number
  symbol: SymbolId
  /** entries in the virtual map landing on this symbol (the Telnaes weight) */
  weight: number
}

export interface SpinTrace {
  draws: RngDraw[]
  /** stepper only */
  virtualStops?: VirtualStopTrace[]
  /** pachislo only: per reel — where the player pressed, where control stopped, why */
  presses?: { reel: number, press: number, stop: number, slipUsed: number, target: string | null }[]
}

export interface LineWin {
  /** payline label: 'payline' (steppers), 'center' | 'top' | 'bottom' (bally) */
  line: string
  entryId: string
  symbols: SymbolId[]
  payCredits: number
  wildCount: number
  progressive: boolean
}

export interface ProgressiveEvent {
  type: 'hit'
  meter: 'upper' | 'lower' | 'single' | 'percent'
  amountCredits: number
}

/**
 * 'base' = paid base-game spin (steppers, bally-em, video); 'free-spin'/'respin' = zero-cost feature spins;
 * 'normal' = paid (or replay-free) pachislo lottery game; 'jac'/'interlude' =
 * pachislo bonus games. Steppers/bally are always 'base'. Simulation counts
 * cycles over base/normal games only.
 */
export type GameKind = 'base' | 'free-spin' | 'respin' | 'normal' | 'jac' | 'interlude' | 'deal'

export type FeatureEvent
  = | { type: 'free-spins-triggered', count: number, multiplier: number }
    | { type: 'free-spins-retriggered', added: number, remaining: number }
    | { type: 'free-spin-consumed', remaining: number }
    | { type: 'orbs-locked', cells: number[], credits: number[] }
    | { type: 'mult-orbs-locked', cells: number[], mults: number[] }
    | { type: 'respins-reset', respins: number }
    | { type: 'respin-missed', remaining: number }
    | { type: 'hold-and-spin-ended', totalCredits: number, filled: boolean }
    | { type: 'flag-drawn', flag: PachisloFlag }
    | { type: 'flag-stocked', flag: PachisloFlag, queueDepth: number }
    | { type: 'flag-realized', flag: PachisloFlag }
    | { type: 'replay-granted' }
    | { type: 'bonus-started', bonus: 'reg' | 'big' }
    | { type: 'jac-round-complete', round: number }
    | { type: 'interlude-started', index: 1 | 2 }
    | { type: 'interlude-ended', index: 1 | 2, bells: number }
    | { type: 'bonus-ended', bonus: 'reg' | 'big' }
    // blackjack-reel (Lucky 21) events
    | { type: 'cards-dealt', strips: SymbolId[][] }
    | { type: 'reel-stopped', reel: number, symbol: SymbolId }
    | { type: 'bust', reel: number, bySymbol: boolean }
    | { type: 'charlie', cards: SymbolId[] }
    | { type: 'cash-out', bestTotal: number, payout: number }

export interface SpinOutcome {
  machineId: string
  family: MachineFamily
  coins: number
  gameKind: GameKind
  /** actual cost of THIS spin: 0 for free spins/respins/replay games, jac/interlude cost during bonuses */
  coinsIn: number
  /**
   * Strip stop index per reel. Semantics by family: bally-em & video = the
   * TOP-ROW cell index (rows are stop, stop+1, stop+2); stepper = the payline
   * cell index (rows are stop-1, stop, stop+1); pachislo = the top-row cell
   * index AFTER control/slip resolution; video hold-and-spin respins = empty array (no strip stops).
   */
  stops: number[]
  /** grid[reel] = visible symbols; bally rows [top, center, bottom], stepper [above, payline, below] */
  grid: SymbolId[][]
  wins: LineWin[]
  totalPayout: number
  progressiveEvents: ProgressiveEvent[]
  featureEvents: FeatureEvent[]
  trace: SpinTrace
}
