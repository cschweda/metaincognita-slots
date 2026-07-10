// app/utils/entryLabel.ts
// Plain-English names for what the History table records as raw ids. Display
// only — the export log keeps raw ids (the machine-readable surface). Never
// throws: unknown ids and unresolvable machines fall back to the raw string,
// because old histories can hold retired machines' rows.
import type { MachineDef } from '~/engine'
import { ALL_MACHINES } from '~/machines'

export function machineName(id: string): string {
  return ALL_MACHINES.find(m => m.id === id)?.name ?? id
}

const GAME_KIND_LABELS: Record<string, string> = {
  'base': 'Base',
  'normal': 'Base',
  'free-spin': 'Free spin',
  'respin': 'Respin',
  'jac': 'JAC',
  'interlude': 'Interlude',
  'deal': 'Deal'
}

export function gameKindLabel(kind: string): string {
  return GAME_KIND_LABELS[kind] ?? kind
}

/** ids any family can emit */
const UNIVERSAL: Record<string, string> = {
  'grand': 'Grand',
  'hold-and-spin': 'Hold & Spin',
  'tumble': 'Tumble chain'
}

const PACHISLO: Record<string, string> = {
  'cherry': 'Cherry',
  'watermelon': 'Watermelon',
  'bell': 'Bell',
  'replay': 'Replay',
  'reg': 'REG bonus',
  'big': 'BIG bonus',
  'jac': 'JAC win',
  'interlude-bell': 'Interlude bell'
}

const BLACKJACK_REEL: Record<string, string> = {
  crash: 'Flamed out',
  topped: 'Topped out (reel 5)',
  cash: 'Cashed out'
}

const LOCK_REEL: Record<string, string> = {
  'collect': 'Collect',
  'base-cash': 'Base collect',
  'bonus-cash': '777 bonus cash',
  'seven-upgrade': '777 bonus 7-upgrade'
}

/** The union of pay-entry shapes across families (video entries carry no kind). */
type AnyPayEntry
  = | { id: string, kind: 'allWild' }
    | { id: string, kind: 'allSame', symbol: string }
    | { id: string, kind: 'anyOf', symbols: string[] }
    | { id: string, kind: 'count', symbol: string, n: number }
    | { id: string, kind: 'run', symbol: string, length: number }
    | { id: string, kind: 'allOf', symbol: string }
    | { id: string, symbol: string, length: number }

export function entryLabel(def: MachineDef | null, entryId: string): string {
  if (def === null) return entryId
  const universal = UNIVERSAL[entryId]
  if (universal !== undefined) return universal
  const sym = (s: string): string => def.symbols[s]?.label ?? s

  if (def.family === 'pachislo') return PACHISLO[entryId] ?? entryId
  if (def.family === 'blackjack-reel') return BLACKJACK_REEL[entryId] ?? entryId
  if (def.family === 'lock-reel') return LOCK_REEL[entryId] ?? entryId
  // cascade pays are keyed by the symbol itself
  if (def.family === 'cascade') {
    return def.symbols[entryId] !== undefined ? `${sym(entryId)} pays` : entryId
  }

  // video scatter wins: 'sc3' → "3× Gondola Scatter"
  const scMatch = /^sc(\d+)$/.exec(entryId)
  if (scMatch !== null && 'scatter' in def && def.scatter !== null) {
    return `${scMatch[1]}× ${sym(def.scatter.symbol)}`
  }

  const paytable: AnyPayEntry[] = 'paytable' in def && Array.isArray(def.paytable) ? (def.paytable as AnyPayEntry[]) : []
  const entry = paytable.find(e => e.id === entryId)
  if (entry === undefined) return entryId
  if (!('kind' in entry)) return `${entry.length}× ${sym(entry.symbol)}`
  switch (entry.kind) {
    case 'allWild': return 'All wilds'
    case 'allSame': return `3× ${sym(entry.symbol)}`
    case 'anyOf': return `Any ${entry.symbols.map(sym).join(' / ')}`
    case 'count': return `${entry.n}× ${sym(entry.symbol)}`
    case 'run': return `${entry.length}× ${sym(entry.symbol)}`
    case 'allOf': return `3× ${sym(entry.symbol)}`
  }
}
