import { describe, expect, it } from 'vitest'
import { exactRtp } from '../../app/engine'
import { DIAMOND_DOUBLER } from '../../app/machines/diamond-doubler'
import { STOCK_RUSH } from '../../app/machines/stock-rush'
import { exactRtpAsync, ldwExperimentAsync, peekExactRtp } from '../../app/utils/rtpClient'
import { runLdwExperiment } from '../../app/utils/ldwExperiment'

// node env has no Worker global → these tests exercise the sync fallback,
// which is exactly the path SSG and every component test relies on.
describe('rtpClient (no-Worker fallback)', () => {
  it('resolves the same report the sync engine produces, and caches it', async () => {
    expect(peekExactRtp(DIAMOND_DOUBLER)).toBeNull()
    const viaClient = await exactRtpAsync(DIAMOND_DOUBLER)
    expect(viaClient).toEqual(exactRtp(DIAMOND_DOUBLER))
    expect(peekExactRtp(DIAMOND_DOUBLER)).toBe(viaClient) // cached object identity
    expect(await exactRtpAsync(DIAMOND_DOUBLER)).toBe(viaClient)
  })

  it('fallback populates the cache synchronously (before awaiting)', () => {
    void exactRtpAsync(DIAMOND_DOUBLER, { coins: 2 })
    expect(peekExactRtp(DIAMOND_DOUBLER, { coins: 2 })).not.toBeNull()
  })

  it('keys the cache by machine and opts', async () => {
    const l4 = await exactRtpAsync(STOCK_RUSH, { oddsLevel: 4 })
    const l6 = await exactRtpAsync(STOCK_RUSH, { oddsLevel: 6 })
    expect(l4.rtpPerCoin).not.toBe(l6.rtpPerCoin)
    expect(peekExactRtp(STOCK_RUSH, { oddsLevel: 4 })).toBe(l4)
    expect(peekExactRtp(STOCK_RUSH, { oddsLevel: 6 })).toBe(l6)
  })

  it('runs the LDW experiment through the same fallback', async () => {
    expect(await ldwExperimentAsync()).toEqual(runLdwExperiment())
  })
})
