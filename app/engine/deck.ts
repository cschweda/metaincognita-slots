import type { RandomFn } from './rng'
import type { SymbolId } from './types'

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'] as const
const SUITS = ['S', 'H', 'D', 'C'] as const

export function buildDeck(): SymbolId[] {
  const d: SymbolId[] = []
  for (const s of SUITS) for (const r of RANKS) d.push(`${r}${s}`)
  return d
}

export function shuffle(cards: SymbolId[], rand: RandomFn): SymbolId[] {
  const a = [...cards]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = a[i]!
    a[i] = a[j]!
    a[j] = tmp
  }
  return a
}

export function cardRank(id: SymbolId): string {
  return id.slice(0, -1)
}

export function cardSuit(id: SymbolId): 'S' | 'H' | 'D' | 'C' {
  return id.slice(-1) as 'S' | 'H' | 'D' | 'C'
}

export function cardColor(id: SymbolId): 'red' | 'black' {
  const s = cardSuit(id)
  return s === 'H' || s === 'D' ? 'red' : 'black'
}

export function isAce(id: SymbolId): boolean {
  return cardRank(id) === 'A'
}

export function cardValue(id: SymbolId): number {
  const r = cardRank(id)
  if (r === 'A') return 11
  if (r === 'T' || r === 'J' || r === 'Q' || r === 'K') return 10
  return Number(r)
}
