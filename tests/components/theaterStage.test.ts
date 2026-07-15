// tests/components/theaterStage.test.ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TheaterStage from '../../app/components/game/TheaterStage.vue'
import { useTheater } from '../../app/composables/useTheater'

const stubs = {
  GameTheaterGhostBar: { template: '<div data-test="ghost" />' },
  GameTheaterPeekLayer: { template: '<div data-test="peek" />' },
  GameTheaterSideTowers: { template: '<div data-test="towers" />' }
}

describe('TheaterStage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTheater().exit()
  })

  it('renders the slotted cabinet always; ghost + peek only when active', async () => {
    const w = mount(TheaterStage, {
      props: { narrow: false },
      slots: { default: '<div data-test="cab">CAB</div>' },
      global: { stubs }
    })
    expect(w.find('[data-test="cab"]').exists()).toBe(true)
    expect(w.find('[data-test="ghost"]').exists()).toBe(false)
    useTheater().enter()
    await w.vm.$nextTick()
    expect(w.find('[data-test="ghost"]').exists()).toBe(true)
    expect(w.find('[data-test="peek"]').exists()).toBe(true)
  })

  it('shows side towers only for narrow machines in theater', async () => {
    const w = mount(TheaterStage, {
      props: { narrow: true },
      slots: { default: '<div>CAB</div>' },
      global: { stubs }
    })
    useTheater().enter()
    await w.vm.$nextTick()
    expect(w.find('[data-test="towers"]').exists()).toBe(true)
  })
})
