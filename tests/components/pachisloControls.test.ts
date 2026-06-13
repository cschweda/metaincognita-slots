// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { mulberry32 } from '../../app/engine'
import { setLiveRand } from '../../app/utils/liveRand'
import PachisloControls from '../../app/components/game/PachisloControls.vue'
import { useSlotsStore } from '../../app/stores/slots'

let active: { unmount: () => void } | null = null

function setup() {
  setActivePinia(createPinia())
  localStorage.clear()
  setLiveRand(mulberry32(2026))
  const store = useSlotsStore()
  store.startSession(100_000)
  store.selectMachine('stock-rush')
  const wrapper = mount(PachisloControls, {
    global: {
      stubs: {
        UIcon: true,
        UModal: { template: '<div><slot /><slot name="body" /></div>' },
        UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }
      }
    }
  })
  active = wrapper
  return { store, wrapper }
}

describe('PachisloControls', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    active?.unmount()
    active = null
  })

  it('stop buttons stay disabled until armed, then capture three presses into a spin', async () => {
    const { store, wrapper } = setup()
    const stops = () => wrapper.findAll('[data-test^="stop-"]')
    expect(stops().every(b => b.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.find('[data-test="arm"]').trigger('click')
    expect(stops().every(b => b.attributes('disabled') === undefined)).toBe(true)
    await stops()[0]!.trigger('click')
    await stops()[1]!.trigger('click')
    expect(store.history).toHaveLength(0) // two presses — nothing committed yet
    await stops()[2]!.trigger('click')
    expect(store.history).toHaveLength(1)
    const presses = store.lastOutcome!.trace.presses!
    expect(presses).toHaveLength(3)
    for (const p of presses) {
      expect(Number.isInteger(p.press)).toBe(true)
      expect(p.press).toBeGreaterThanOrEqual(0)
      expect(p.press).toBeLessThanOrEqual(20)
    }
  })

  it('press-for-me resolves a full game in one click', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="arm"]').trigger('click')
    await wrapper.find('[data-test="press-for-me"]').trigger('click')
    expect(store.history).toHaveLength(1)
  })

  it('keyboard 1/2/3 stop the reels while armed', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="arm"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }))
    await wrapper.vm.$nextTick()
    expect(store.history).toHaveLength(1)
  })

  it('operator key opens only when idle and sets the level', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="operator-key"]').trigger('click')
    await wrapper.find('[data-test="level-6"]').trigger('click')
    expect(store.machineStates['stock-rush']!.pachislo!.oddsLevel).toBe(6)
  })
})
