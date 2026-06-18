import { describe, it, expect } from 'vitest'
import { blackjackReelExactRtp } from '../app/engine/blackjackReelRtp'
import { validateMachineDef } from '../app/engine/validate'
import { FLAMEOUT_21 } from '../app/machines/flameout-21'

describe('Flameout 21 — calibrated figures', () => {
  const r = blackjackReelExactRtp(FLAMEOUT_21)
  it('validates', () => {
    expect(() => validateMachineDef(FLAMEOUT_21)).not.toThrow()
  })
  it('RTP frozen at the calibrated ~97%', () => {
    // Calibrated exact rtpPerCoin (scripts/calibrate-flameout21.ts, sL=0.36/sV=0.70/nat=2.0).
    expect(r.rtpPerCoin).toBeCloseTo(0.9695906397184516, 4)
  })
  it('the launch catch-all is below x1.0 (RTP >= E[launch] forces sub-1 launches)', () => {
    const catchAll = FLAMEOUT_21.launchTable.find(e => e.atLeast <= 0)!
    expect(catchAll.mult).toBeLessThan(1)
  })
  it('a natural launches higher than the best non-natural launch', () => {
    const maxLaunch = Math.max(...FLAMEOUT_21.launchTable.map(e => e.mult))
    expect(FLAMEOUT_21.naturalLaunch).toBeGreaterThan(maxLaunch)
  })
})
