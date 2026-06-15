import { describe, expect, it } from 'vitest'
import type { BlackjackReelMachineDef, BlackjackReelSessionState } from '../app/engine/types'

describe('blackjack-reel types', () => {
  it('compiles a minimal def shape', () => {
    const def: Pick<BlackjackReelMachineDef, 'family'> = { family: 'blackjack-reel' }
    expect(def.family).toBe('blackjack-reel')
  })

  it('compiles a minimal session state shape', () => {
    const state: BlackjackReelSessionState = {
      phase: 'idle',
      cards: [],
      total: 0,
      isSoft: false,
      multSum: 0,
      saveHeld: false,
      busted: false,
      charlie: false,
      ante: 0
    }
    expect(state.phase).toBe('idle')
  })
})
