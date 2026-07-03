// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReelStepper from '../../app/components/game/ReelStepper.vue'
import ReelBally from '../../app/components/game/ReelBally.vue'
import ReelPachislo from '../../app/components/game/ReelPachislo.vue'
import ReelBlackjackReel from '../../app/components/game/ReelBlackjackReel.vue'
import GameReelColumn from '../../app/components/game/ReelColumn.vue'
import { useSlotsStore } from '../../app/stores/slots'

const IconStub = { props: ['icon', 'label', 'wild', 'size'], template: '<i data-test="cell" :data-icon="icon" />' }

function withMachine(Comp: unknown, id: string) {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100000)
  store.selectMachine(id)
  return mount(Comp as never, {
    global: {
      components: { GameReelColumn },
      stubs: { UIcon: true, GameProgressiveMeter: true, GameSymbolIcon: IconStub, GameCardFace: true }
    }
  })
}

describe('Reel surfaces', () => {
  beforeEach(() => localStorage.clear())
  it('stepper renders icon cells', () => {
    expect(withMachine(ReelStepper, 'diamond-doubler').findAll('[data-test="cell"]').length).toBeGreaterThanOrEqual(9)
  })
  it('bally renders icon cells', () => {
    expect(withMachine(ReelBally, 'series-e-3line').findAll('[data-test="cell"]').length).toBeGreaterThanOrEqual(9)
  })
  it('pachislo renders icon cells', () => {
    expect(withMachine(ReelPachislo, 'stock-rush').findAll('[data-test="cell"]').length).toBeGreaterThanOrEqual(9)
  })

  it('blackjack-reel (Flameout 21) renders the crash cabinet in idle phase', () => {
    const wrapper = withMachine(ReelBlackjackReel, 'flameout-21')
    // In idle phase the crash surface renders with its three displays.
    expect(wrapper.find('[data-test="bj-surface"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="vel-display"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="mult-display"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="cash-display"]').exists()).toBe(true)
  })

  it('blackjack-reel renders the bet-chip row and never a gamble overlay', () => {
    const wrapper = withMachine(ReelBlackjackReel, 'flameout-21')
    // Bet chips $1 · $5 · $10 · $15 · $20 + Same Bet.
    for (const c of [1, 5, 10, 15, 20]) {
      expect(wrapper.find(`[data-test="bet-${c}"]`).exists()).toBe(true)
    }
    expect(wrapper.find('[data-test="same-bet"]').exists()).toBe(true)
    // No leftover gamble/modal nodes from the old blackjack version.
    expect(wrapper.find('[data-test="gamble-overlay"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="result-modal"]').exists()).toBe(false)
  })

  it('blackjack-reel idle attract renders bounded strip-card slots (no empty strips)', () => {
    const wrapper = withMachine(ReelBlackjackReel, 'flameout-21')
    // Idle attract strips are built from the reel composition (not the empty dealt strips).
    // Each reel has ≥1 l21-strip-card slot; total across 5 reels × 2 loop passes must be
    // bounded (≤ 5 reels × 16 tokens × 2 passes = 160). Verifies no empty/runaway strips.
    const slots = wrapper.findAll('.l21-strip-card')
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.length).toBeLessThanOrEqual(160)
  })

  it('blackjack-reel renders the in-page CRASH result card after a crash (not a modal)', async () => {
    // withMachine creates+activates pinia, so mutate AFTER to share the same store
    const wrapper = withMachine(ReelBlackjackReel, 'flameout-21')
    const store = useSlotsStore()
    // Force a resolved crash directly on the active store's hand state.
    const bj = store.currentState!.blackjackReel!
    bj.phase = 'resolved'
    bj.crashed = true
    bj.idx = 2
    bj.multiplier = 1.6
    bj.velocity = 1.4
    bj.ante = 2
    bj.landed = ['9S', '9D', 'CRASH', null, null]
    bj.hand = ['9S', '9D']
    await nextTick()
    // The result is rendered in-page (no modal/dialog).
    const card = wrapper.find('[data-test="result-card"]')
    expect(card.exists()).toBe(true)
    expect(wrapper.find('[data-test="result-modal"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="result-title"]').text()).toContain('CRASH')
    expect(wrapper.find('[data-test="result-amount"]').text()).toContain('$0')
    expect(wrapper.find('[data-test="play-again"]').exists()).toBe(true)
  })

  it('blackjack-reel renders the in-page CASHED OUT result card after a cash', async () => {
    const wrapper = withMachine(ReelBlackjackReel, 'flameout-21')
    const store = useSlotsStore()
    const bj = store.currentState!.blackjackReel!
    bj.phase = 'resolved'
    bj.crashed = false
    bj.idx = 3
    bj.multiplier = 2.24
    bj.velocity = 1.4
    bj.ante = 1
    bj.landed = ['9S', '9D', 'CLIMB', null, null]
    bj.hand = ['9S', '9D']
    await nextTick()
    expect(wrapper.find('[data-test="result-card"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="result-title"]').text()).toContain('CASHED OUT')
    expect(wrapper.find('[data-test="result-amount"]').text()).toContain('$')
    expect(wrapper.find('[data-test="play-again"]').exists()).toBe(true)
  })
})
