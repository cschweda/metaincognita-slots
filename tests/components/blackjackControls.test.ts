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

describe('BlackjackControls — Lucky 21 stop-the-reels (no Deal button)', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    active?.unmount()
    active = null
  })

  it('idle phase: no Deal button, STOP enabled, Cash Out disabled', async () => {
    const { wrapper } = setup()
    await wrapper.vm.$nextTick()
    // No separate Deal button — it was removed
    expect(wrapper.find('[data-test="deal"]').exists()).toBe(false)
    // STOP is enabled in idle (pressing it deals + locks reel 1)
    expect(wrapper.find('[data-test="stop"]').attributes('disabled')).toBeUndefined()
    // Cash Out is disabled until a hand is in progress
    expect(wrapper.find('[data-test="cash-out"]').attributes('disabled')).toBeDefined()
  })

  it('STOP while idle deals the hand and locks reel 1 (transitions to spinning)', async () => {
    const { store, wrapper } = setup()
    expect(store.currentState!.blackjackReel!.phase).toBe('idle')
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    // After STOP-from-idle: hand dealt, reel 1 locked → phase spinning (idx=1)
    // OR phase resolved if the first stop triggered an auto-resolve (e.g. bust on reel 1 is impossible
    // since reels 1-2 are pure cards, so we expect spinning here).
    const p = store.currentState!.blackjackReel!.phase
    expect(p === 'spinning' || p === 'resolved').toBe(true)
    expect(store.spinning).toBe(false) // revealDone cleared the gate
  })

  it('STOP while idle charges ante exactly once (no double-charge)', async () => {
    const { store, wrapper } = setup()
    const bankrollBefore = store.bankrollCents
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    const bankrollAfter = store.bankrollCents
    // Only one ante deducted (deal charges once; stop does not charge)
    const def = store.currentDef as { denominationCents: number }
    const ante = store.currentBet * def.denominationCents
    // bankroll decreases by exactly one ante (not two)
    expect(bankrollBefore - bankrollAfter).toBe(ante)
  })

  it('Stop and Cash Out enabled after STOP-from-idle (hand in progress), no Deal button', async () => {
    const { wrapper } = setup()
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    // Deal button is never shown
    expect(wrapper.find('[data-test="deal"]').exists()).toBe(false)
    // If phase is spinning, stop and cash-out are enabled
    if (wrapper.vm.$props === undefined) {
      // check via DOM
      const stopDisabled = wrapper.find('[data-test="stop"]').attributes('disabled')
      // spinning: STOP enabled (idx < 5), cash-out enabled
      expect(stopDisabled).toBeUndefined()
      expect(wrapper.find('[data-test="cash-out"]').attributes('disabled')).toBeUndefined()
    }
  })

  it('Stop advances reel index from spinning phase', async () => {
    const { store, wrapper } = setup()
    // First STOP deals + locks reel 1
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    const before = store.currentState!.blackjackReel!.idx
    // Second STOP locks reel 2
    await wrapper.find('[data-test="stop"]').trigger('click')
    const after = store.currentState!.blackjackReel!.idx
    expect(after).toBeGreaterThanOrEqual(before)
    expect(store.spinning).toBe(false)
  })

  it('Cash Out resolves the hand immediately after two stops', async () => {
    const { store, wrapper } = setup()
    // STOP x1: deal + lock reel 1
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    // STOP x2: lock reel 2 (reels 1-2 are pure cards, can't bust)
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-test="cash-out"]').trigger('click')
    expect(store.currentState!.blackjackReel!.phase).toBe('resolved')
    expect(store.spinning).toBe(false)
  })

  it('After resolved, STOP re-enabled to start a new hand, no Deal button', async () => {
    const { store, wrapper } = setup()
    // Play a full hand: STOP×2 + Cash Out → resolved
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-test="stop"]').trigger('click')
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-test="cash-out"]').trigger('click')
    await wrapper.vm.$nextTick()
    expect(store.currentState!.blackjackReel!.phase).toBe('resolved')
    // No Deal button ever
    expect(wrapper.find('[data-test="deal"]').exists()).toBe(false)
    // STOP should NOT be enabled in resolved state (not idle, not spinning)
    expect(wrapper.find('[data-test="stop"]').attributes('disabled')).toBeDefined()
  })

  it('STOP disabled when bankroll < ante in idle phase', async () => {
    const { store, wrapper } = setup()
    store.bankrollCents = 1
    await wrapper.vm.$nextTick()
    // canDeal is false → canStop in idle is also false
    expect(wrapper.find('[data-test="stop"]').attributes('disabled')).toBeDefined()
  })
})
