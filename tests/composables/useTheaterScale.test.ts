// tests/composables/useTheaterScale.test.ts
import { describe, expect, it } from 'vitest'
import { fitScale } from '../../app/composables/useTheaterScale'

describe('fitScale', () => {
  it('a wide (5-reel) block binds on width and fills', () => {
    // natural 1000x560 into a 1920x1080 screen: width ratio 1.92, height 1.93, cap 2.4
    expect(fitScale(1000, 560, 1920, 1080, 2.4)).toBeCloseTo(1.92, 2)
  })
  it('a narrow (3-reel) block binds on height', () => {
    // natural 560x620 into 1920x1080: width 3.43, height 1.74 -> height wins
    expect(fitScale(560, 620, 1920, 1080, 2.4)).toBeCloseTo(1.742, 2)
  })
  it('never exceeds the cap (no ballooning on a 4K display)', () => {
    expect(fitScale(300, 300, 3840, 2160, 2.4)).toBe(2.4)
  })
  it('degenerate sizes read as 1 (pre-layout / hidden)', () => {
    expect(fitScale(0, 0, 1920, 1080, 2.4)).toBe(1)
  })
})
