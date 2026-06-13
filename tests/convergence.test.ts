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

// E-1202 static mode pays 5000/1000 alternating (mean 3000 = the exact
// liveAverage); its realized jackpot variance differs from the flat-3000
// enumeration, but P(hit) = 1/5.15M makes the effect ~0 at this N.
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
      const se = Math.sqrt(exact.variancePerCoin / (c.spins * c.coins))
      expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(3.5 * se)
      // hit frequency: binomial SE
      const hfSe = Math.sqrt(exact.hitFrequency * (1 - exact.hitFrequency) / c.spins)
      expect(Math.abs(sim.hitRate - exact.hitFrequency)).toBeLessThan(3.5 * hfSe)
    })
  }

  it('series-e-3line at 3 coins converges to the same per-coin RTP (loose band, correlated lines)', () => {
    const exact = exactRtp(SERIES_E_3LINE)
    const sim = simulateMachine(SERIES_E_3LINE, {
      spins: 2_000_000, coins: 3, seed: 1005, progressiveMode: 'static'
    })
    expect(Math.abs(sim.rtp - exact.rtpPerCoin)).toBeLessThan(0.01)
  })

  it('jackpots actually occur at the expected rate (series-e-multiplier)', () => {
    // P(4xS7) = 1/24,414 -> ~82 expected hits in 2M spins; assert a wide Poisson band.
    const sim = simulateMachine(SERIES_E_MULTIPLIER, {
      spins: 2_000_000, coins: 3, seed: 1004, progressiveMode: 'static'
    })
    expect(sim.jackpotHits).toBeGreaterThan(40)
    expect(sim.jackpotHits).toBeLessThan(140)
  })
})
