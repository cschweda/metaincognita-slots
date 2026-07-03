// app/engine/sessions.ts
import type { MachineDef, MachineSessionState } from './types'
import type { RandomFn } from './rng'
import { mulberry32 } from './rng'
import { spin, nextSpinCost, initMachineState } from './index'
import { dealReels, stopReel, cashOut } from './blackjackReel'
import { makeOptimalStopFn } from './blackjackReelRtp'
import { dealStart as lockDealStart, stopReel as lockStopReel, bonusStop as lockBonusStop } from './lockReel'
import { feedProgressive } from './progressive'
import { exactRtp } from './exactRtp'

export interface SessionOptions {
  /** starting bankroll in CREDITS (1 credit = 1 coin = denominationCents) */
  startCredits: number
  /** coins wagered per paid spin (1..def.maxCoins) — passed straight to spin() */
  bet: number
  /** maximum PAID spins before a forced stop (a "survive") */
  spinCap: number
  /** 'static': meters stay at reset. 'live': fed per coin-in (mirrors simulateMachine). */
  progressiveMode: 'static' | 'live'
  /** pachislo operator level 1..6 (default: def.defaultOddsLevel) */
  oddsLevel?: number
}

export interface SessionResult {
  busted: boolean // stopped because it could not afford the next paid spin
  spinsPlayed: number // PAID spins taken (free spins/respins excluded)
  endBalance: number
  peak: number
  maxDrawdown: number // deepest credits-below-peak
  totalIn: number // coins wagered (for empirical RTP)
  totalOut: number // coins paid out
  trajectory: number[] // balance after each paid spin, downsampled (≤80), [] unless recorded
}

/** Deterministic per-session seed from a master seed + session index (well-mixed). */
export function deriveSeed(master: number, index: number): number {
  let h = (master ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x21f0aaad) >>> 0
  h ^= h >>> 15
  return h >>> 0
}

function downsample(arr: number[], maxPts: number): number[] {
  if (maxPts <= 1) return arr.length ? [arr[arr.length - 1]!] : []
  if (arr.length <= maxPts) return arr.slice()
  const out: number[] = []
  const step = (arr.length - 1) / (maxPts - 1)
  for (let i = 0; i < maxPts; i++) out.push(arr[Math.round(i * step)]!)
  return out
}

