// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { mulberry32 } from '../../app/engine'
import { setLiveRand } from '../../app/utils/liveRand'
import ReelWheelGame from '../../app/components/game/ReelWheelGame.vue'
import WheelOverlay from '../../app/components/game/WheelOverlay.vue'
import { useSlotsStore } from '../../app/stores/slots'

const stubs = {
  UIcon: true,
  UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  GameWheelOverlay: WheelOverlay
}

function setup() {
  setActivePinia(createPinia())
  localStorage.clear()
  setLiveRand(mulberry32(2026))
  const store = useSlotsStore()
  store.startSession(1_000_000)
  store.selectMachine('wonder-wheel')
  store.setBet(3)
  return store
}

describe('ReelWheelGame surface', () => {
  beforeEach(() => localStorage.clear())

  it('shows the max-coins gate honestly and no overlay while idle', () => {
    const store = setup()
    const w = mount(ReelWheelGame, { global: { stubs } })
    expect(w.text()).toContain('wheel ARMED at this bet')
    expect(w.find('[data-test="wheel-overlay"]').exists()).toBe(false)
    store.setBet(1)
    return w.vm.$nextTick().then(() => {
      expect(w.text()).toContain('wheel needs MAX COINS')
    })
  })

  it('mounts the overlay when the topper arms', async () => {
    const store = setup()
    const w = mount(ReelWheelGame, { global: { stubs } })
    store.machineStates['wonder-wheel']!.wheel = { pending: true }
    await w.vm.$nextTick()
    expect(w.find('[data-test="wheel-overlay"]').exists()).toBe(true)
    expect(w.find('[data-test="wheel-spin"]').exists()).toBe(true)
  })
})

describe('WheelOverlay honesty — the animation obeys the engine', () => {
  beforeEach(() => localStorage.clear())

  it('the SPIN button fires the ordinary spin action; the rotor lands the DRAWN wedge', async () => {
    const store = setup()
    store.machineStates['wonder-wheel']!.wheel = { pending: true }
    const w = mount(WheelOverlay, { global: { stubs } })
    await w.find('[data-test="wheel-spin"]').trigger('click')
    await flushPromises()
    const out = store.lastOutcome!
    const landed = out.featureEvents.find(e => e.type === 'wheel-landed')!
    expect(landed.type).toBe('wheel-landed')
    const idx = (landed as { wedgeIndex: number }).wedgeIndex
    const rotor = w.find('[data-test="wheel-rotor"]')
    expect(Number(rotor.attributes('data-rotation'))).toBeCloseTo(360 * 5 - (idx * 15 + 7.5), 6)
    // pending cleared by the engine at the draw; the stage stays locked until reveal
    expect(store.machineStates['wonder-wheel']!.wheel!.pending).toBe(false)
    expect(store.spinning).toBe(true)
  })
})
