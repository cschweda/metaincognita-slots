// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReelVideo from '../../app/components/game/ReelVideo.vue'
import GameReelColumn from '../../app/components/game/ReelColumn.vue'
import { useSlotsStore } from '../../app/stores/slots'

const IconStub = { props: ['icon', 'label', 'wild', 'size'], template: '<i data-test="cell" :data-icon="icon" />' }
const OverlayStub = { props: ['lines', 'gutter', 'cellPx', 'gapPx', 'rows', 'cols'], template: '<div data-test="overlay" />' }

function setup() {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100000)
  store.selectMachine('canal-royale')
  const wrapper = mount(ReelVideo, {
    global: {
      components: { GameReelColumn },
      stubs: { UIcon: true, GameProgressiveMeter: true, GameSymbolIcon: IconStub, GamePaylineOverlay: OverlayStub }
    }
  })
  return { store, wrapper }
}

describe('ReelVideo', () => {
  beforeEach(() => localStorage.clear())

  it('renders 15 symbol-icon cells for the idle 5x3 grid', () => {
    const { wrapper } = setup()
    expect(wrapper.findAll('[data-test="cell"]').length).toBeGreaterThanOrEqual(15)
  })

  it('mounts the payline overlay', () => {
    const { wrapper } = setup()
    expect(wrapper.find('[data-test="overlay"]').exists()).toBe(true)
  })

  it('renders a multiplier gem on the lock board', () => {
    setActivePinia(createPinia())
    localStorage.clear()
    const store = useSlotsStore()
    store.startSession(100000)
    store.selectMachine('thunder-vault')
    store.currentState!.videoFeature = {
      kind: 'holdAndSpin',
      locked: [{ mult: 2 }, { credits: 25 }, ...new Array(13).fill(null)],
      respins: 3,
      coins: 25
    }
    const wrapper = mount(ReelVideo, {
      global: {
        components: { GameReelColumn },
        stubs: { UIcon: true, GameProgressiveMeter: true, GameSymbolIcon: IconStub, GamePaylineOverlay: OverlayStub }
      }
    })
    const board = wrapper.find('[data-test="lock-board"]')
    expect(board.exists()).toBe(true)
    expect(board.text()).toContain('×2')
  })
})
