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

  it('shows WIN + bankroll-now + chips and holds', async () => {
    const { store, wrapper } = setup()
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

  it('loss-disguised-as-a-win: a sub-bet payout shows the gross WIN but a negative net in rose', async () => {
    const { store, wrapper } = setup()
    store.spinning = false
    // Bet 25, paid 14 -> the machine cheers "WIN" but the player is down 11.
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 14, coinsIn: 25, wins: [] } as never
    await wrapper.vm.$nextTick()
    const bar = wrapper.find('[data-test="result-bar"]')
    expect(bar.text()).toContain('WIN +14')
    expect(bar.text()).toContain('net -11')
    expect(wrapper.get('[data-test="net"]').classes()).toContain('text-rose-400')
  })

  it('a genuine win (payout over the bet) shows a positive net in emerald', async () => {
    const { store, wrapper } = setup()
    store.spinning = false
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 1030, coinsIn: 25, wins: [] } as never
    await wrapper.vm.$nextTick()
    const bar = wrapper.find('[data-test="result-bar"]')
    expect(bar.text()).toContain('net +1,005')
    expect(wrapper.get('[data-test="net"]').classes()).toContain('text-emerald-400')
  })

  it('a no-win surfaces the forfeited bet as a negative net', async () => {
    const { store, wrapper } = setup()
    store.spinning = false
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 0, coinsIn: 25, wins: [] } as never
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').text()).toContain('net -25')
  })
})

// The Spin button sits directly under this card. If the card ever unmounts or
// changes height, Spin moves out from under the pointer mid-rattle — so the card
// holds a FIXED slot in every state: idle, spinning, resolved.
describe('ResultBar — the slot never collapses (Spin must not move)', () => {
  beforeEach(() => localStorage.clear())

  it('occupies its slot before the first spin, with nothing to report yet', () => {
    const { wrapper } = setup()
    const bar = wrapper.find('[data-test="result-bar"]')
    expect(bar.exists()).toBe(true)
    expect(wrapper.find('[data-test="result-idle"]').exists()).toBe(true)
    expect(bar.text()).not.toContain('net')
  })

  it('stays mounted through a spin instead of vanishing', async () => {
    const { store, wrapper } = setup()
    store.spinning = false
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 0, coinsIn: 25, wins: [] } as never
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').exists()).toBe(true)
    store.spinning = true
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').exists()).toBe(true)
  })

  // spinOnce() resolves the engine and books the outcome IMMEDIATELY, then the
  // reels animate and revealDone() flips `spinning` off. So while the reels are
  // still turning, store.lastOutcome ALREADY holds the new result — the card must
  // keep showing the OLD one or it spoils the spin it is sitting next to.
  it('HOLDS the previous result through the spin — never spoils the landing', async () => {
    const { store, wrapper } = setup()
    store.spinning = false
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 0, coinsIn: 25, wins: [] } as never
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').text()).toContain('No win')

    store.spinning = true // reels turning...
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 5000, coinsIn: 25, wins: [] } as never
    await wrapper.vm.$nextTick()
    const held = wrapper.find('[data-test="result-bar"]')
    expect(held.text()).toContain('No win') // still the OLD result
    expect(held.text()).not.toContain('5,000') // the jackpot is NOT leaked early

    store.spinning = false // reels land
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result-bar"]').text()).toContain('WIN +5,000')
  })
})

// Green = the bankroll rose. Amber = the machine said WIN and the bankroll fell
// anyway (the LDW). Red = no pay at all.
describe('ResultBar — win/loss dots on the bankroll sparkline', () => {
  beforeEach(() => localStorage.clear())

  it('marks one dot per spin, colored by what it did to the BANKROLL', async () => {
    const { store, wrapper } = setup()
    store.history = [
      { coinsInCents: 25, payoutCents: 0 }, // clean loss
      { coinsInCents: 25, payoutCents: 10 }, // LDW: paid, still down
      { coinsInCents: 25, payoutCents: 100 } // real win
    ] as never
    store.spinning = false
    store.lastOutcome = { machineId: 'canal-royale', grid: [], totalPayout: 100, coinsIn: 25, wins: [] } as never
    await wrapper.vm.$nextTick()

    const dots = wrapper.findAll('[data-test="spark-dot"]')
    expect(dots).toHaveLength(3) // the leading baseline point is a balance, not a spin
    expect(dots.map(d => d.attributes('data-kind'))).toEqual(['loss', 'ldw', 'win'])
  })
})
