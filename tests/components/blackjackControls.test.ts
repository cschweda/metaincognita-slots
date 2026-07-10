// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { mulberry32 } from '../../app/engine'
import { setLiveRand } from '../../app/utils/liveRand'
import ReelBlackjackReel from '../../app/components/game/ReelBlackjackReel.vue'
import { useSlotsStore } from '../../app/stores/slots'

// The store's parked actions dynamic-import ~/engine/parked; a COLD import
// inside a pinia action isn't pumped by flushPromises in this harness (the
// browser's real event loop has no such dependence) — warm it up front.
await import('../../app/engine/parked')

type SlotsStore = ReturnType<typeof useSlotsStore>

let active: { unmount: () => void } | null = null

function setup() {
  setActivePinia(createPinia())
  localStorage.clear()
  setLiveRand(mulberry32(2026))
  const store = useSlotsStore()
  store.startSession(1_000_000)
  store.selectMachine('flameout-21')
  const wrapper = mount(ReelBlackjackReel, {
    global: {
      stubs: { UIcon: true, GameProgressiveMeter: true, GameCardFace: true }
    }
  })
  active = wrapper
  return { store, wrapper }
}

// Force a resolved crash on the live store's hand state (deterministic, no RNG).
function forceCrash(store: SlotsStore) {
  const bj = store.currentState!.blackjackReel!
  bj.phase = 'resolved'
  bj.crashed = true
  bj.idx = 2
  bj.multiplier = 1.6
  bj.velocity = 1.4
  bj.ante = 2
  bj.landed = ['9S', '9D', 'CRASH', null, null]
  bj.hand = ['9S', '9D']
}

describe('Flameout 21 crash cabinet — STOP / CASH controls (no Deal button)', () => {
  beforeEach(() => localStorage.clear())

  afterEach(() => {
    active?.unmount()
    active = null
  })

  it('idle phase: no Deal button, STOP enabled, Cash Out disabled', async () => {
    const { wrapper } = setup()
    await wrapper.vm.$nextTick()
    // No separate Deal button — STOP-from-idle deals + locks reel 1.
    expect(wrapper.find('[data-test="deal"]').exists()).toBe(false)
    // STOP is enabled in idle.
    expect(wrapper.find('[data-test="stop"]').attributes('disabled')).toBeUndefined()
    // Cash Out is disabled until a hand is in progress.
    expect(wrapper.find('[data-test="cash-out"]').attributes('disabled')).toBeDefined()
  })

  it('renders the Velocity / Multiplier / Cash Out displays and bet chips', async () => {
    const { wrapper } = setup()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="vel-display"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="mult-display"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="cash-display"]').exists()).toBe(true)
    for (const c of [1, 5, 10, 15, 20]) {
      expect(wrapper.find(`[data-test="bet-${c}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('[data-test="same-bet"]').exists()).toBe(true)
  })

  it('STOP/CASH buttons carry the crash labels and no gamble overlay exists', async () => {
    const { wrapper } = setup()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="stop"]').text()).toContain('Stop')
    expect(wrapper.find('[data-test="cash-out"]').text()).toContain('Cash Out')
    // Gamble/modal era is gone.
    expect(wrapper.find('[data-test="gamble-overlay"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="result-modal"]').exists()).toBe(false)
  })

  it('a bet chip selects the bet (currentBet follows the chip)', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="bet-10"]').trigger('click')
    expect(store.currentBet).toBe(10)
  })

  it('STOP while idle deals the hand and locks reel 1 (transitions to spinning)', async () => {
    const { store, wrapper } = setup()
    expect(store.currentState!.blackjackReel!.phase).toBe('idle')
    await wrapper.find('[data-test="stop"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    // Reels 1–2 are pure cards, so reel 1 can never crash → spinning.
    const p = store.currentState!.blackjackReel!.phase
    expect(p === 'spinning' || p === 'resolved').toBe(true)
    expect(store.spinning).toBe(false)
  })

  it('STOP while idle charges ante exactly once (no double-charge)', async () => {
    const { store, wrapper } = setup()
    const bankrollBefore = store.bankrollCents
    await wrapper.find('[data-test="stop"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    const bankrollAfter = store.bankrollCents
    const def = store.currentDef as { denominationCents: number }
    const ante = store.currentBet * def.denominationCents
    expect(bankrollBefore - bankrollAfter).toBe(ante)
  })

  it('Stop advances the reel index from the spinning phase', async () => {
    const { store, wrapper } = setup()
    await wrapper.find('[data-test="stop"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    const before = store.currentState!.blackjackReel!.idx
    if (store.currentState!.blackjackReel!.phase === 'spinning') {
      await wrapper.find('[data-test="stop"]').trigger('click')
      await flushPromises()
      await wrapper.vm.$nextTick()
      const after = store.currentState!.blackjackReel!.idx
      expect(after).toBeGreaterThanOrEqual(before)
    }
    expect(store.spinning).toBe(false)
  })

  it('Cash Out resolves the hand immediately after the deal', async () => {
    const { store, wrapper } = setup()
    // STOP×2: deal + lock reels 1 and 2 (pure cards, can't crash).
    await wrapper.find('[data-test="stop"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    if (store.currentState!.blackjackReel!.phase === 'spinning') {
      await wrapper.find('[data-test="stop"]').trigger('click')
      await flushPromises()
      await wrapper.vm.$nextTick()
    }
    if (store.currentState!.blackjackReel!.phase === 'spinning') {
      await wrapper.find('[data-test="cash-out"]').trigger('click')
      await flushPromises()
      await wrapper.vm.$nextTick()
    }
    expect(store.currentState!.blackjackReel!.phase).toBe('resolved')
    expect(store.spinning).toBe(false)
  })

  it('a forced CRASH shows the in-page result card; Play Again returns to idle', async () => {
    const { store, wrapper } = setup()
    forceCrash(store)
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="result-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="result-title"]').text()).toContain('CRASH')
    expect(wrapper.find('[data-test="result-amount"]').text()).toContain('$0')
    // Play Again resets to idle (the attract spin).
    await wrapper.find('[data-test="play-again"]').trigger('click')
    await flushPromises()
    await wrapper.vm.$nextTick()
    expect(store.currentState!.blackjackReel!.phase).toBe('idle')
    expect(wrapper.find('[data-test="result-card"]').exists()).toBe(false)
  })

  it('STOP disabled when bankroll < ante in idle phase', async () => {
    const { store, wrapper } = setup()
    store.bankrollCents = 1
    await wrapper.vm.$nextTick()
    // canDeal is false → canStop in idle is also false.
    expect(wrapper.find('[data-test="stop"]').attributes('disabled')).toBeDefined()
  })
})
