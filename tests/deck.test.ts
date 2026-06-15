import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../app/engine/rng'
import { buildDeck, shuffle, cardValue, isAce, cardSuit } from '../app/engine/deck'

describe('deck', () => {
  it('builds 52 unique cards', () => {
    const d = buildDeck()
    expect(d.length).toBe(52)
    expect(new Set(d).size).toBe(52)
  })
  it('values cards by blackjack rules', () => {
    expect(cardValue('AS')).toBe(11)
    expect(cardValue('TH')).toBe(10)
    expect(cardValue('KD')).toBe(10)
    expect(cardValue('7C')).toBe(7)
    expect(isAce('AS')).toBe(true)
    expect(isAce('2S')).toBe(false)
    expect(cardSuit('AH')).toBe('H')
  })
  it('shuffle is a permutation and seed-deterministic', () => {
    const a = shuffle(buildDeck(), mulberry32(1))
    const b = shuffle(buildDeck(), mulberry32(1))
    expect(a).toEqual(b) // same seed → same order
    expect([...a].sort()).toEqual(buildDeck().sort()) // permutation
  })
})
