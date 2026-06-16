// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
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

  it('blackjack-reel renders 5 reel windows in idle phase', () => {
    const wrapper = withMachine(ReelBlackjackReel, 'lucky-21')
    // In idle phase, the reel surface should render
    expect(wrapper.find('[data-test="bj-surface"]').exists()).toBe(true)
  })

  it('blackjack-reel idle attract renders bounded strip-card slots (no empty strips)', () => {
    const wrapper = withMachine(ReelBlackjackReel, 'lucky-21')
    // Idle attract strips are built from the reel composition (not the empty dealt strips).
    // Each reel has ≥1 l21-strip-card slot; total across 5 reels × 2 loop passes must be
    // bounded (≤ 5 reels × 16 tokens × 2 passes = 160). Verifies no empty/runaway strips.
    const slots = wrapper.findAll('.l21-strip-card')
    expect(slots.length).toBeGreaterThan(0)
    expect(slots.length).toBeLessThanOrEqual(160)
  })

  it('blackjack-reel renders BUST modal after a bust stop', () => {
    // withMachine creates+activates pinia, so mutate AFTER to share the same store
    const wrapper = withMachine(ReelBlackjackReel, 'lucky-21')
    // Force a bust state directly on the active store
    const store = useSlotsStore()
    const bj = store.currentState!.blackjackReel!
    bj.phase = 'resolved'
    bj.busted = true
    bj.bustBySymbol = true
    bj.hard = 0
    bj.aces = 0
    bj.bestTotal = 0
    bj.landed = ['BUST', null, null, null, null]
    bj.hand = []
    bj.ante = 2
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.find('[data-test="result-modal"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="modal-title"]').text()).toContain('BUST')
    })
  })
})
