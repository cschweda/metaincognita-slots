import type { BallyEmMachineDef, MachineDef, StepperMachineDef, SymbolId } from './types'
import { ballyAwardForLine, bestStepperAward } from './awards'

export interface ExactRtpOptions {
  /** coin level for multiplier/progressive-at-max machines (default: maxCoins) */
  coins?: number
  progressiveValues?: {
    /** value used for progressive:'maxCoins' / stepper progressiveAtMaxCoins entries (default: config reset) */
    meter?: number
    /** value used for progressive:'live' entries (default: average of dual resets) */
    liveAverage?: number
  }
}

export interface ExactRtpBreakdownEntry {
  entryId: string
  probability: number
  /** average credits per coin paid when it hits (after wild multipliers etc.) */
  avgPayPerCoin: number
  /** probability x avgPayPerCoin — summed = rtpPerCoin */
  contribution: number
}

export interface ExactRtpReport {
  rtpPerCoin: number
  hitFrequency: number
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

/**
 * Exact per-coin RTP by full enumeration of symbol tuples with integer weights.
 * Uses the SAME award functions as the spin evaluators, so display math and
 * gameplay math cannot diverge. Weight products are integers << 2^53; pays may
 * be fractional for odd progressive meters (meter/coins), but every sum stays
 * exact to far beyond the 6-decimal frozen-test tolerance.
 */
export function exactRtp(def: MachineDef, opts: ExactRtpOptions = {}): ExactRtpReport {
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
  return {
    rtpPerCoin,
    hitFrequency: hitNum / denom,
    variancePerCoin: ev2Num / denom - rtpPerCoin * rtpPerCoin,
    breakdown: [...byEntry.entries()].map(([entryId, v]) => ({
      entryId,
      probability: v.pNum / denom,
      avgPayPerCoin: v.evNum / v.pNum,
      contribution: v.evNum / denom
    })).sort((a, b) => b.contribution - a.contribution)
  }
}
