import type { MachineDef, SpinOutcome, StepperMachineDef, SymbolId } from './types'

/**
 * Presentational near-miss analysis, derived from the outcome AFTER the fact.
 * Pure and read-only: the engine never biases stops toward near-misses — on
 * weighted machines teases are an emergent property of strip design, on
 * uniform machines they don't exist, and this module says exactly that.
 */

export type NearMissKind
  = 'engineered-tease' | 'two-of-three' | 'uniform-truth'
    | 'one-scatter-short' | 'one-orb-short' | 'one-row-off' | 'flag-stocked'

export interface NearMissCallout {
  kind: NearMissKind
  message: string
  /** reel indices the callout points at (UI highlights) */
  reels?: number[]
}

function topStepperSymbol(def: StepperMachineDef): { symbol: SymbolId, label: string } | null {
  let best: { symbol: SymbolId, pay: number } | null = null
  for (const e of def.paytable) {
    if (e.kind === 'allWild' && def.wildSymbol !== null) {
      if (best === null || e.pay > best.pay) best = { symbol: def.wildSymbol, pay: e.pay }
    } else if (e.kind === 'allSame') {
      if (best === null || e.pay > best.pay) best = { symbol: e.symbol, pay: e.pay }
    }
  }
  return best === null ? null : { symbol: best.symbol, label: def.symbols[best.symbol]?.label ?? best.symbol }
}

function stepperCallouts(def: StepperMachineDef, out: SpinOutcome): NearMissCallout[] {
  const top = topStepperSymbol(def)
  if (top === null) return []
  const topInvolved = out.wins.some(w => w.symbols.includes(top.symbol))
  if (topInvolved) return []
  const calls: NearMissCallout[] = []
  const teaseReels: number[] = []
  let onLine = 0
  out.grid.forEach((col, r) => {
    if (col[1] === top.symbol) onLine++
    else if (col[0] === top.symbol || col[2] === top.symbol) teaseReels.push(r)
  })
  if (teaseReels.length > 0) {
    const r = teaseReels[0]!
    const col = out.grid[r]!
    const len = def.physicalStrips[r]!.length
    const size = def.virtualMaps[r]!.length
    // Determine which row (0 or 2) the tease symbol occupies and its physical stop
    const teaseRow = col[0] === top.symbol ? 0 : 2
    const teasePhys = teaseRow === 0
      ? (out.stops[r]! - 1 + len) % len
      : (out.stops[r]! + 1) % len
    // Build per-stop virtual-weight array for reel r
    const vw = new Array<number>(len).fill(0)
    for (const idx of def.virtualMaps[r]!) vw[idx] = (vw[idx] ?? 0) + 1
    // The symbol that actually landed on the payline (row 1)
    const lineSym = col[1]!
    calls.push({
      kind: 'engineered-tease',
      reels: teaseReels,
      message: `${top.label} sits one stop off the payline on reel ${r + 1} — its virtual weight there is ${vw[teasePhys]!} of ${size}, while the ${def.symbols[lineSym]?.label ?? lineSym} that landed carries ${vw[out.stops[r]!]!}. Telnaes machines are BUILT to show you this.`
    })
  }
  if (onLine === out.grid.length - 1) {
    calls.push({
      kind: 'two-of-three',
      message: `${onLine} of ${out.grid.length} ${top.label} symbols ON the payline. The odds of the `
        + 'last one were never what the reels made it feel like.'
    })
  }
  return calls
}

function ballyCallouts(def: MachineDef & { family: 'bally-em' }, out: SpinOutcome): NearMissCallout[] {
  const jackpotSymbol = def.paytable[0]?.symbol
  if (jackpotSymbol === undefined) return []
  const label = def.symbols[jackpotSymbol]?.label ?? jackpotSymbol
  const visible = out.grid.some(col => col[1] === jackpotSymbol)
  if (!visible) return []
  return [{
    kind: 'uniform-truth',
    message: `${label} ON the payline — and that is ALL it means. `
      + `These reels are uniform physical stops (every stop exactly 1/${def.stops}); nothing here is `
      + 'engineered to tease. 1980 honesty.'
  }]
}

function videoCallouts(def: MachineDef & { family: 'video' }, out: SpinOutcome): NearMissCallout[] {
  if (out.gameKind === 'respin') return []
  const calls: NearMissCallout[] = []
  if (def.scatter !== null && def.scatter.triggerCount !== null) {
    let k = 0
    for (const col of out.grid) {
      if (col.includes(def.scatter.symbol)) k++
    }
    if (k === def.scatter.triggerCount - 1) {
      calls.push({
        kind: 'one-scatter-short',
        message: `${k} scatters — one short of the feature. Scatter placement is one per reel window by `
          + 'design; the PAR sheet shows the exact trigger odds.'
      })
    }
  }
  if (def.holdAndSpin !== null && out.gameKind === 'base') {
    let t = 0
    for (const col of out.grid) {
      for (const cell of col) {
        if (cell === def.holdAndSpin.orbSymbol) t++
      }
    }
    if (t === def.holdAndSpin.triggerCount - 1) {
      calls.push({
        kind: 'one-orb-short',
        message: `${t} orbs — one short of hold-and-spin. P(trigger) is on the PAR sheet; it did not `
          + 'get closer because this screen looked close.'
      })
    }
  }
  if (def.betMode.kind === 'lines') {
    for (const w of out.wins) {
      const m = /^line-(\d+)$/.exec(w.line)
      const entry = def.paytable.find(e => e.id === w.entryId)
      if (m === null || w.symbols.length === 0 || entry === undefined || entry.length !== 4) continue
      const pattern = def.betMode.lines[Number(m[1]) - 1]
      if (pattern === undefined) continue
      const row = pattern[4]!
      const sym = w.symbols[0]!
      const col = out.grid[4]!
      if ((row > 0 && col[row - 1] === sym) || (row < 2 && col[row + 1] === sym)) {
        calls.push({
          kind: 'one-row-off',
          reels: [4],
          message: `Four ${def.symbols[sym]?.label ?? sym} paid — and the fifth is sitting one row off the `
            + 'line on reel 5. Rows are independent uniform draws; it was never "almost".'
        })
        break
      }
    }
  }
  return calls
}

function pachisloCallouts(def: MachineDef & { family: 'pachislo' }, out: SpinOutcome): NearMissCallout[] {
  const stocked = out.featureEvents.find(e => e.type === 'flag-stocked')
  if (stocked === undefined || stocked.type !== 'flag-stocked') return []
  const slips = (out.trace.presses ?? []).map(p => p.slipUsed).join('/')
  return [{
    kind: 'flag-stocked',
    message: `${stocked.flag} is flagged and STOCKED — your timing kept it off the lines this game `
      + `(slips ${slips}), but it cannot be lost. It will land; the lottery already decided.`
  }]
}

export function nearMisses(def: MachineDef, out: SpinOutcome): NearMissCallout[] {
  switch (def.family) {
    case 'stepper':
      return stepperCallouts(def, out)
    case 'bally-em':
      return ballyCallouts(def, out)
    case 'video':
      return videoCallouts(def, out)
    case 'pachislo':
      return pachisloCallouts(def, out)
    case 'blackjack-reel':
      return []
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled machine family: ${(exhaustive as MachineDef).family}`)
    }
  }
}
