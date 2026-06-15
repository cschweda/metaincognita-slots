import type { BallyEmMachineDef, MachineDef, StepperMachineDef, SymbolId } from './types'
import { ballyAwardForLine, bestStepperAward } from './awards'
import { videoExactRtp } from './videoRtp'
import { pachisloExactRtp } from './pachisloRtp'

export interface ExactRtpOptions {
  /** coin level for multiplier/progressive-at-max machines (default: maxCoins) */
  coins?: number
  progressiveValues?: {
    /** value used for progressive:'maxCoins' / stepper progressiveAtMaxCoins entries (default: config reset) */
    meter?: number
    /** value used for progressive:'live' entries (default: average of dual resets) */
    liveAverage?: number
  }
  /** pachislo operator level 1..6 (default: def.defaultOddsLevel) */
  oddsLevel?: number
}

export interface ExactRtpBreakdownEntry {
  entryId: string
  probability: number
  /** average credits per coin paid when it hits (after wild multipliers etc.) (pachislo: the flag's full renewal value per token, out/IN) */
  avgPayPerCoin: number
  /** probability x avgPayPerCoin — summed = rtpPerCoin */
  contribution: number
}

export interface ExactRtpReport {
  rtpPerCoin: number
  /** (pachislo: total flag probability per lottery draw) */
  hitFrequency: number
  /** per-cycle variance; for pachislo this is ATTRIBUTION variance (descriptive volatility, not an i.i.d. SE — convergence uses block SE) */
  variancePerCoin: number
  breakdown: ExactRtpBreakdownEntry[]
}

/** Per-reel integer weights for each symbol on the payline. */
function stepperWeights(def: StepperMachineDef): Map<SymbolId, number>[] {
  return def.virtualMaps.map((vmap, r) => {
    const strip = def.physicalStrips[r]!
    const w = new Map<SymbolId, number>()
    for (const idx of vmap) {
      const s = strip[idx]!
      w.set(s, (w.get(s) ?? 0) + 1)
    }
    return w
  })
}

/** Uniform stops: weight of a symbol on any row = its count in the strip. */
function ballyWeights(def: BallyEmMachineDef): Map<SymbolId, number>[] {
  return def.strips.map((strip) => {
    const w = new Map<SymbolId, number>()
    for (const s of strip) w.set(s, (w.get(s) ?? 0) + 1)
    return w
  })
}

// Mirror spinBallyEm's geometry: grid[reel] = strip[stop+0..2] = rows [top,
// center, bottom]; coin k activates payline k.
const BALLY_LINE_ROWS = { center: 1, top: 0, bottom: 2 } as const
const BALLY_LINES_FOR_COINS = [['center'], ['center', 'top'], ['center', 'top', 'bottom']] as const

/**
 * True PER-SPIN hit frequency and per-coin variance for a 'lines' Bally machine
 * at `coins` active paylines. The three window rows of a reel are read off the
 * SAME stop, so they are correlated — the joint must be taken over reel
 * stop-tuples (uniform, independent across reels) and every active line scored
 * on the same tuple (a per-line product would be wrong). Mirrors the video
 * line joint. At coins=1 this reduces to the single-line figures.
 *
 * `linePayPerCoin` is the per-coin credit value of one scored line (the same
 * value the symbol-tuple pass uses for RTP), so RTP per coin = E[total]/coins
 * is unchanged; only HF and variance gain the multi-line shape.
 */
function ballyLinesJoint(
  def: BallyEmMachineDef,
  coins: number,
  linePayPerCoin: (line: SymbolId[]) => number
): { hitFrequency: number, variancePerCoin: number } {
  const reels = def.strips.length
  const S = def.stops
  const symList = Object.keys(def.symbols)
  const symId = new Map<SymbolId, number>(symList.map((s, i) => [s, i]))
  const nSym = symList.length

  // rowCell[reel][row][stop] = symbol id shown by that reel at that window row.
  const rowCell: number[][][] = def.strips.map((strip) => {
    const a: number[][] = [[], [], []]
    for (let row = 0; row < 3; row++) {
      for (let s = 0; s < S; s++) a[row]![s] = symId.get(strip[(s + row) % S]!)!
    }
    return a
  })
  const rows = BALLY_LINES_FOR_COINS[coins - 1]!.map(n => BALLY_LINE_ROWS[n])

  // Per-coin pay of a scored line, memoized by integer-encoded symbol tuple
  // (award depends only on the symbols, not the stops). Uses the SAME pay
  // function as the RTP pass so display and gameplay math cannot diverge.
  const payCache = new Map<number, number>()
  const line: SymbolId[] = new Array(reels).fill('')
  const ids = new Array<number>(reels).fill(0)
  const payForRow = (): number => {
    let key = 0
    for (const id of ids) key = key * nSym + id
    const hit = payCache.get(key)
    if (hit !== undefined) return hit
    for (let r = 0; r < reels; r++) line[r] = symList[ids[r]!]!
    const pay = linePayPerCoin(line)
    payCache.set(key, pay)
    return pay
  }

  const denom = S ** reels
  let sumX = 0 // sum over tuples of total spin payout (all active lines)
  let sumX2 = 0
  let hits = 0
  const stops = new Array<number>(reels).fill(0)
  const recurse = (reel: number): void => {
    if (reel === reels) {
      let x = 0
      let any = false
      for (const row of rows) {
        for (let r = 0; r < reels; r++) ids[r] = rowCell[r]![row]![stops[r]!]!
        const p = payForRow()
        if (p > 0) any = true
        x += p
      }
      sumX += x
      sumX2 += x * x
      if (any) hits++
      return
    }
    for (let s = 0; s < S; s++) {
      stops[reel] = s
      recurse(reel + 1)
    }
  }
  recurse(0)

  const ex = sumX / denom
  const ex2 = sumX2 / denom
  return {
    hitFrequency: hits / denom,
    variancePerCoin: (ex2 - ex * ex) / (coins * coins)
  }
}

