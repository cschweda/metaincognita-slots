import type { PachisloMachineDef, SymbolId } from './types'

const N = 21

/** active line row-patterns by token count (manual 2.1) */
export const PACHISLO_LINES: number[][][] = [
  [[1, 1, 1]],
  [[1, 1, 1], [0, 0, 0], [2, 2, 2]],
  [[1, 1, 1], [0, 0, 0], [2, 2, 2], [0, 1, 2], [2, 1, 0]]
]

/** lines crossing reel-1's cell at `row` for this token count (cherry pays) */
export function linesThroughRow(row: number, tokens: number): number {
  let n = 0
  for (const pat of PACHISLO_LINES[tokens - 1]!) {
    if (pat[0] === row) n++
  }
  return n
}

/**
 * Stop-combo search order: total slip ascending, then lexicographic. FROZEN —
 * the planning-time service counts assume exactly this order.
 */
const DELTAS: number[][] = (() => {
  const out: number[][] = []
  for (let a = 0; a <= 4; a++) {
    for (let b = 0; b <= 4; b++) {
      for (let c = 0; c <= 4; c++) out.push([a, b, c])
    }
  }
  return out.sort((x, y) =>
    (x[0]! + x[1]! + x[2]!) - (y[0]! + y[1]! + y[2]!)
    || x[0]! - y[0]! || x[1]! - y[1]! || x[2]! - y[2]!)
})()

export type ComboFlag = 'watermelon' | 'bell' | 'replay' | 'reg' | 'big'

export type ControlTarget
  = | { kind: 'combo', flag: ComboFlag }
    | { kind: 'cherry', row: number }
    | null

export type PachisloHit
  = | { kind: 'combo', flag: ComboFlag, rows: number[] }
    | { kind: 'cherry', row: number }

function comboTriple(def: PachisloMachineDef, flag: ComboFlag): [SymbolId, SymbolId, SymbolId] {
  const r = def.roles
  switch (flag) {
    case 'watermelon': return [r.watermelon, r.watermelon, r.watermelon]
    case 'bell': return [r.bell, r.bell, r.bell]
    case 'replay': return [r.replay, r.replay, r.replay]
    case 'reg': return [r.seven, r.seven, r.bar]
    case 'big': return [r.seven, r.seven, r.seven]
  }
}

const COMBO_ORDER: ComboFlag[] = ['watermelon', 'bell', 'replay', 'reg', 'big']

function cellAt(def: PachisloMachineDef, reel: number, stop: number, row: number): SymbolId {
  return def.strips[reel]![(stop + row) % N]!
}

/** Every paying combination visible on the active lines (plus paying cherries). */
export function payingHits(def: PachisloMachineDef, stops: number[], tokens: number): PachisloHit[] {
  const hits: PachisloHit[] = []
  const lines = PACHISLO_LINES[tokens - 1]!
  for (const flag of COMBO_ORDER) {
    const combo = comboTriple(def, flag)
    for (const pat of lines) {
      if (
        cellAt(def, 0, stops[0]!, pat[0]!) === combo[0]
        && cellAt(def, 1, stops[1]!, pat[1]!) === combo[1]
        && cellAt(def, 2, stops[2]!, pat[2]!) === combo[2]
      ) {
        hits.push({ kind: 'combo', flag, rows: [...pat] })
      }
    }
  }
  for (const row of [0, 1, 2]) {
    if (linesThroughRow(row, tokens) === 0) continue
    if (cellAt(def, 0, stops[0]!, row) === def.roles.cherry) {
      hits.push({ kind: 'cherry', row })
    }
  }
  return hits
}

export interface ControlResult {
  stops: number[]
  slips: number[]
  realized: boolean
}

/**
 * Deterministic skill-stop control. From the player's press positions it
 * searches stop combos in slip order (DELTAS) and picks the FIRST that
 * realizes the target with NO other paying combination; failing that, the
 * first with no paying combination at all (the flag stays stocked). The
 * planning-time exhaustive check proves a win-free combo always exists.
 */
export function controlStops(
  def: PachisloMachineDef,
  presses: number[],
  tokens: number,
  target: ControlTarget
): ControlResult {
  let fallback: ControlResult | null = null
  for (const d of DELTAS) {
    const stops = [
      (presses[0]! + d[0]!) % N,
      (presses[1]! + d[1]!) % N,
      (presses[2]! + d[2]!) % N
    ]
    const hits = payingHits(def, stops, tokens)
    if (target === null) {
      if (hits.length === 0) return { stops, slips: [...d], realized: false }
      continue
    }
    if (target.kind === 'cherry') {
      const visible = cellAt(def, 0, stops[0]!, target.row) === def.roles.cherry
      const others = hits.filter(h => !(h.kind === 'cherry' && h.row === target.row))
      if (visible && others.length === 0) return { stops, slips: [...d], realized: true }
    } else {
      const wanted = hits.some(h =>
        h.kind === 'combo' && h.flag === target.flag
        && h.rows[0] === 1 && h.rows[1] === 1 && h.rows[2] === 1)
      const others = hits.filter(h => !(
        h.kind === 'combo' && h.flag === target.flag
        && h.rows[0] === 1 && h.rows[1] === 1 && h.rows[2] === 1))
      if (wanted && others.length === 0) return { stops, slips: [...d], realized: true }
    }
    if (hits.length === 0 && fallback === null) {
      fallback = { stops, slips: [...d], realized: false }
    }
  }
  if (fallback !== null) return fallback
  throw new Error(
    `${def.id}: control found no win-free stop for presses ${presses.join(',')} — strip invariant broken`)
}
