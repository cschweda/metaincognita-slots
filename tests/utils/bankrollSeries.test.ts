import { describe, expect, it } from 'vitest'
import { bankrollSeries, spinKind } from '../../app/utils/bankrollSeries'

const recs = [
  { coinsInCents: 25, payoutCents: 0 },
  { coinsInCents: 25, payoutCents: 100 },
  { coinsInCents: 25, payoutCents: 0 }
] as never[]

describe('bankrollSeries', () => {
  it('reconstructs balances ending at the current balance', () => {
    const s = bankrollSeries(recs, 100000)
    expect(s[s.length - 1]!.cents).toBe(100000)
    // deltas (payout-in): -25, +75, -25; walking back from 100000
    expect(s.map(p => p.cents)).toEqual([99975, 99950, 100025, 100000])
  })

  it('caps the window to the last N records (+1 starting point)', () => {
    const many = Array.from({ length: 50 }, () => ({ coinsInCents: 25, payoutCents: 0 })) as never[]
    expect(bankrollSeries(many, 100000, 30)).toHaveLength(31)
  })

  it('the leading point is a baseline balance, not a spin — it carries no kind', () => {
    const s = bankrollSeries(recs, 100000)
    expect(s[0]!.kind).toBeNull()
    expect(s.slice(1).every(p => p.kind !== null)).toBe(true)
  })

  it('tags each point with what that spin did to the BANKROLL', () => {
    const s = bankrollSeries(recs, 100000)
    expect(s.map(p => p.kind)).toEqual([null, 'loss', 'win', 'loss'])
  })
})

// The machine's word for it is not the bankroll's. A pay under the bet is the
// trick /learn/ldw-near-miss exists to expose, so it gets its own kind.
describe('spinKind — what the spin did to the bankroll, not what the machine celebrated', () => {
  it('a pay that beats the bet is a real win', () => {
    expect(spinKind({ coinsInCents: 25, payoutCents: 100 } as never)).toBe('win')
  })

  it('a pay UNDER the bet is an LDW — the machine flashed WIN, the bankroll fell', () => {
    expect(spinKind({ coinsInCents: 25, payoutCents: 10 } as never)).toBe('ldw')
  })

  it('a pay of exactly the bet is an LDW too — celebrated, but nothing gained', () => {
    expect(spinKind({ coinsInCents: 25, payoutCents: 25 } as never)).toBe('ldw')
  })

  it('no pay at all is a plain loss', () => {
    expect(spinKind({ coinsInCents: 25, payoutCents: 0 } as never)).toBe('loss')
  })

  it('a free spin that pays counts as a win; one that whiffs pays nothing', () => {
    expect(spinKind({ coinsInCents: 0, payoutCents: 50 } as never)).toBe('win')
    expect(spinKind({ coinsInCents: 0, payoutCents: 0 } as never)).toBe('loss')
  })
})
