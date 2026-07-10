import { describe, expect, it } from 'vitest'
import { exactRtp } from '../../app/engine'
import type { ExactRtpReport, MachineDef } from '../../app/engine'
import { SEVENS_ABLAZE } from '../../app/machines/sevens-ablaze'
import { edgeOpts } from '../../app/utils/floorIntel'
import { labExpectedMath } from '../../app/utils/labMath'

// Hand-checkable fixture: $1 denom, 90% RTP, per-coin variance 25.
const fakeDef = { id: 'fake', denominationCents: 100, family: 'stepper', maxCoins: 2 } as unknown as MachineDef
const fakeReport: ExactRtpReport = { rtpPerCoin: 0.9, hitFrequency: 0.2, variancePerCoin: 25, breakdown: [] }

describe('labExpectedMath', () => {
  it('computes the no-bust expectation model by hand-checkable arithmetic', () => {
    const m = labExpectedMath(fakeDef, fakeReport, { startCredits: 100, bet: 2, spinCap: 500 })
    expect(m.perSpinCostCents).toBe(200) // 2 coins × $1
    expect(m.perSpinReturnCents).toBe(180) // × 0.9
    expect(m.perSpinLossCents).toBeCloseTo(20, 9) // the edge's toll (float math)
    expect(m.capCoinInCents).toBe(100_000) // 500 spins × $2
    expect(m.capExpectedLossCents).toBeCloseTo(10_000, 6) // × 10% edge
    expect(m.capExpectedEndCents).toBeCloseTo(0, 6) // $100 start − $100 expected loss
    expect(m.expectationBustSpins).toBe(500) // start ÷ per-spin loss
    // σ_session = bet × √(spins × var/coin) × denom = 2 × √12500 × 100¢
    expect(m.sessionSigmaCents).toBeCloseTo(2 * Math.sqrt(500 * 25) * 100, 6)
    expect(m.n0Spins).toBeCloseTo(25 / 0.1 ** 2, 6) // var / edge² = 2500
  })

  it('returns null spins-to-bust and N₀ when there is no edge', () => {
    const evenReport = { ...fakeReport, rtpPerCoin: 1 }
    const m = labExpectedMath(fakeDef, evenReport, { startCredits: 100, bet: 1, spinCap: 100 })
    expect(m.perSpinLossCents).toBe(0)
    expect(m.expectationBustSpins).toBeNull()
    expect(m.n0Spins).toBeNull()
  })

  it('holds together on a real machine and its exact report', () => {
    const report = exactRtp(SEVENS_ABLAZE)
    const m = labExpectedMath(SEVENS_ABLAZE, report, { startCredits: 100, bet: 2, spinCap: 500 })
    expect(m.perSpinCostCents).toBe(200)
    expect(m.perSpinLossCents).toBeGreaterThan(0)
    expect(m.capExpectedEndCents).toBeLessThan(100 * 100)
    expect(m.n0Spins).toBeGreaterThan(1000) // variance dwarfs a ~5% edge
  })
})

describe('edgeOpts', () => {
  it('passes coins only for the families whose exact math consumes it cheaply', () => {
    expect(edgeOpts(SEVENS_ABLAZE, 2)).toEqual({ coins: 2 })
    expect(edgeOpts({ family: 'bally-em' } as MachineDef, 3)).toEqual({ coins: 3 })
    // video exact math is the expensive 24⁵ enumeration — never fork its cache by bet
    expect(edgeOpts({ family: 'video' } as MachineDef, 10)).toEqual({})
    expect(edgeOpts({ family: 'pachislo' } as MachineDef, 2)).toEqual({})
    expect(edgeOpts(SEVENS_ABLAZE, undefined)).toEqual({})
  })
})
