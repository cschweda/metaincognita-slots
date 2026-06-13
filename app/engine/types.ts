// Single source of truth for engine types. Pure data + pure functions only —
// nothing in app/engine may import from Vue, Nuxt, or Pinia.

export type MachineFamily = 'stepper' | 'bally-em'
// Plan 2 extends this union with 'video' and 'pachislo'.

export type SymbolId = string

// ---------- paytables ----------

/** Stepper award. Resolution: every entry is tested, HIGHEST pay wins. */
export type StepperAward =
  | { id: string, kind: 'allWild', pay: number }
  | { id: string, kind: 'allSame', symbol: SymbolId, pay: number, progressiveAtMaxCoins?: boolean }
  | { id: string, kind: 'anyOf', symbols: SymbolId[], pay: number }
  | { id: string, kind: 'count', symbol: SymbolId, n: number, pay: number }

/**
 * Bally-EM award. Resolution: first matching entry wins; `run` matches on
 * EXACT left-run length (list every length separately).
 */
export type BallyAward =
  | { id: string, kind: 'run', symbol: SymbolId, length: number, pay: number, progressive?: 'live' | 'maxCoins' }
  | { id: string, kind: 'allOf', symbol: SymbolId, pay: number }
// progressive: 'live'      → pays the live meter of the dual controller (any coin level)
// progressive: 'maxCoins'  → pays the single meter at max coins, else pay × coins

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
  /** symbol id → display label (glyphs/art arrive in Plan 3) */
  symbols: Record<SymbolId, { label: string }>
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

export type MachineDef = StepperMachineDef | BallyEmMachineDef

// ---------- spin results ----------

export interface MachineSessionState {
  progressive: ProgressiveState | null
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

export interface SpinOutcome {
  machineId: string
  family: MachineFamily
  coins: number
  /** physical stop index per reel */
  stops: number[]
  /** grid[reel] = visible symbols; bally rows [top, center, bottom], stepper [above, payline, below] */
  grid: SymbolId[][]
  wins: LineWin[]
  totalPayout: number
  progressiveEvents: ProgressiveEvent[]
  trace: SpinTrace
}