/**
 * Exact per-coin RTP by full enumeration of symbol tuples with integer weights.
 * Uses the SAME award functions as the spin evaluators, so display math and
 * gameplay math cannot diverge. Weight products are integers << 2^53; pays may
 * be fractional for odd progressive meters (meter/coins), but every sum stays
 * exact to far beyond the 6-decimal frozen-test tolerance.
 */
export function exactRtp(def: MachineDef, opts: ExactRtpOptions = {}): ExactRtpReport {
  if (def.family === 'video') return videoExactRtp(def, opts)
  if (def.family === 'pachislo') return pachisloExactRtp(def, opts)
  if (def.family === 'blackjack-reel') throw new Error('blackjack-reel exact RTP not implemented (Task 5)')
  const coins = opts.coins ?? def.maxCoins
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }
  let weights: Map<SymbolId, number>[]
  switch (def.family) {
    case 'stepper':
      weights = stepperWeights(def)
      break
    case 'bally-em':
      weights = ballyWeights(def)
      break
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled machine family: ${(exhaustive as MachineDef).family}`)
    }
  }
  const totals = weights.map(w => [...w.values()].reduce((a, b) => a + b, 0))
  const denom = totals.reduce((a, b) => a * b, 1)

  // resolve progressive pay values (per total award, not per coin)
  let meterValue = opts.progressiveValues?.meter
  let liveAverage = opts.progressiveValues?.liveAverage
  if (def.family === 'stepper') {
    meterValue ??= def.progressive?.reset
  } else if (def.progressive?.kind === 'single') {
    meterValue ??= def.progressive.meter.reset
  } else if (def.progressive?.kind === 'dual') {
    liveAverage ??= (def.progressive.upper.reset + def.progressive.lower.reset) / 2
  }

  /** pay PER COIN for a line of symbols at the given coin level */
  const payPerCoin = (line: SymbolId[]): { pay: number, entryId: string } | null => {
    if (def.family === 'stepper') {
      const r = bestStepperAward(line, def)
      if (r === null) return null
      const e = r.entry
      if (e.kind === 'allSame' && e.progressiveAtMaxCoins === true && coins === def.maxCoins) {
        return { pay: (meterValue ?? 0) / coins, entryId: e.id }
      }
      return { pay: r.payCredits, entryId: e.id }
    }
    const e = ballyAwardForLine(line, def.paytable)
    if (e === null) return null
    // narrow to 'run' before touching .progressive — allOf entries lack it
    if (e.kind === 'run' && e.progressive === 'live') return { pay: (liveAverage ?? 0), entryId: e.id }
    if (e.kind === 'run' && e.progressive === 'maxCoins') {
      return coins === def.maxCoins
        ? { pay: (meterValue ?? 0) / coins, entryId: e.id }
        : { pay: e.pay, entryId: e.id }
    }
    return { pay: e.pay, entryId: e.id }
  }

  const alphabet = weights.map(w => [...w.entries()])
  const reels = alphabet.length
  const line: SymbolId[] = new Array(reels).fill('')

  let evNum = 0 // sum of weightProduct x pay
  let ev2Num = 0 // sum of weightProduct x pay^2
  let hitNum = 0 // sum of weightProduct over paying lines
  const byEntry = new Map<string, { pNum: number, evNum: number }>()

  const recurse = (reel: number, weightProduct: number) => {
    if (reel === reels) {
      const res = payPerCoin(line)
      if (res !== null && res.pay > 0) {
        evNum += weightProduct * res.pay
        ev2Num += weightProduct * res.pay * res.pay
        hitNum += weightProduct
        const slot = byEntry.get(res.entryId) ?? { pNum: 0, evNum: 0 }
        slot.pNum += weightProduct
        slot.evNum += weightProduct * res.pay
        byEntry.set(res.entryId, slot)
      }
      return
    }
    for (const [sym, w] of alphabet[reel]!) {
      line[reel] = sym
      recurse(reel + 1, weightProduct * w)
    }
  }
  recurse(0, 1)

  const rtpPerCoin = evNum / denom

  // Single-line figures above are correct for RTP/coin (coin-linear) and for
  // the per-payline breakdown. But a 'lines' Bally machine plays `coins`
  // correlated rows per spin, so the displayed PER-SPIN hit frequency and
  // per-coin variance must be the joint over stop-tuples, not single-line.
  let hitFrequency = hitNum / denom
  let variancePerCoin = ev2Num / denom - rtpPerCoin * rtpPerCoin
  if (def.family === 'bally-em' && def.payMode === 'lines') {
    const joint = ballyLinesJoint(def, coins, line => payPerCoin(line)?.pay ?? 0)
    hitFrequency = joint.hitFrequency
    variancePerCoin = joint.variancePerCoin
  }

  return {
    rtpPerCoin,
    hitFrequency,
    variancePerCoin,
    breakdown: [...byEntry.entries()].map(([entryId, v]) => ({
      entryId,
      probability: v.pNum / denom,
      avgPayPerCoin: v.evNum / v.pNum,
      contribution: v.evNum / denom
    })).sort((a, b) => b.contribution - a.contribution)
  }
}
