import type {
  BallyEmMachineDef, LineWin, MachineSessionState, ProgressiveEvent,
  RngDraw, SpinOutcome, SymbolId
} from './types'
import type { RandomFn } from './rng'
import { ballyAwardForLine } from './awards'

const LINE_ROWS: Record<string, number> = { center: 1, top: 0, bottom: 2 }
const LINES_FOR_COINS = [['center'], ['center', 'top'], ['center', 'top', 'bottom']]

/**
 * Spin a uniform-stop Bally-EM machine. Mutates state.progressive on a
 * progressive hit (meter resets); coin-in feeding happens OUTSIDE spin
 * (simulateMachine / the Pinia store tick the controller per coin).
 */
export function spinBallyEm(
  def: BallyEmMachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }

  const draws: RngDraw[] = []
  const stops = def.strips.map((_, r) => {
    const raw = rand()
    const value = Math.floor(raw * def.stops)
    draws.push({ label: `reel${r + 1}-stop`, raw, value, range: def.stops })
    return value
  })

  const grid: SymbolId[][] = def.strips.map((strip, r) => {
    const s = stops[r]!
    return [strip[s]!, strip[(s + 1) % def.stops]!, strip[(s + 2) % def.stops]!]
  })

  const lines = def.payMode === 'lines' ? LINES_FOR_COINS[coins - 1]! : ['center']
  const wins: LineWin[] = []
  const progressiveEvents: ProgressiveEvent[] = []

  for (const lineName of lines) {
    const row = LINE_ROWS[lineName]!
    const lineSymbols = grid.map(col => col[row]!)
    const entry = ballyAwardForLine(lineSymbols, def.paytable)
    if (entry === null) continue

    let payCredits: number
    let isProgressive = false

    if (entry.kind === 'run' && entry.progressive === 'live' && state.progressive?.kind === 'dual') {
      const prog = state.progressive
      const meter = prog.live
      payCredits = meter === 'upper' ? prog.upper : prog.lower
      const cfg = def.progressive!
      if (cfg.kind === 'dual') {
        if (meter === 'upper') prog.upper = cfg.upper.reset
        else prog.lower = cfg.lower.reset
      }
      progressiveEvents.push({ type: 'hit', meter, amountCredits: payCredits })
      isProgressive = true
    } else if (entry.kind === 'run' && entry.progressive === 'maxCoins' && coins === def.maxCoins
      && state.progressive?.kind === 'single') {
      const prog = state.progressive
      // floored: single/percent meters accumulate fractional credits from
      // rate feeds; dual meters are integer-fed and pay raw values
      payCredits = Math.floor(prog.value)
      if (def.progressive?.kind === 'single') prog.value = def.progressive.meter.reset
      progressiveEvents.push({ type: 'hit', meter: 'single', amountCredits: payCredits })
      isProgressive = true
    } else {
      payCredits = def.payMode === 'multiplier' ? entry.pay * coins : entry.pay
    }

    wins.push({
      line: lineName, entryId: entry.id, symbols: lineSymbols,
      payCredits, wildCount: 0, progressive: isProgressive
    })
  }

  return {
    machineId: def.id,
    family: 'bally-em',
    coins,
    stops,
    grid,
    wins,
    totalPayout: wins.reduce((s, w) => s + w.payCredits, 0),
    progressiveEvents,
    trace: { draws }
  }
}
