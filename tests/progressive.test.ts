import { describe, it, expect } from 'vitest'
import {
  initProgressiveState, addCoinToProgressive
} from '../app/engine/progressive'
import { SERIES_E_MULTIPLIER } from '../app/machines/series-e-multiplier'
import type { DualProgressiveConfig, DualProgressiveState, SingleProgressiveState } from '../app/engine/types'

const DUAL: DualProgressiveConfig = {
  kind: 'dual',
  upper: { reset: 5000, max: 20000, rate1: { coinsPer: 5, amount: 1 }, rate1Limit: 9000, rate2: { coinsPer: 20, amount: 1 } },
  lower: { reset: 1000, max: 5000, rate1: { coinsPer: 20, amount: 1 }, rate1Limit: 2500, rate2: { coinsPer: 50, amount: 1 } },
  coinsPerToggle: 1
}

describe('dual progressive — FO-5140 worked example', () => {
  it('10 coins: odd coins live=upper, upper increments at its 5th live coin', () => {
    const st = initProgressiveState(DUAL) as DualProgressiveState
    expect(st.live).toBe('upper')
    for (let i = 0; i < 10; i++) addCoinToProgressive(st, DUAL)
    // upper saw coins 1,3,5,7,9 (5 live coins) -> one increment of 1
    expect(st.upper).toBe(5001)
    // lower saw 5 live coins, needs 20 -> no increment
    expect(st.lower).toBe(1000)
    // after 10 toggles, live is back to upper
    expect(st.live).toBe('upper')
  })

  it('rate2 applies once value >= rate1Limit', () => {
    const st = initProgressiveState(DUAL) as DualProgressiveState
    st.upper = 9000 // at limit -> rate2 (20 live coins per +1)
    for (let i = 0; i < 19 * 2; i++) addCoinToProgressive(st, DUAL) // 19 live-upper coins
    expect(st.upper).toBe(9000)
    addCoinToProgressive(st, DUAL) // 20th live-upper coin (coin 39 overall, odd => upper)
    expect(st.upper).toBe(9001)
  })

  it('clips at max and keeps cycling counters', () => {
    const st = initProgressiveState(DUAL) as DualProgressiveState
    st.upper = DUAL.upper.max
    for (let i = 0; i < 200; i++) addCoinToProgressive(st, DUAL)
    expect(st.upper).toBe(DUAL.upper.max)
    expect(st.lower).toBeGreaterThan(1000) // lower still incremented (100 live coins / 20 = 5)
    expect(st.lower).toBe(1005)
  })

  it('coinsPerToggle > 1 holds the live meter for N coins', () => {
    const cfg: DualProgressiveConfig = { ...DUAL, coinsPerToggle: 3 }
    const st = initProgressiveState(cfg) as DualProgressiveState
    addCoinToProgressive(st, cfg)
    addCoinToProgressive(st, cfg)
    expect(st.live).toBe('upper')
    addCoinToProgressive(st, cfg) // 3rd coin completes the toggle window
    expect(st.live).toBe('lower')
  })
})

describe('single progressive', () => {
  it('increments by rate1 then rate2 past the limit', () => {
    const cfg = SERIES_E_MULTIPLIER.progressive!
    if (cfg.kind !== 'single') throw new Error('expected single')
    const st = initProgressiveState(cfg) as SingleProgressiveState
    // rate1: +1 per 4 coins
    for (let i = 0; i < 4; i++) addCoinToProgressive(st, cfg)
    expect(st.value).toBe(6001)
    // jump to limit: rate2 = +1 per 8 coins
    st.value = 8000
    for (let i = 0; i < 7; i++) addCoinToProgressive(st, cfg)
    expect(st.value).toBe(8000)
    addCoinToProgressive(st, cfg)
    expect(st.value).toBe(8001)
  })
})
