import { describe, it, expect } from 'vitest'
import { tableLookup, launchFor, velocityFor, handTotal, freshBlackjackState, dealReels, stopReel, cashOut } from '../app/engine/blackjackReel'
import { FLAMEOUT_21 } from '../app/machines/flameout-21'
import type { MachineSessionState } from '../app/engine/types'

function seq(values: number[]) {
  let i = 0
  return () => (i < values.length ? values[i++]! : 0)
}
function emptyState(): MachineSessionState {
  return { progressive: null, videoFeature: null, pachislo: null, blackjackReel: null, lockReel: null }
}

describe('launch/velocity tables', () => {
  it('tableLookup picks the greatest atLeast <= total', () => {
    const t = [{ atLeast: 10, mult: 2 }, { atLeast: 0, mult: 1 }, { atLeast: 20, mult: 3 }]
    expect(tableLookup(t, 25)).toBe(3)
    expect(tableLookup(t, 15)).toBe(2)
    expect(tableLookup(t, 5)).toBe(1)
  })
  it('a higher total launches at least as high', () => {
    expect(launchFor(FLAMEOUT_21, 20)).toBeGreaterThanOrEqual(launchFor(FLAMEOUT_21, 12))
    expect(velocityFor(FLAMEOUT_21, 20)).toBeGreaterThanOrEqual(velocityFor(FLAMEOUT_21, 13))
  })
})

describe('handTotal', () => {
  it('promotes one ace to 11 when it fits', () => {
    expect(handTotal(['AS', 'KH'])).toBe(21)
    expect(handTotal(['AS', 'AD'])).toBe(12)
    expect(handTotal(['KH', 'QD'])).toBe(20)
    expect(handTotal(['5S', '7D'])).toBe(12)
  })
})

describe('deal + stop (launch / velocity)', () => {
  it('reel 1 sets launch from one card; reel 2 sets launch + velocity from the 2-card total', () => {
    const state = emptyState()
    dealReels(FLAMEOUT_21, state, 1, seq([0]))
    const bj = state.blackjackReel!
    bj.reelStrips[0] = ['9S']
    bj.reelStrips[1] = ['9D'] // total 18
    stopReel(FLAMEOUT_21, state, seq([0]))
    expect(bj.multiplier).toBe(launchFor(FLAMEOUT_21, 9))
    stopReel(FLAMEOUT_21, state, seq([0]))
    expect(bj.multiplier).toBe(launchFor(FLAMEOUT_21, 18))
    expect(bj.velocity).toBe(velocityFor(FLAMEOUT_21, 18))
    expect(bj.idx).toBe(2)
  })
  it('a 2-card natural launches to naturalLaunch', () => {
    const state = emptyState()
    dealReels(FLAMEOUT_21, state, 1, seq([0]))
    const bj = state.blackjackReel!
    bj.reelStrips[0] = ['AS']
    bj.reelStrips[1] = ['KH']
    stopReel(FLAMEOUT_21, state, seq([0]))
    stopReel(FLAMEOUT_21, state, seq([0]))
    expect(bj.natural).toBe(true)
    expect(bj.multiplier).toBe(FLAMEOUT_21.naturalLaunch)
  })
})

describe('climb / crash / cash', () => {
  function dealt(total: [string, string]) {
    const state = emptyState()
    dealReels(FLAMEOUT_21, state, 2, seq([0]))
    const bj = state.blackjackReel!
    bj.reelStrips[0] = [total[0]]
    bj.reelStrips[1] = [total[1]]
    stopReel(FLAMEOUT_21, state, seq([0]))
    stopReel(FLAMEOUT_21, state, seq([0]))
    return state
  }
  it('a CLIMB multiplies by velocity', () => {
    const state = dealt(['9S', '9D']) // 18
    const bj = state.blackjackReel!
    const before = bj.multiplier
    bj.reelStrips[2] = ['CLIMB']
    stopReel(FLAMEOUT_21, state, seq([0]))
    expect(bj.multiplier).toBeCloseTo(before * bj.velocity, 10)
    expect(bj.phase).toBe('spinning')
  })
  it('a CRASH ends the hand at zero', () => {
    const state = dealt(['9S', '9D'])
    const bj = state.blackjackReel!
    bj.reelStrips[2] = ['CRASH']
    const out = stopReel(FLAMEOUT_21, state, seq([0]))
    expect(bj.crashed).toBe(true)
    expect(bj.phase).toBe('resolved')
    expect(out.totalPayout).toBe(0)
  })
  it('cash out banks ante x multiplier', () => {
    const state = dealt(['9S', '9D'])
    const bj = state.blackjackReel!
    const out = cashOut(FLAMEOUT_21, state)
    expect(out.totalPayout).toBeCloseTo(bj.ante * bj.multiplier, 10)
    expect(bj.phase).toBe('resolved')
  })
  it('topping out (climb all three) auto-resolves at ante x multiplier', () => {
    const state = dealt(['KS', 'KD']) // 20
    const bj = state.blackjackReel!
    bj.reelStrips[2] = ['CLIMB']
    bj.reelStrips[3] = ['CLIMB']
    bj.reelStrips[4] = ['CLIMB']
    stopReel(FLAMEOUT_21, state, seq([0]))
    stopReel(FLAMEOUT_21, state, seq([0]))
    const out = stopReel(FLAMEOUT_21, state, seq([0]))
    expect(bj.idx).toBe(5)
    expect(bj.phase).toBe('resolved')
    expect(out.totalPayout).toBeCloseTo(bj.ante * bj.multiplier, 10)
  })
  it('fresh state is idle at multiplier 1', () => {
    const s = freshBlackjackState()
    expect(s.phase).toBe('idle')
    expect(s.multiplier).toBe(1)
    expect(s.velocity).toBe(0)
    expect(s.crashed).toBe(false)
  })
})
