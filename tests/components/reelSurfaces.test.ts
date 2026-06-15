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
      stubs: { UIcon: true, GameProgressiveMeter: true, GameSymbolIcon: IconStub }
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

  // Five-Card Charlie is rare in live play (~11.6%, and the ten-heavy 5th reel busts most
  // climbs), so its render branch is easy to miss in a manual smoke. Mount the resolved
  // 5-card surviving state directly and assert the badge + banner render.
  it('blackjack-reel renders the Five-Card Charlie badge + banner on a surviving 5-card hand', () => {
    setActivePinia(createPinia())
    localStorage.clear()
    const store = useSlotsStore()
    store.startSession(100000)
    store.selectMachine('hit-or-bust')
    const bj = store.currentState!.blackjackReel!
    bj.phase = 'resolved'
    bj.cards = ['C2', 'C3', 'C4', 'C5', 'C6']
    bj.total = 20
    bj.isSoft = false
    bj.multSum = 0
    bj.saveHeld = false
    bj.busted = false
    bj.charlie = true
    const wrapper = mount(ReelBlackjackReel, {
      global: { stubs: { UIcon: true, GameSymbolIcon: IconStub } }
    })
    expect(wrapper.find('[data-test="charlie-badge"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('FIVE-CARD CHARLIE')
    expect(wrapper.text()).toContain('Five-Card Charlie — Total 20')
  })
})