export function simulateSession(
  def: MachineDef,
  opts: SessionOptions,
  rand: RandomFn,
  recordTrajectory = false
): SessionResult {
  const state: MachineSessionState = initMachineState(def)
  if (def.family === 'pachislo' && opts.oddsLevel !== undefined && state.pachislo !== null) {
    if (!Number.isInteger(opts.oddsLevel) || opts.oddsLevel < 1 || opts.oddsLevel > def.oddsLevels.length) {
      throw new Error(`${def.id}: oddsLevel ${opts.oddsLevel} out of range 1..${def.oddsLevels.length}`)
    }
    state.pachislo.oddsLevel = opts.oddsLevel
  }

  let balance = opts.startCredits
  let peak = balance
  let maxDrawdown = 0
  let totalIn = 0
  let totalOut = 0
  let paidSpins = 0
  let busted = false
  const traj: number[] = recordTrajectory ? [balance] : []

  const applySpin = (): void => {
    if (opts.progressiveMode === 'live') feedProgressive(def, state.progressive, 'before', opts.bet)
    const out = spin(def, state, opts.bet, rand)
    if (opts.progressiveMode === 'live') feedProgressive(def, state.progressive, 'after', out.coinsIn)
    totalIn += out.coinsIn
    totalOut += out.totalPayout
    balance += out.totalPayout - out.coinsIn
    if (balance > peak) peak = balance
    if (peak - balance > maxDrawdown) maxDrawdown = peak - balance
    if (out.coinsIn > 0) {
      paidSpins++
      if (recordTrajectory) traj.push(balance)
    }
  }

  if (def.family === 'blackjack-reel') {
    // ── Flameout 21 (crash) ────────────────────────────────────────────────
    // One "paid spin" is one hand. dealReels charges the ante (bet coins) once;
    // stopReel/cashOut are free. The optimal cash/climb policy (closed-form,
    // built once for def) drives the run — exactly as simulateMachine does.
    // Payout is bet × multiplier in the multiplier domain with no per-hand cent
    // rounding (that is the live store's concern), so the empirical RTP tracks
    // the exact DP that the Sim Lab's house-edge figure comes from.
    const optStop = makeOptimalStopFn(def)
    while (paidSpins < opts.spinCap) {
      if (balance < opts.bet) {
        busted = true
        break
      }
      const dealOut = dealReels(def, state, opts.bet, rand)
      const handIn = dealOut.coinsIn
      let handOut = dealOut.totalPayout
      const bj = state.blackjackReel!
      while (bj.phase === 'spinning') {
        const out = optStop(bj) === 'cash' ? cashOut(def, state) : stopReel(def, state, rand)
        handOut += out.totalPayout
      }
      totalIn += handIn
      totalOut += handOut
      balance += handOut - handIn
      if (balance > peak) peak = balance
      if (peak - balance > maxDrawdown) maxDrawdown = peak - balance
      paidSpins++
      if (recordTrajectory) traj.push(balance)
    }
  } else if (def.family === 'lock-reel') {
    // ── Stop & Lock 777 (cash-collect hold-and-spin) ────────────────────────
    // One "paid spin" is one round. dealStart charges the ante (bet coins) once;
    // the five stops and the bonus respins are free. The honest stop is a uniform
    // window draw (skill-neutral), so there is no policy to optimise — stop every
    // reel, then auto-loop the bonus to resolution. Payout is the whole-credit
    // collect (ante × collectCredits) in the credit domain, so the empirical RTP
    // tracks the exact-RTP enumeration the Sim Lab's house-edge figure comes from.
    // Mirrors simulateMachine's lock-reel branch.
    while (paidSpins < opts.spinCap) {
      if (balance < opts.bet) {
        busted = true
        break
      }
      const dealOut = lockDealStart(def, state, opts.bet, rand)
      const roundIn = dealOut.coinsIn
      let roundOut = dealOut.totalPayout
      const lr = state.lockReel!
      for (let r = 0; r < 5; r++) roundOut += lockStopReel(def, state, rand).totalPayout
      while (lr.phase === 'bonus') roundOut += lockBonusStop(def, state, rand).totalPayout
      totalIn += roundIn
      totalOut += roundOut
      balance += roundOut - roundIn
      if (balance > peak) peak = balance
      if (peak - balance > maxDrawdown) maxDrawdown = peak - balance
      paidSpins++
      if (recordTrajectory) traj.push(balance)
    }
  } else {
    // ── all other families ─────────────────────────────────────────────────
    // Free video features have cost 0, so they replay inside this loop without
    // touching the affordability check or the paid-spin counter.
    while (paidSpins < opts.spinCap) {
      const cost = nextSpinCost(def, state, opts.bet)
      if (cost > 0 && balance < cost) {
        busted = true
        break
      }
      applySpin()
    }
    // The cap-th paid spin may have triggered a free feature — play it out so its
    // payout is collected (mirrors simulateMachine's drain; free, so no cost).
    //
    // Deliberate asymmetry: a pachislo `bonus` that is still pending at the spin
    // cap is NOT force-drained here.  Unlike video free-spins, pachislo bonus
    // rounds are cost-bearing (nextSpinCost > 0), so force-playing them could
    // overspend a bankroll that is already at rest.  The abandoned-tail EV is
    // statistically negligible and matches the spec's stance.
    while (state.videoFeature !== null) applySpin()
  }

  return {
    busted,
    spinsPlayed: paidSpins,
    endBalance: balance,
    peak,
    maxDrawdown,
    totalIn,
    totalOut,
    trajectory: recordTrajectory ? downsample(traj, 80) : []
  }
}

// --- Task 0.2: aggregateSessions ---

/** Slim per-session subset of SessionResult buffered by the aggregator; drops peak/totalIn/totalOut/trajectory. */
export interface SessionRecord {
  endBalance: number
  maxDrawdown: number
  spinsPlayed: number
  busted: boolean
}

export interface SampleTrajectory {
  busted: boolean
  points: number[]
}

export interface SimLabContext {
  machineId: string
  startCredits: number
  bet: number
  spinCap: number
  houseEdge: number
  empiricalRtp: number
  survivalBins?: number // default 200
  histogramBins?: number // default 40
}

export interface Histogram {
  binEdges: number[] // length = counts.length + 1
  counts: number[]
}

export interface SimLabResult {
  machineId: string
  sessions: number
  startCredits: number
  bet: number
  spinCap: number
  riskOfRuin: number
  medianEnd: number
  meanEnd: number
  pctAhead: number
  avgSpins: number
  avgMaxDrawdown: number
  empiricalRtp: number
  houseEdge: number
  survival: { spins: number, fraction: number }[]
  endHistogram: Histogram & { bustCount: number }
  drawdownHistogram: Histogram
  sampleTrajectories: SampleTrajectory[]
}

