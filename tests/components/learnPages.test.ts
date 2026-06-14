// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LearnDisclosure from '../../app/components/learn/LearnDisclosure.vue'

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
