import { describe, it, expect } from 'vitest'
import { validateMachineDef } from '../app/engine/validate'
import { cascadeExactRtp } from '../app/engine/cascadeRtp'
import { TEMPLE_OF_GOLD } from '../app/machines/temple-of-gold'

/**
 * Frozen math for Temple of Gold (the Featured cascade). The exact values are
 * the absorbing-Markov tumble DP's output; `pnpm verify` re-confirms them
 * against a 5M-spin simulation within 3.5σ (de-risked: Δrtp 0.012% ≪ 0.40%).
 */
describe('Temple of Gold (cascade)', () => {
  it('is a structurally valid cascade def', () => {
    expect(() => validateMachineDef(TEMPLE_OF_GOLD)).not.toThrow()
  })

  it('freezes the exact RTP, hit frequency and variance', () => {
    const e = cascadeExactRtp(TEMPLE_OF_GOLD, { coins: TEMPLE_OF_GOLD.maxCoins })
    expect(e.rtpPerCoin).toBeCloseTo(0.908961, 6)
    expect(e.hitFrequency).toBeCloseTo(0.355257, 6)
    expect(e.variancePerCoin).toBeCloseTo(6.507747, 4)
  })

  it('sits in the floor ~90% RTP band', () => {
    const e = cascadeExactRtp(TEMPLE_OF_GOLD, { coins: TEMPLE_OF_GOLD.maxCoins })
    expect(e.rtpPerCoin).toBeGreaterThan(0.88)
    expect(e.rtpPerCoin).toBeLessThan(0.92)
  })

  it('earns most of its return from the tumble chains, with a rare Grand', () => {
    const e = cascadeExactRtp(TEMPLE_OF_GOLD, { coins: TEMPLE_OF_GOLD.maxCoins })
    const tumble = e.breakdown.find(b => b.entryId === 'tumble')
    expect(tumble?.contribution).toBeGreaterThan(0.5) // the "down, down, down" payoff
    const grand = e.breakdown.find(b => b.entryId === 'grand')
    expect(grand?.probability).toBeLessThan(1e-4) // a rare carrot
  })
})
