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
  return outcome.wins.map((w, i) => {
    const color = PALETTE[i % PALETTE.length]!
    const symbolId = w.symbols[0] ?? ''
    const name = symbolName(def, symbolId)
    const count = w.symbols.length
    const payout = w.payCredits ?? 0
    const base = { count, symbolId, symbolName: name, pluralName: pluralize(name), payout, color }
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
      const cells: { reel: number, row: number }[] = []
      grid.forEach((col, reel) => col.forEach((cell, row) => {
        if (cell === symbolId || (wild !== null && cell === wild)) cells.push({ reel, row })
      }))
      return { ...base, lineNumber: null, pattern: null, cells, kind: 'ways' as const }
    }
    const row = w.line === 'top' ? 0 : w.line === 'bottom' ? 2 : 1
    const cells = Array.from({ length: count }, (_, reel) => ({ reel, row }))
    return { ...base, lineNumber: null, pattern: null, cells, kind: 'single' as const }
  })
}
