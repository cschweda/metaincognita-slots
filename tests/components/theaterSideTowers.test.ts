// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TheaterSideTowers from '../../app/components/game/TheaterSideTowers.vue'

describe('TheaterSideTowers', () => {
  it('renders two aria-hidden towers (decorative only)', () => {
    const w = mount(TheaterSideTowers)
    const towers = w.findAll('[data-test="side-tower"]')
    expect(towers).toHaveLength(2)
    expect(w.find('[aria-hidden="true"]').exists()).toBe(true)
  })
})
