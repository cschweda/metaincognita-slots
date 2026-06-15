import { describe, expect, it } from 'vitest'
import type { BlackjackReelMachineDef, BlackjackReelSessionState } from '../app/engine/types'

// Lucky 21: Task 1 — type shape test. Old Hit-or-Bust engine tests removed;
// restored progressively in Tasks 3–5.

describe('lucky-21 types', () => {
  it('has the lucky-21 def shape', () => {
    const d: Pick<BlackjackReelMachineDef, 'family' | 'qualifyMin' | 'charlieMultiplier'>
      = { family: 'blackjack-reel', qualifyMin: 15, charlieMultiplier: 3 }
    expect(d.qualifyMin).toBe(15)
  })

  it('has the lucky-21 session state shape', () => {
    const s: BlackjackReelSessionState = {
      phase: 'idle',
      reelStrips: [],
      landed: [null, null, null, null, null],
      idx: 0,
      hand: [],
      hard: 0,
      aces: 0,
      multSum: 0,
      bestTotal: 0,
      natural: false,
      busted: false,
      bustBySymbol: false,
      charlie: false,
      ante: 0
    }
    expect(s.phase).toBe('idle')
    expect(s.landed).toHaveLength(5)
  })
})
