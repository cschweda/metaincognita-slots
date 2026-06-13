import type { SymbolId, VideoMachineDef, VideoPayEntry } from './types'

/**
 * The classic 25-line geometry shared by the lines-mode machines (row per
 * reel, 0 = top, 2 = bottom). Coins activate indices 0..coins-1; index 0
 * (industry "Line 1") is the center row, so a 1-coin spin plays exactly the center.
 */
export const LINES25: number[][] = [
  [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2], [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
  [1, 0, 0, 0, 1], [1, 2, 2, 2, 1], [0, 0, 1, 2, 2], [2, 2, 1, 0, 0], [1, 2, 1, 0, 1],
  [1, 0, 1, 2, 1], [0, 1, 1, 1, 0], [2, 1, 1, 1, 2], [0, 1, 0, 1, 0], [2, 1, 2, 1, 2],
  [1, 1, 0, 1, 1], [1, 1, 2, 1, 1], [0, 0, 2, 0, 0], [2, 2, 0, 2, 2], [0, 2, 0, 2, 0],
  [2, 0, 2, 0, 2], [1, 0, 2, 0, 1], [1, 2, 0, 2, 1], [0, 2, 2, 2, 0], [2, 0, 0, 0, 2]
]

/** Cell shown at `row` (0..2) when the reel stopped with `stop` as its top cell. */
export function cellAt(strip: SymbolId[], stop: number, row: number): SymbolId {
  return strip[(stop + row) % strip.length]!
}

export interface VideoLineWin {
  entry: VideoPayEntry
  wildCount: number
}

/**
 * Left-anchored exact-run line evaluation. The anchor is cell 0 (wild never
 * appears on reel-1 strips); the run extends through anchor-or-wild cells;
 * the paytable entry with that exact run length pays. Runs under 3 have no
 * entries and return null.
 */
export function evalLine(
  cells: SymbolId[],
  def: { paytable: VideoPayEntry[], wildSymbol: SymbolId | null }
): VideoLineWin | null {
  const anchor = cells[0]!
  if (anchor === def.wildSymbol) return null
  let run = 1
  while (
    run < cells.length
    && (cells[run] === anchor || (def.wildSymbol !== null && cells[run] === def.wildSymbol))
  ) run++
  const entry = def.paytable.find(e => e.symbol === anchor && e.length === run)
  if (entry === undefined) return null
  let wildCount = 0
  for (let i = 1; i < run; i++) {
    if (cells[i] === def.wildSymbol) wildCount++
  }
  return { entry, wildCount }
}

export interface VideoWaysWin {
  entry: VideoPayEntry
  ways: number
  payCredits: number
}

/**
 * 243-ways evaluation: per paying symbol, n[r] = count of symbol-or-wild cells
 * in reel r's window; the maximal prefix with all n[r] >= 1 is the run; the
 * win is pay x prod(n[r]). Anchored: reel 1 must show the symbol itself
 * (wilds never appear on reel-1 strips). Each symbol pays only its longest run.
 */
export function evalWays(def: VideoMachineDef, stops: number[]): VideoWaysWin[] {
  const wins: VideoWaysWin[] = []
  const seen = new Set<SymbolId>()
  for (const probe of def.paytable) {
    if (seen.has(probe.symbol)) continue
    seen.add(probe.symbol)
    let run = 0
    let ways = 1
    for (let r = 0; r < def.strips.length; r++) {
      let n = 0
      for (let row = 0; row < 3; row++) {
        const c = cellAt(def.strips[r]!, stops[r]!, row)
        if (c === probe.symbol || (def.wildSymbol !== null && c === def.wildSymbol)) n++
      }
      if (n === 0) break
      run++
      ways *= n
    }
    if (run < 3) continue
    const entry = def.paytable.find(e => e.symbol === probe.symbol && e.length === run)
    if (entry === undefined) continue
    wins.push({ entry, ways, payCredits: entry.pay * ways })
  }
  return wins
}

/** Number of reels whose window shows the scatter (spacing >= 3 keeps it 0/1 per reel). */
export function scatterVisibleCount(def: VideoMachineDef, stops: number[]): number {
  if (def.scatter === null) return 0
  let k = 0
  for (let r = 0; r < def.strips.length; r++) {
    for (let row = 0; row < 3; row++) {
      if (cellAt(def.strips[r]!, stops[r]!, row) === def.scatter.symbol) {
        k++
        break
      }
    }
  }
  return k
}

export interface OrbCellHit {
  /** 15-cell grid index = reel * 3 + row */
  cell: number
  reel: number
  row: number
}

export function orbCells(def: VideoMachineDef, stops: number[]): OrbCellHit[] {
  if (def.holdAndSpin === null) return []
  const out: OrbCellHit[] = []
  for (let r = 0; r < def.strips.length; r++) {
    for (let row = 0; row < 3; row++) {
      if (cellAt(def.strips[r]!, stops[r]!, row) === def.holdAndSpin.orbSymbol) {
        out.push({ cell: r * 3 + row, reel: r, row })
      }
    }
  }
  return out
}
