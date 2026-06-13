import type { BallyAward, StepperAward, SymbolId } from './types'

export function leftRun(line: SymbolId[], symbol: SymbolId): number {
  let n = 0
  for (const s of line) {
    if (s === symbol) n++
    else break
  }
  return n
}

/** First matching entry wins. `run` matches EXACT left-run length. */
export function ballyAwardForLine(line: SymbolId[], paytable: BallyAward[]): BallyAward | null {
  for (const entry of paytable) {
    if (entry.kind === 'run') {
      if (leftRun(line, entry.symbol) === entry.length) return entry
    } else {
      if (line.every(s => s === entry.symbol)) return entry
    }
  }
  return null
}

export interface StepperLineResult {
  entry: StepperAward
  wildCount: number
  payCredits: number
}

interface StepperAwardContext {
  paytable: StepperAward[]
  wildSymbol: SymbolId | null
  wildMultiplier: number
}

/** Every entry tested; highest pay wins. See plan "Numbers provenance" for semantics. */
export function bestStepperAward(line: SymbolId[], def: StepperAwardContext): StepperLineResult | null {
  const wild = def.wildSymbol
  const nWild = wild === null ? 0 : line.filter(s => s === wild).length
  let best: StepperLineResult | null = null

  for (const entry of def.paytable) {
    let pay = 0
    let wildCount = 0

    if (entry.kind === 'allWild') {
      if (wild !== null && nWild === line.length) pay = entry.pay
    } else if (entry.kind === 'allSame') {
      if (nWild < line.length && line.every(s => s === entry.symbol || s === wild)) {
        wildCount = nWild
        pay = entry.pay * def.wildMultiplier ** wildCount
      }
    } else if (entry.kind === 'anyOf') {
      if (nWild < line.length && line.every(s => entry.symbols.includes(s) || s === wild)) {
        wildCount = nWild
        pay = entry.pay * def.wildMultiplier ** wildCount
      }
    } else {
      if (line.filter(s => s === entry.symbol).length === entry.n) pay = entry.pay
    }

    if (pay > 0 && (best === null || pay > best.payCredits)) {
      best = { entry, wildCount, payCredits: pay }
    }
  }
  return best
}