function median(sorted: number[]): number {
  const n = sorted.length
  if (n === 0) return 0
  const mid = n >> 1
  return n % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function histogram(values: number[], lo: number, hi: number, bins: number): Histogram {
  const counts = new Array<number>(bins).fill(0)
  const binEdges: number[] = []
  const span = hi - lo || 1
  for (let i = 0; i <= bins; i++) binEdges.push(lo + (span * i) / bins)
  for (const v of values) {
    const clamped = Math.min(Math.max(v, lo), hi)
    let idx = Math.floor(((clamped - lo) / span) * bins)
    if (idx >= bins) idx = bins - 1
    if (idx < 0) idx = 0
    counts[idx]!++
  }
  return { binEdges, counts }
}

export function aggregateSessions(
  records: SessionRecord[],
  samples: SampleTrajectory[],
  ctx: SimLabContext
): SimLabResult {
  const n = records.length
  const survivalBins = ctx.survivalBins ?? 200
  const histogramBins = ctx.histogramBins ?? 40

  let bust = 0
  let ahead = 0
  let sumEnd = 0
  let sumSpins = 0
  let sumDd = 0
  let maxEnd = 0
  let maxDd = 0
  const ends: number[] = []
  const dds: number[] = []
  // deaths[s] = # of sessions whose final paid-spin count is exactly s
  const playedHist = new Array<number>(ctx.spinCap + 1).fill(0)

  for (const r of records) {
    if (r.busted) bust++
    if (r.endBalance > ctx.startCredits) ahead++
    sumEnd += r.endBalance
    sumSpins += r.spinsPlayed
    sumDd += r.maxDrawdown
    if (r.endBalance > maxEnd) maxEnd = r.endBalance
    if (r.maxDrawdown > maxDd) maxDd = r.maxDrawdown
    ends.push(r.endBalance)
    dds.push(r.maxDrawdown)
    const s = Math.min(Math.max(r.spinsPlayed, 0), ctx.spinCap)
    playedHist[s]!++
  }

  // survival[x] = fraction with spinsPlayed >= x (survivors = spinsPlayed == spinCap)
  // suffix counts
  const atLeast = new Array<number>(ctx.spinCap + 2).fill(0)
  for (let x = ctx.spinCap; x >= 0; x--) atLeast[x] = atLeast[x + 1]! + playedHist[x]!
  const survival: { spins: number, fraction: number }[] = []
  const bins = Math.min(survivalBins, ctx.spinCap)
  for (let k = 0; k <= bins; k++) {
    const x = Math.round((k / bins) * ctx.spinCap)
    survival.push({ spins: x, fraction: n ? atLeast[x]! / n : 0 })
  }

  ends.sort((a, b) => a - b)
  dds.sort((a, b) => a - b)

  return {
    machineId: ctx.machineId,
    sessions: n,
    startCredits: ctx.startCredits,
    bet: ctx.bet,
    spinCap: ctx.spinCap,
    riskOfRuin: n ? bust / n : 0,
    medianEnd: median(ends),
    meanEnd: n ? sumEnd / n : 0,
    pctAhead: n ? ahead / n : 0,
    avgSpins: n ? sumSpins / n : 0,
    avgMaxDrawdown: n ? sumDd / n : 0,
    empiricalRtp: ctx.empiricalRtp,
    houseEdge: ctx.houseEdge,
    survival,
    endHistogram: { ...histogram(ends, 0, Math.max(maxEnd, 1), histogramBins), bustCount: bust },
    drawdownHistogram: histogram(dds, 0, Math.max(maxDd, 1), histogramBins),
    sampleTrajectories: samples.slice(0, 8) // defensive cap; driver already supplies ≤ 2×perFate
  }
}

// --- Task 0.3: createSimLabRun ---

export interface SimLabOptions extends SessionOptions {
  machineId: string
  sessions: number
  seed: number
  trajectorySampleCap?: number // # of early sessions to record trajectories for (default 60)
  survivalBins?: number
  histogramBins?: number
}

export interface SimLabRun {
  total: number
  runBatch(n: number): { done: boolean, completed: number }
  result(): SimLabResult
}

export function createSimLabRun(def: MachineDef, opts: SimLabOptions): SimLabRun {
  const total = opts.sessions
  const trajCap = opts.trajectorySampleCap ?? 60
  // Caps busted + survived sample trajectories at perFate each (≤ 2×perFate total).
  const perFate = 4
  const records: SessionRecord[] = []
  const bustedSamples: SampleTrajectory[] = []
  const survivedSamples: SampleTrajectory[] = []
  let totalIn = 0
  let totalOut = 0
  let i = 0

  function runBatch(n: number): { done: boolean, completed: number } {
    const end = Math.min(i + n, total)
    for (; i < end; i++) {
      const record = i < trajCap
      const r = simulateSession(def, opts, mulberry32(deriveSeed(opts.seed, i)), record)
      records.push({ endBalance: r.endBalance, maxDrawdown: r.maxDrawdown, spinsPlayed: r.spinsPlayed, busted: r.busted })
      totalIn += r.totalIn
      totalOut += r.totalOut
      if (record) {
        const bucket = r.busted ? bustedSamples : survivedSamples
        if (bucket.length < perFate) bucket.push({ busted: r.busted, points: r.trajectory })
      }
    }
    return { done: i >= total, completed: i }
  }

  function result(): SimLabResult {
    const houseEdge = 1 - exactRtp(def, { coins: opts.bet }).rtpPerCoin
    return aggregateSessions(records, [...bustedSamples, ...survivedSamples], {
      machineId: opts.machineId,
      startCredits: opts.startCredits,
      bet: opts.bet,
      spinCap: opts.spinCap,
      houseEdge,
      empiricalRtp: totalIn > 0 ? totalOut / totalIn : 0,
      survivalBins: opts.survivalBins,
      histogramBins: opts.histogramBins
    })
  }

  return { total, runBatch, result }
}
