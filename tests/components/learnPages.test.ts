// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LearnDisclosure from '../../app/components/learn/LearnDisclosure.vue'
import HouseEdge from '../../app/pages/learn/house-edge.vue'

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
