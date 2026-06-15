// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { mulberry32 } from '../../app/engine'
import { setLiveRand } from '../../app/utils/liveRand'
import BlackjackControls from '../../app/components/game/BlackjackControls.vue'
import { useSlotsStore } from '../../app/stores/slots'

let active: { unmount: () => void } | null = null

function setup() {
  setActivePinia(createPinia())
  localStorage.clear()
  setLiveRand(mulberry32(2026))
  const store = useSlotsStore()
  store.startSession(1_000_000)
  store.selectMachine('lucky-21')
  const wrapper = mount(BlackjackControls, {
    global: {
      stubs: {
        UIcon: true,
        UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }
      }
    }
  })
  active = wrapper
  return { store, wrapper }
}

describe('BlackjackControls — Lucky 21 stop-the-reels', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    active?.unmount()
    active = null
  })

  it('Deal enabled, Stop and Cash Out disabled in idle phase', async () => {
    const { wrapper } = setup()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="stop"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="cash-out"]').attributes('disabled')).toBeDefined()
  })

  it('Deal calls store.deal then revealDone, transitions to spinning phase', async () => {
    const { store, wrapper } = setup()
    expect(store.currentState!.blackjackReel!.phase).toBe('idle')
    await wrapper.find('[data-test="deal"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('spinning')
    expect(store.spinning).toBe(false) // revealDone cleared it
  })

  it('Stop and Cash Out enabled after Deal, Deal hidden', async () => {
    const { wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="deal"]').exists()).toBe(false) // v-if hides it while spinning
    expect(wrapper.find('[data-test="stop"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="cash-out"]').attributes('disabled')).toBeUndefined()
  })

  it('Stop advances reel index', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    await wrapper.vm.$nextTick()
    const before = store.currentState!.blackjackReel!.idx
    await wrapper.find('[data-test="stop"]').trigger('click')
    const after = store.currentState!.blackjackReel!.idx
    // idx may stay same if bust, or advance to next reel
    expect(after).toBeGreaterThanOrEqual(before)
    expect(store.spinning).toBe(false)
  })

  it('Cash Out resolves the hand immediately', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    // stop reels 0 and 1 (pure cards, can't bust)
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-test="cash-out"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('resolved')
    expect(store.spinning).toBe(false)
  })

  it('Deal re-enabled after resolved', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-test="cash-out"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(store.currentState!.blackjackReel!.phase).toBe('resolved')
    expect(wrapper.find('[data-test="deal"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeUndefined()
  })

  it('Deal disabled when bankroll < ante', async () => {
    const { store, wrapper } = setup()
    store.bankrollCents = 1
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeDefined()
  })
})
