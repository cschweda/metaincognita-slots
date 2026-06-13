// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PaylineOverlay from '../../app/components/game/PaylineOverlay.vue'
import type { WinLine } from '../../app/utils/winLines'

const base = { gutter: 36, cellPx: 96, gapPx: 8, rows: 3, cols: 5 }
function line(partial: Partial<WinLine>): WinLine {
  return { lineNumber: 1, count: 5, symbolId: 'KK', symbolName: 'King', pluralName: 'Kings', payout: 0, pattern: [1, 1, 1, 1, 1], cells: [], kind: 'line', color: '#f59e0b', ...partial }
}

describe('PaylineOverlay', () => {
  it('draws one polyline per line win and a left-gutter number badge', () => {
    const w = mount(PaylineOverlay, { props: { ...base, lines: [line({})] } })
    expect(w.findAll('polyline')).toHaveLength(1)
    expect(w.find('[data-test="line-num"]').text()).toBe('1')
  })

  it('a diagonal pattern produces 5 distinct points', () => {
    const w = mount(PaylineOverlay, { props: { ...base, lines: [line({ lineNumber: 4, pattern: [0, 1, 2, 1, 0] })] } })
    const pts = w.find('polyline').attributes('points')!.trim().split(/\s+/)
    expect(pts).toHaveLength(5)
    // entry row 0 -> y = 48; middle reel row 2 -> y = 2*104+48 = 256
    expect(pts[0]).toContain(',48')
    expect(pts[2]).toContain(',256')
  })

  it('ways / single wins draw no polyline', () => {
    const w = mount(PaylineOverlay, { props: { ...base, lines: [line({ kind: 'ways', pattern: null, lineNumber: null })] } })
    expect(w.findAll('polyline')).toHaveLength(0)
  })

  it('draws only the winning run for a partial-line win (M2)', () => {
    // count:3 of a 5-cell pattern -> the polyline spans just the first 3 reels
    const w = mount(PaylineOverlay, { props: { ...base, lines: [line({ pattern: [0, 1, 2, 1, 0], count: 3 })] } })
    const pts = w.find('polyline').attributes('points')!.trim().split(/\s+/)
    expect(pts).toHaveLength(3)
    expect(pts[0]).toContain(',48') // reel 0, row 0
    expect(pts[2]).toContain(',256') // reel 2, row 2
  })

  it('clamps badge stacking so none render past the SVG height (M4)', () => {
    const stride = base.cellPx + base.gapPx
    const height = base.rows * stride - base.gapPx
    // five lines sharing the bottom entry row would stack off the bottom edge
    const lines = Array.from({ length: 5 }, (_, i) => line({ lineNumber: i + 1, pattern: [2, 2, 2, 2, 2] }))
    const w = mount(PaylineOverlay, { props: { ...base, lines } })
    const badges = w.findAll('[data-test="line-num"]')
    expect(badges).toHaveLength(5)
    for (const b of badges) {
      const top = Number(/top:\s*([\d.]+)px/.exec(b.attributes('style') ?? '')?.[1])
      expect(top).toBeLessThanOrEqual(height)
    }
  })
})
