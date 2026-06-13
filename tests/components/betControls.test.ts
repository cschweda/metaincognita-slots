// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BetControls from '../../app/components/game/BetControls.vue'
import { useSlotsStore } from '../../app/stores/slots'

function setup(machineId: string) {
  setActivePinia(createPinia())
  const store = useSlotsStore()
  localStorage.clear()
  store.startSession(1_000_000)
  store.selectMachine(machineId)
  const wrapper = mount(BetControls, {
    global: {
      stubs: { UIcon: true, UButton: { template: '<button v-bind="$attrs"><slot /></button>' } }
    }
  })
  return { store, wrapper }
}

describe('BetControls', () => {
  beforeEach(() => localStorage.clear())

  it('steppable bet on selectable-line machines', async () => {
    const { store, wrapper } = setup('canal-royale')
    expect(wrapper.text()).toContain('25')
    await wrapper.find('[data-test="bet-down"]').trigger('click')
    expect(store.currentBet).toBe(24)
    await wrapper.find('[data-test="bet-up"]').trigger('click')
    expect(store.currentBet).toBe(25)
  })

  it('fixed-bet machines show the reason and no steppers', () => {
    const { wrapper } = setup('dragons-hoard')
    expect(wrapper.find('[data-test="bet-up"]').exists()).toBe(false)
    expect(wrapper.text()).toMatch(/all 243 ways/i)
  })

  it('pachislo is locked at 3 tokens with the full-bet lesson', () => {
    const { wrapper } = setup('stock-rush')
    expect(wrapper.find('[data-test="bet-up"]').exists()).toBe(false)
    expect(wrapper.text()).toMatch(/full bet/i)
  })

  it('spin button disables when broke', async () => {
    const { store, wrapper } = setup('canal-royale')
    store.bankrollCents = 3
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="spin"]').attributes('disabled')).toBeDefined()
  })
})
