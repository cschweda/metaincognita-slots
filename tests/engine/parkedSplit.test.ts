import { describe, expect, it } from 'vitest'
import { exactRtp } from '../../app/engine'
import { SEVENS_ABLAZE } from '../../app/machines/sevens-ablaze'
import { FLAMEOUT_21 } from '../../app/machines/flameout-21'
import { STOP_AND_LOCK_777 } from '../../app/machines/stop-and-lock-777'

describe('parked engine split', () => {
  it('floor families need no parked import', () => {
    expect(exactRtp(SEVENS_ABLAZE).rtpPerCoin).toBeGreaterThan(0.9)
  })

  it('parked families resolve through the registered solvers once ~/engine/parked loads', async () => {
    await import('../../app/engine/parked')
    // Exact values are frozen in the family suites; here we assert the
    // registry dispatches to the real DPs (plausible sub-100% RTPs, not junk).
    const flameout = exactRtp(FLAMEOUT_21).rtpPerCoin
    expect(flameout).toBeGreaterThan(0.9)
    expect(flameout).toBeLessThan(1)
    expect(exactRtp(STOP_AND_LOCK_777).rtpPerCoin).toBeCloseTo(0.945073, 4)
  })
})
