// Wonder Wheel engine — the Wheel-of-Fortune 1996 archetype.
//
// The `wheel` family: a 3-reel Telnaes stepper base (same virtual-map math as
// the steppers, same bestStepperAward evaluator so play and exact math cannot
// diverge) with a WHEEL symbol on reel 3 only. Landing it ON THE PAYLINE at
// MAX COINS arms the topper: the next spin() call is FREE and resolves the
// wheel — one weighted draw over 24 wedges paying FIXED credits (the classic
// contract: wedge values do not scale with the bet, the bet gates the wheel).
// Landing WHEEL under max coins arms nothing — the `wheel-wasted` event lets
// the UI say out loud what a real cabinet keeps quiet.
//
// Non-interactive by design: the UI's giant SPIN-THE-WHEEL button calls the
// store's ordinary spin action, so every driver (store, simulateMachine,
// sessions, verify) plays the wheel with no special-casing beyond draining
// `state.wheel.pending` alongside the other in-flight features.

import type {
  MachineSessionState,
  RngDraw,
  SpinOutcome,
  SymbolId,
  VirtualStopTrace,
  WheelMachineDef
} from './types'
import type { RandomFn } from './rng'
import { bestStepperAward } from './awards'

// ---------- weights (for the X-ray trace) ----------

const weightCache = new WeakMap<WheelMachineDef, Map<SymbolId, number>[]>()

function reelWeights(def: WheelMachineDef): Map<SymbolId, number>[] {
  const hit = weightCache.get(def)
  if (hit !== undefined) return hit
  const maps = def.virtualMaps.map((vmap, r) => {
    const strip = def.physicalStrips[r]!
    const w = new Map<SymbolId, number>()
    for (const idx of vmap) {
      const s = strip[idx]!
      w.set(s, (w.get(s) ?? 0) + 1)
    }
    return w
  })
  weightCache.set(def, maps)
  return maps
}

/** Σ wedge weights — the wheel's true denominator. */
export function totalWedgeWeight(def: WheelMachineDef): number {
  return def.wedges.reduce((s, w) => s + w.weight, 0)
}

/** One weighted wedge draw. Exported so UI honesty tests can pin the landing. */
export function drawWedgeIndex(def: WheelMachineDef, rand: RandomFn): { index: number, raw: number, total: number } {
  const total = totalWedgeWeight(def)
  const raw = rand()
  let ticket = Math.floor(raw * total)
  for (let i = 0; i < def.wedges.length; i++) {
    ticket -= def.wedges[i]!.weight
    if (ticket < 0) return { index: i, raw, total }
  }
  return { index: def.wedges.length - 1, raw, total } // raw ~ 1.0 edge case
}

// ---------- the spin ----------

export function spinWheel(
  def: WheelMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  const wheel = state.wheel
  if (wheel === null) throw new Error(`${def.id}: wheel session state missing`)

  // ── pending topper: this spin IS the wheel (free, fixed-credit wedge) ────
  if (wheel.pending) {
    const { index, raw, total } = drawWedgeIndex(def, rand)
    const wedge = def.wedges[index]!
    wheel.pending = false
    const draws: RngDraw[] = [{ label: 'wheel wedge', raw, value: index, range: total }]
    return {
      machineId: def.id,
      family: 'wheel',
      coins: 0,
      gameKind: 'wheel',
      coinsIn: 0,
      stops: [],
      grid: [],
      wins: [{
        line: 'wheel', entryId: `wedge-${wedge.credits}`, symbols: [def.wheelSymbol],
        payCredits: wedge.credits, wildCount: 0, progressive: false
      }],
      totalPayout: wedge.credits,
      progressiveEvents: [],
      featureEvents: [{ type: 'wheel-landed', wedgeIndex: index, credits: wedge.credits }],
      trace: { draws }
    }
  }

  // ── base game: the Telnaes stepper spin ──────────────────────────────────
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }

  const draws: RngDraw[] = []
  const virtualStops: VirtualStopTrace[] = []
  const stops: number[] = []
  const line: SymbolId[] = []

  def.virtualMaps.forEach((vmap, r) => {
    const raw = rand()
    const virtualIndex = Math.floor(raw * vmap.length)
    draws.push({ label: `reel${r + 1}-virtual`, raw, value: virtualIndex, range: vmap.length })
    const physicalStop = vmap[virtualIndex]!
    const symbol = def.physicalStrips[r]![physicalStop]!
    stops.push(physicalStop)
    line.push(symbol)
    virtualStops.push({
      reel: r, virtualIndex, virtualSize: vmap.length,
      physicalStop, symbol, weight: reelWeights(def)[r]!.get(symbol)!
    })
  })

  const grid: SymbolId[][] = def.physicalStrips.map((strip, r) => {
    const s = stops[r]!
    const len = strip.length
    return [strip[(s - 1 + len) % len]!, strip[s]!, strip[(s + 1) % len]!]
  })

  const wins: SpinOutcome['wins'] = []
  const featureEvents: SpinOutcome['featureEvents'] = []
  const result = bestStepperAward(line, def)
  if (result !== null) {
    wins.push({
      line: 'payline', entryId: result.entry.id, symbols: [...line],
      payCredits: result.payCredits * coins, wildCount: result.wildCount, progressive: false
    })
  }

  if (line[2] === def.wheelSymbol) {
    if (coins === def.maxCoins) {
      wheel.pending = true
      featureEvents.push({ type: 'wheel-armed' })
    } else {
      // The honest sting a real cabinet omits: the wheel landed, the bet
      // didn't qualify. Nothing pays, nothing arms — and the UI says so.
      featureEvents.push({ type: 'wheel-wasted' })
    }
  }

  return {
    machineId: def.id,
    family: 'wheel',
    coins,
    gameKind: 'base',
    coinsIn: coins,
    stops,
    grid,
    wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents: [],
    featureEvents,
    trace: { draws, virtualStops }
  }
}
