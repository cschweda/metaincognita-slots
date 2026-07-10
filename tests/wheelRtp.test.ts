import { describe, expect, it } from 'vitest'
import { exactRtp } from '../app/engine'
import { wheelExactRtp } from '../app/engine/wheelRtp'
import { WONDER_WHEEL } from '../app/machines/wonder-wheel'

const def = WONDER_WHEEL

describe('wheelExactRtp — frozen calibration (2026-07-10)', () => {
  it('max coins: RTP 92.4880%/coin with the wheel term at 21.9609%', () => {
    const r = wheelExactRtp(def, { coins: 3 })
    expect(r.rtpPerCoin).toBeCloseTo(0.924880, 6)
    expect(r.hitFrequency).toBeCloseTo(0.185989, 6)
    expect(r.variancePerCoin).toBeCloseTo(38.049775, 5)
    const wheelShare = r.breakdown.filter(b => b.entryId.startsWith('wedge-')).reduce((s, b) => s + b.contribution, 0)
    expect(wheelShare).toBeCloseTo(0.219609, 6)
  })

  it('under max coins the wheel contributes NOTHING — the per-coin cliff', () => {
    const r1 = wheelExactRtp(def, { coins: 1 })
    const r2 = wheelExactRtp(def, { coins: 2 })
    expect(r1.rtpPerCoin).toBeCloseTo(0.705271, 6)
    expect(r2.rtpPerCoin).toBeCloseTo(0.705271, 6)
    expect(r1.breakdown.some(b => b.entryId.startsWith('wedge-'))).toBe(false)
  })

  it('the MEGA wedge is 1 in ~55,872 spins (drawn 1/24 of the circle, weighted 2/1164)', () => {
    const r = wheelExactRtp(def, { coins: 3 })
    const mega = r.breakdown.find(b => b.entryId === 'wedge-2500')!
    expect(1 / mega.probability).toBeCloseTo(55872, 0)
  })

  it('routes through exactRtp() identically and the breakdown sums to the RTP', () => {
    const via = exactRtp(def, { coins: 3 })
    const direct = wheelExactRtp(def, { coins: 3 })
    expect(via).toEqual(direct)
    const sum = via.breakdown.reduce((s, b) => s + b.contribution, 0)
    expect(sum).toBeCloseTo(via.rtpPerCoin, 10)
    // one row per paytable entry that can hit + one per wedge
    expect(via.breakdown.length).toBe(8 + 24)
  })

  it('the top award resolves for the floor card', () => {
    const r = exactRtp(def)
    expect(def.topAwardEntryId).toBe('wedge-2500')
    expect(r.breakdown.find(b => b.entryId === def.topAwardEntryId)).toBeDefined()
  })
})
