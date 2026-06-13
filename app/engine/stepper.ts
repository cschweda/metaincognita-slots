import type {
  LineWin, MachineSessionState, ProgressiveEvent, RngDraw,
  SpinOutcome, StepperMachineDef, SymbolId, VirtualStopTrace
} from './types'
import type { RandomFn } from './rng'
import { bestStepperAward } from './awards'

/**
 * Telnaes weight of a symbol on a reel = entries in the virtual map showing it.
 * Memoized per def — spins run in multi-million-spin simulation loops, so the
 * O(virtualMap) count must not execute per spin.
 */
const weightCache = new WeakMap<StepperMachineDef, Map<SymbolId, number>[]>()

function reelWeights(def: StepperMachineDef): Map<SymbolId, number>[] {
  let cached = weightCache.get(def)
  if (cached === undefined) {
    cached = def.virtualMaps.map((vmap, r) => {
      const strip = def.physicalStrips[r]!
      const w = new Map<SymbolId, number>()
      for (const p of vmap) {
        const s = strip[p]!
        w.set(s, (w.get(s) ?? 0) + 1)
      }
      return w
    })
    weightCache.set(def, cached)
  }
  return cached
}

/**
 * Spin a Telnaes-stepper. The RNG draws uniformly over the virtual map; the
 * mapped physical stop is what the player sees. Mutates state.progressive on
 * a progressive hit; coin-in feeding happens outside spin.
 */
export function spinStepper(
  def: StepperMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
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

  const wins: LineWin[] = []
  const progressiveEvents: ProgressiveEvent[] = []
  const result = bestStepperAward(line, def)

  if (result !== null) {
    const e = result.entry
    let payCredits: number
    let isProgressive = false
    if (e.kind === 'allSame' && e.progressiveAtMaxCoins === true
      && coins === def.maxCoins && state.progressive?.kind === 'percent') {
      const prog = state.progressive
      payCredits = Math.floor(prog.value)
      if (def.progressive !== null) prog.value = def.progressive.reset
      progressiveEvents.push({ type: 'hit', meter: 'percent', amountCredits: payCredits })
      isProgressive = true
    } else {
      payCredits = result.payCredits * coins
    }
    wins.push({
      line: 'payline', entryId: e.id, symbols: [...line],
      payCredits, wildCount: result.wildCount, progressive: isProgressive
    })
  }

  return {
    machineId: def.id,
    family: 'stepper',
    coins,
    gameKind: 'base',
    coinsIn: coins,
    stops,
    grid,
    wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents,
    featureEvents: [],
    trace: { draws, virtualStops }
  }
}
