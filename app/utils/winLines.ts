// app/utils/winLines.ts
import type { MachineDef, SpinOutcome } from '~/engine'

export interface WinLine {
  lineNumber: number | null
  count: number
  symbolId: string
  symbolName: string
  pluralName: string
  payout: number
  pattern: number[] | null
  cells: { reel: number, row: number }[]
  kind: 'line' | 'ways' | 'single'
  color: string
}

const PALETTE = ['#f59e0b', '#38bdf8', '#f472b6', '#34d399', '#a78bfa', '#fb7185', '#facc15', '#22d3ee', '#c084fc']

export function pluralize(label: string): string {
  if (/[^aeiou]y$/i.test(label)) return label.replace(/y$/i, 'ies')
  if (/(s|x|ch|sh)$/i.test(label)) return label + 'es'
  return label + 's'
}

function symbolName(def: MachineDef, id: string): string {
  return (def.symbols as Record<string, { label: string }>)[id]?.label ?? id
}

/** Turn an engine outcome's wins into ordered, colour-tagged display rows. */
export function summariseWins(def: MachineDef, outcome: SpinOutcome | null): WinLine[] {
  if (outcome === null || !Array.isArray(outcome.wins) || outcome.wins.length === 0) return []
  const lines = def.family === 'video' && def.betMode.kind === 'lines' ? def.betMode.lines : null
  const wild = (def as { wildSymbol?: string | null }).wildSymbol ?? null
  const grid = Array.isArray(outcome.grid) ? outcome.grid : []
  // Feature/jackpot payouts (hold-and-spin, grand) carry symbols:[] — they are
  // conveyed by the gross WIN total, not a per-line chip, so drop them here.
  return outcome.wins.filter(w => w.symbols.length > 0).map((w, i) => {
    const color = PALETTE[i % PALETTE.length]!
    const symbolId = w.symbols[0] ?? ''
    const name = symbolName(def, symbolId)
    const count = w.symbols.length
    const payout = w.payCredits ?? 0
    const base = { count, symbolId, symbolName: name, pluralName: pluralize(name), payout, color }
    if (w.line === 'scatter') {
      // Scatters pay from any reel/any row and are NOT wild-substituted. Glow
      // every cell holding the scatter symbol; mark `ways` so no line is drawn.
      const cells: { reel: number, row: number }[] = []
      grid.forEach((col, reel) => col.forEach((cell, row) => {
        if (cell === symbolId) cells.push({ reel, row })
      }))
      return { ...base, lineNumber: null, pattern: null, cells, kind: 'ways' as const }
    }
    const lineMatch = /^line-(\d+)$/.exec(w.line)
    if (lineMatch !== null && lines !== null) {
      const lineNumber = Number(lineMatch[1])
      const pattern = lines[lineNumber - 1] ?? null
      // The video engine fills `symbols` with the FULL line cells (all reels),
      // not the matched run. Derive the real left-anchored run (wild-substituted)
      // so count / name / glow reflect the actual win, not the whole payline.
      const paySym = w.symbols.find(s => s !== wild) ?? w.symbols[0] ?? ''
      let run = 0
      for (const s of w.symbols) {
        if (s === paySym || (wild !== null && s === wild)) run++
        else break
      }
      const payName = symbolName(def, paySym)
      const cells = pattern === null ? [] : pattern.slice(0, run).map((row, reel) => ({ reel, row }))
      return { lineNumber, count: run, symbolId: paySym, symbolName: payName, pluralName: pluralize(payName), payout, pattern, cells, kind: 'line' as const, color }
    }
    if (w.line.startsWith('ways')) {
      // Ways wins are left-anchored: scan only the first `symbols.length` reels
      // so a later reappearance of the symbol past the run doesn't over-glow.
      const cells: { reel: number, row: number }[] = []
      grid.slice(0, w.symbols.length).forEach((col, reel) => col.forEach((cell, row) => {
        if (cell === symbolId || (wild !== null && cell === wild)) cells.push({ reel, row })
      }))
      return { ...base, lineNumber: null, pattern: null, cells, kind: 'ways' as const }
    }
    // Single payline (stepper 'payline' / bally 'center'|'top'|'bottom'). The
    // engine fills `symbols` with the full payline, so derive the true win size
    // and the winning cells from the paytable entry: `count` (n anywhere, e.g.
    // cherries), `run` (left-anchored length), or a whole-line kind.
    const row = w.line === 'top' ? 0 : w.line === 'bottom' ? 2 : 1
    const entry = (def as { paytable?: { id: string, kind: string, symbol?: string, n?: number, length?: number }[] })
      .paytable?.find(e => e.id === w.entryId)
    const reels = w.symbols.length
    let winReels: number[]
    let paySym: string
    if (entry?.kind === 'count' && entry.symbol !== undefined) {
      paySym = entry.symbol
      // 'count' awards tally the literal symbol only — the engine does NOT
      // wild-substitute them (awards.ts: line.filter(s => s === entry.symbol)),
      // so a wild on the line must not inflate the count or glow as a win cell.
      winReels = w.symbols.flatMap((s, r) => s === entry.symbol ? [r] : [])
    } else if (entry?.kind === 'run' && entry.length !== undefined) {
      paySym = entry.symbol ?? symbolId
      winReels = Array.from({ length: Math.min(entry.length, reels) }, (_, r) => r)
    } else {
      paySym = entry?.symbol ?? symbolId
      winReels = Array.from({ length: reels }, (_, r) => r)
    }
    let singleName = symbolName(def, paySym)
    // 'anyOf' awards (e.g. any-3-bars) aren't a single symbol; name them by the
    // shared trailing word of the set's labels ("Single/Double/Triple Bar" -> "Bar")
    // so the chip reads "3 Bars" rather than naming whichever bar landed first.
    const anyOf = entry?.kind === 'anyOf' ? (entry as { symbols?: string[] }).symbols : undefined
    if (Array.isArray(anyOf) && anyOf.length > 0) {
      const words = anyOf.map(s => symbolName(def, s).split(' ').pop() ?? '')
      if (words.every(w => w === words[0] && w !== '')) singleName = words[0]!
    }
    return {
      lineNumber: null,
      count: winReels.length,
      symbolId: paySym,
      symbolName: singleName,
      pluralName: pluralize(singleName),
      payout,
      pattern: null,
      cells: winReels.map(reel => ({ reel, row })),
      kind: 'single' as const,
      color
    }
  })
}
