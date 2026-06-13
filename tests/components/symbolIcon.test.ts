// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SymbolIcon from '../../app/components/game/SymbolIcon.vue'

describe('SymbolIcon', () => {
  it('renders pictorial art as inline svg', () => {
    const w = mount(SymbolIcon, { props: { icon: 'bell', label: 'Bell' } })
    expect(w.find('svg').exists()).toBe(true)
    expect(w.attributes('aria-label')).toBe('Bell')
  })

  it('renders royals and sevens as styled text', () => {
    const k = mount(SymbolIcon, { props: { icon: 'king', label: 'King' } })
    expect(k.text()).toBe('K')
    const s = mount(SymbolIcon, { props: { icon: 'seven', label: 'Seven' } })
    expect(s.text()).toContain('7')
  })

  it('renders the right number of BAR pills', () => {
    const w = mount(SymbolIcon, { props: { icon: 'bar3', label: 'Triple Bar' } })
    expect(w.findAll('span').filter(s => s.text() === 'BAR')).toHaveLength(3)
  })

  it('falls back to the label when the icon id is unknown or missing', () => {
    const w = mount(SymbolIcon, { props: { icon: 'no-such-icon', label: 'Mystery' } })
    expect(w.text()).toContain('Mystery')
    const n = mount(SymbolIcon, { props: { label: 'Bare' } })
    expect(n.text()).toContain('Bare')
  })

  it('adds a WILD ribbon when wild', () => {
    const w = mount(SymbolIcon, { props: { icon: 'doge', label: 'Wild Doge', wild: true } })
    expect(w.text()).toContain('WILD')
  })
})
