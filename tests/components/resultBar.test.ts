// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ResultBar from '../../app/components/game/ResultBar.vue'
import { useSlotsStore } from '../../app/stores/slots'

function setup() {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100000)
  store.selectMachine('canal-royale')
  const wrapper = mount(ResultBar, { global: { stubs: { UIcon: true } } })
  return { store, wrapper }
}

describe('ResultBar', () => {
  beforeEach(() => localStorage.clear())

  it('hidden until a result exists; shows WIN + bankroll-now + chips and holds', async () => {
    const { store, wrapper } = setup()
    expect(wrapper.find('[data-test="result-bar"]').exists()).toBe(false)
    store.spinning = false
    store.lastOutcome = {
      machineId: 'canal-royale', grid: [], totalPayout: 1030, coinsIn: 25,
      wins: [{ line: 'line-1', entryId: 'kk5', symbols: ['KK', 'KK', 'KK', 'KK', 'KK'], payCredits: 100, wildCount: 0, progressive: false }]
    } as never
    await wrapper.vm.$nextTick()
    const bar = wrapper.find('[data-test="result-bar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('WIN +1,030')
    expect(bar.text()).toContain('Bankroll now')
    expect(bar.text()).toContain('Kings')
  })

  it('shows "No win" for a zero-payout outcome', async () => {
    const { store, wrapper } = setup()
    store.spinning = false
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 0, coinsIn: 25, wins: [] } as never
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').text()).toContain('No win')
  })

  it('hides while spinning (cleared for the next spin)', async () => {
    const { store, wrapper } = setup()
    store.spinning = false
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 10, coinsIn: 25, wins: [{ line: 'line-1', entryId: 'jj3', symbols: ['JJ', 'JJ', 'JJ'], payCredits: 5, wildCount: 0, progressive: false }] } as never
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').exists()).toBe(true)
    store.spinning = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').exists()).toBe(false)
  })
})
