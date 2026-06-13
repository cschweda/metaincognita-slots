import { describe, expect, it } from 'vitest'
import { bankrollSeries } from '../../app/utils/bankrollSeries'

const recs = [
  { coinsInCents: 25, payoutCents: 0 },
  { coinsInCents: 25, payoutCents: 100 },
  { coinsInCents: 25, payoutCents: 0 }
] as never[]

describe('bankrollSeries', () => {
  it('reconstructs balances ending at the current balance', () => {
    const s = bankrollSeries(recs, 100000)
    expect(s[s.length - 1]).toBe(100000)
    // deltas (payout-in): -25, +75, -25; walking back from 100000
    expect(s).toEqual([99975, 99950, 100025, 100000])
  })
  it('caps the window to the last N records (+1 starting point)', () => {
    const many = Array.from({ length: 50 }, () => ({ coinsInCents: 25, payoutCents: 0 })) as never[]
    expect(bankrollSeries(many, 100000, 30)).toHaveLength(31)
  })
})
