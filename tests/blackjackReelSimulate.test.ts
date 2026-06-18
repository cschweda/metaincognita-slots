import { describe, it, expect } from 'vitest'
import { simulateMachine } from '../app/engine'
import { blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'
import { FLAMEOUT_21 } from '../app/machines/flameout-21'

describe('Flameout 21 simulation', () => {
  it('converges near the exact DP and never stalls', () => {
    const sim = simulateMachine(FLAMEOUT_21, { spins: 200000, coins: 1, seed: 7, progressiveMode: 'static' })
    const exact = blackjackReelExactRtp(FLAMEOUT_21)
    expect(Number.isFinite(sim.rtp)).toBe(true)
    expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(0.03)
  })
})
