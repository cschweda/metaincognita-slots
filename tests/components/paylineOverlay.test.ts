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
})
