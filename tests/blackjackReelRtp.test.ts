import { describe, it, expect } from 'vitest'
import { blackjackReelExactRtp, crashOdds, optimalStop, decisionEvs } from '../app/engine/blackjackReelRtp'
import { freshBlackjackState } from '../app/engine/blackjackReel'
import { FLAMEOUT_21 } from '../app/machines/flameout-21'

describe('Flameout 21 DP', () => {
  const r = blackjackReelExactRtp(FLAMEOUT_21)
  it('RTP is ~97% under optimal play', () => {
    expect(r.rtpPerCoin).toBeGreaterThan(0.965)
    expect(r.rtpPerCoin).toBeLessThan(0.975)
  })
  it('breakdown buckets sum to RTP and cover crash/cash/topped', () => {
    const ids = new Set(r.breakdown.map(b => b.entryId))
    expect(ids.has('crash')).toBe(true)
    const sum = r.breakdown.reduce((a, b) => a + b.contribution, 0)
    expect(sum).toBeCloseTo(r.rtpPerCoin, 10)
  })
  it('hit frequency and variance are sane', () => {
    expect(r.hitFrequency).toBeGreaterThan(0)
    expect(r.hitFrequency).toBeLessThanOrEqual(1)
    expect(r.variancePerCoin).toBeGreaterThan(0)
  })
  it('crash odds escalate reel 3 < 4 < 5', () => {
    const o = crashOdds(FLAMEOUT_21)
    expect(o[0]!).toBeLessThan(o[1]!)
    expect(o[1]!).toBeLessThan(o[2]!)
  })
  it('optimalStop always continues through the deal reels', () => {
    const bj = { ...freshBlackjackState(), phase: 'spinning' as const, idx: 0 }
    expect(optimalStop(FLAMEOUT_21, bj)).toBe('continue')
  })
  it('decisionEvs reports cash = current multiplier at a climb reel', () => {
    const bj = { ...freshBlackjackState(), phase: 'spinning' as const, idx: 2, multiplier: 1.2, velocity: 1.6 }
    const ev = decisionEvs(FLAMEOUT_21, bj)
    expect(ev).not.toBeNull()
    expect(ev!.evCash).toBeCloseTo(1.2, 10)
  })
})
