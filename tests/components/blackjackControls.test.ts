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
  store.selectMachine('hit-or-bust')
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

// Lucky 21: all tests skipped in Task 1 (hit-or-bust off floor, store actions stubbed); restored in a later task
describe.skip('BlackjackControls — Lucky 21: restored in a later task', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    active?.unmount()
    active = null
  })

  it('Deal enabled, Hit and Stand disabled in idle phase', () => {
    const { wrapper } = setup()
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="hit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="stand"]').attributes('disabled')).toBeDefined()
  })

  it('Deal calls store.dealHand then revealDone, transitions to dealt phase', async () => {
    const { store, wrapper } = setup()
    expect(store.currentState!.blackjackReel!.phase).toBe('idle')
    await wrapper.find('[data-test="deal"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('dealt')
    expect(store.currentState!.blackjackReel!.cards).toHaveLength(2)
    expect(store.spinning).toBe(false) // revealDone cleared it
  })

  it('Hit and Stand enabled after Deal, Deal disabled', async () => {
    const { wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="hit"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('[data-test="stand"]').attributes('disabled')).toBeUndefined()
  })

  it('Hit advances the hand: a card is consumed from the reel (added or bust-saved in-place)', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    await wrapper.find('[data-test="hit"]').trigger('click')
    const bj = store.currentState!.blackjackReel!
    // After a hit, cards always has at least 3 elements (2 dealt + 1 hit reel consumed)
    // OR bust-save voided the 3rd card in-place keeping length at 3.
    // Either way: at least 3 cards in the array.
    expect(bj.cards.length).toBeGreaterThanOrEqual(3)
    expect(store.spinning).toBe(false) // revealDone cleared it
  })

  it('Stand resolves the hand immediately', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    await wrapper.find('[data-test="stand"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('resolved')
    expect(store.spinning).toBe(false)
  })

  it('Deal re-enabled after resolved, starts a new hand', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="deal"]').trigger('click')
    await wrapper.find('[data-test="stand"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('resolved')
    // After resolution, deal should be re-enabled
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeUndefined()
    await wrapper.find('[data-test="deal"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('dealt')
  })

  it('Deal disabled when bankroll < ante', async () => {
    const { store, wrapper } = setup()
    store.bankrollCents = 1 // below any ante
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="deal"]').attributes('disabled')).toBeDefined()
  })
})
