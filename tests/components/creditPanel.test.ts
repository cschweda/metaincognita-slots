// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CreditPanel from '../../app/components/game/CreditPanel.vue'
import { useSlotsStore } from '../../app/stores/slots'

function setup() {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100000)
  store.selectMachine('canal-royale')
  const wrapper = mount(CreditPanel, { global: { stubs: { UIcon: true } } })
  return { store, wrapper }
}

describe('CreditPanel last-win gating', () => {
  beforeEach(() => localStorage.clear())

  it('holds the win figure while spinning, reveals it once the reels land (M1)', async () => {
    const { store, wrapper } = setup()
    store.lastOutcome = {
      machineId: 'canal-royale', grid: [], totalPayout: 1030, coinsIn: 25, wins: []
    } as never

    store.spinning = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="last-win"]').text()).not.toContain('1,030')

    store.spinning = false
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="last-win"]').text()).toContain('1,030')
  })
})
