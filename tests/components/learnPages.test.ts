// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LearnDisclosure from '../../app/components/learn/LearnDisclosure.vue'
import HouseEdge from '../../app/pages/learn/house-edge.vue'
import Telnaes from '../../app/pages/learn/telnaes-reels.vue'
import HoldAndSpin from '../../app/pages/learn/hold-and-spin.vue'
import GargoylesEye from '../../app/pages/learn/gargoyles-eye.vue'

const stubs = { NuxtLink: { template: '<a><slot /></a>' }, UIcon: true }

describe('LearnDisclosure', () => {
  it('renders a native details/summary with the label and slotted body', () => {
    const w = mount(LearnDisclosure, {
      props: { label: 'Show the math' },
      slots: { default: '<p data-test="body">derivation</p>' },
      global: { stubs }
    })
    expect(w.find('details').exists()).toBe(true)
    expect(w.find('summary').text()).toContain('Show the math')
    expect(w.find('[data-test="body"]').exists()).toBe(true)
  })
})

describe('house-edge', () => {
  it('renders a live floor-wide house-edge table', () => {
    const w = mount(HouseEdge, { global: { stubs } })
    expect(w.text()).toContain('Diamond Doubler')
    expect(w.text()).toMatch(/\d+\.\d+%/) // at least one computed percentage
    expect(w.text().toLowerCase()).toContain('house edge')
  })
})

describe('telnaes-reels', () => {
  it('contrasts physical vs virtual stops with live numbers', () => {
    const w = mount(Telnaes, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('virtual')
    expect(w.text().toLowerCase()).toContain('physical')
    expect(w.text()).toMatch(/1 in [\d,]+/) // a formatOdds() figure
  })
})

describe('hold-and-spin', () => {
  it('explains the respin-reset chain with a live fill number', () => {
    const w = mount(HoldAndSpin, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('respin')
    expect(w.text().toLowerCase()).toContain('markov')
    expect(w.text()).toMatch(/%|1 in/) // a computed probability
  })
})

describe('gargoyles-eye', () => {
  it('explains the additive multiplier with live values', () => {
    const w = mount(GargoylesEye, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('additive')
    expect(w.text()).toMatch(/×\s*\d/) // a multiplier value rendered
  })
})
