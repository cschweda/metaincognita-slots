import { describe, it, expect } from 'vitest'
import { exactRtp, simulateMachine } from '../app/engine'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'
import { SERIES_E_3LINE } from '../app/machines/series-e-3line'
import { SERIES_E_MULTIPLIER } from '../app/machines/series-e-multiplier'
import type { MachineDef } from '../app/engine'

interface Case {
  def: MachineDef
  coins: number
  spins: number
  seed: number
}

// E-1202 static mode never advances the FO-5140 toggle (meters are fed only
// in 'live' mode), so a static jackpot always pays the upper reset (5000) vs
// the enumeration's 3000 live-average -- a +0.039% modeled gap that cannot
// breach a 3.5-sigma band below ~3.5e9 spins. P(hit) = 1/5.15M makes it ~0 here.
const CASES: Case[] = [
  { def: DIAMOND_DOUBLER, coins: 1, spins: 4_000_000, seed: 1001 },
  { def: SEVENS_ABLAZE, coins: 2, spins: 4_000_000, seed: 1002 },
  { def: SERIES_E_3LINE, coins: 1, spins: 2_000_000, seed: 1003 },
  { def: SERIES_E_MULTIPLIER, coins: 3, spins: 2_000_000, seed: 1004 }
]

describe('convergence: simulation reproduces exact math', () => {
  for (const c of CASES) {
    it(`${c.def.id} @${c.coins} coin(s), ${c.spins.toLocaleString()} spins`, () => {
      const exact = exactRtp(c.def, { coins: c.coins })
      const sim = simulateMachine(c.def, {
        spins: c.spins, coins: c.coins, seed: c.seed, progressiveMode: 'static'
      })
      // SE divisor is spins, not spins x coins: per-coin pay is identical for
      // every coin of a spin on these machines (coins-linear), so within-spin
      // coins are perfectly correlated and add no independent samples
      const se = Math.sqrt(exact.variancePerCoin / c.spins)
      expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(3.5 * se)
      // hit frequency: binomial SE
      const hfSe = Math.sqrt(exact.hitFrequency * (1 - exact.hitFrequency) / c.spins)
      expect(Math.abs(sim.hitRate - exact.hitFrequency)).toBeLessThan(3.5 * hfSe)
    })
  }

  it('series-e-3line at 3 coins converges to the same per-coin RTP (loose band, correlated lines)', () => {
    const exact = exactRtp(SERIES_E_3LINE, { coins: 3 })
    // seed deliberately distinct from the strict 1-coin case above
    const sim = simulateMachine(SERIES_E_3LINE, {
      spins: 2_000_000, coins: 3, seed: 1005, progressiveMode: 'static'
    })
    expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(0.01)
  })

  it('jackpots actually occur at the expected rate (series-e-multiplier)', () => {
    // P(4xS7) = 1/24,414 -> lambda ~82 hits in 2M spins (sigma ~9). Bounds sit
    // ~3 sigma out so the fixed seed never flakes, yet both a half-rate and a
    // double-rate jackpot regression land outside the band.
    const sim = simulateMachine(SERIES_E_MULTIPLIER, {
      spins: 2_000_000, coins: 3, seed: 1004, progressiveMode: 'static'
    })
    expect(sim.jackpotHits).toBeGreaterThan(55)
    expect(sim.jackpotHits).toBeLessThan(110)
  })
})
