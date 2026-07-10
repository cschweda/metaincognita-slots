// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReelLockReel from '../../app/components/game/ReelLockReel.vue'
import { useSlotsStore } from '../../app/stores/slots'

// The store's parked actions dynamic-import ~/engine/parked; a COLD import
// inside a pinia action isn't pumped by flushPromises in this harness (the
// browser's real event loop has no such dependence) — warm it up front.
await import('../../app/engine/parked')

function withLockReel() {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100000)
  store.selectMachine('stop-and-lock-777')
  const wrapper = mount(ReelLockReel, {
    global: {
      stubs: { UIcon: true, GameProgressiveMeter: true, GameSymbolIcon: true, GameCardFace: true }
    }
  })
  return { wrapper, store }
}

describe('Stop & Lock 777 surface (big-daddy cabinet)', () => {
  beforeEach(() => localStorage.clear())

  it('renders the cabinet, five STOP keys, the 5×4 grid, the seven meter, collect, and bet chips in idle', () => {
    const { wrapper } = withLockReel()
    expect(wrapper.find('[data-test="sl-surface"]').exists()).toBe(true)
    // five 3-D STOP keys
    for (const i of [1, 2, 3, 4, 5]) {
      expect(wrapper.find(`[data-test="stop-${i}"]`).exists()).toBe(true)
    }
    // 5 columns × 4 rows = 20 grid cells
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        expect(wrapper.find(`[data-test="cell-${r}-${c}"]`).exists()).toBe(true)
      }
    }
    // the three-7 bonus meter + the collect readout
    expect(wrapper.find('[data-test="seven-meter"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="collect"]').exists()).toBe(true)
    // bet chips key on coins 1/4/8/12/20 and read round dollars at 25¢/coin
    const chips = { 1: '25¢', 4: '$1', 8: '$2', 12: '$3', 20: '$5' } as const
    for (const [coins, label] of Object.entries(chips)) {
      const chip = wrapper.find(`[data-test="bet-${coins}"]`)
      expect(chip.exists()).toBe(true)
      expect(chip.text()).toBe(label)
    }
    // no leftover chips from the old $1/$5/$10/$15 ladder
    for (const c of [5, 10, 15]) {
      expect(wrapper.find(`[data-test="bet-${c}"]`).exists()).toBe(false)
    }
  })

  it('the 1-coin default bet reads "25¢" on the deck (cents, never "$0")', () => {
    const { wrapper, store } = withLockReel()
    expect(store.currentBet).toBe(1)
    const deck = wrapper.find('[data-test="sl-surface"]').text()
    expect(deck).toContain('25¢')
    expect(deck).not.toContain('$0')
  })

  it('the live (first) STOP key is the only enabled one while spinning', async () => {
    const { wrapper, store } = withLockReel()
    const lr = store.currentState!.lockReel!
    lr.phase = 'spinning'
    lr.idx = 0
    lr.ante = 1
    await wrapper.vm.$nextTick()
    expect((wrapper.find('[data-test="stop-1"]').element as HTMLButtonElement).disabled).toBe(false)
    expect((wrapper.find('[data-test="stop-2"]').element as HTMLButtonElement).disabled).toBe(true)
  })

  it('pressing the live STOP key locks a reel and advances idx', async () => {
    const { wrapper, store } = withLockReel()
    // deal first (idle → stop deals + locks reel 1)
    await wrapper.find('[data-test="stop-1"]').trigger('click')
    await flushPromises()
    const lr = store.currentState!.lockReel!
    expect(lr.phase).toBe('spinning')
    expect(lr.idx).toBe(1)
    // reel 1's column is now stopped (no nulls)
    expect(lr.grid[0]!.every(c => c !== null)).toBe(true)
  })

  it('a forced stopped column renders its locked symbols in the grid cells', async () => {
    const { wrapper, store } = withLockReel()
    const lr = store.currentState!.lockReel!
    lr.phase = 'spinning'
    lr.idx = 1
    lr.ante = 1
    lr.grid[0] = ['C5', 'SEVEN', 'BLANK', 'C1'] // column 0, rows 0..3
    lr.collectCredits = 3
    await wrapper.vm.$nextTick()
    // row 0 col 0 = C5 (5 credits × 1 coin × 25¢ = 125¢ → "$1.25")
    expect(wrapper.find('[data-test="cell-0-0"]').text()).toBe('$1.25')
    // row 3 col 0 = C1 (1 credit × 1 coin × 25¢ = 25¢ → cents, not "$0")
    expect(wrapper.find('[data-test="cell-3-0"]').text()).toBe('25¢')
    // row 1 col 0 = a 7
    expect(wrapper.find('[data-test="cell-1-0"]').text()).toContain('7')
    // sub-dollar collect (3 credits = 75¢) reads cents, never "$0"
    expect(wrapper.find('[data-test="collect"]').text()).toBe('75¢')
  })

  it('lights the seven meter as sevens lock', async () => {
    const { wrapper, store } = withLockReel()
    const lr = store.currentState!.lockReel!
    lr.phase = 'spinning'
    lr.idx = 2
    lr.ante = 1
    lr.sevenCount = 2
    await wrapper.vm.$nextTick()
    // first two lamps lit, the third is the chasing/spinning one
    expect(wrapper.find('[data-test="seven-0"]').classes()).toContain('bd-locked')
    expect(wrapper.find('[data-test="seven-1"]').classes()).toContain('bd-locked')
    expect(wrapper.find('[data-test="seven-2"]').classes()).toContain('bd-spin')
  })

  it('shows the bonus presentation in the bonus phase', async () => {
    const { wrapper, store } = withLockReel()
    const lr = store.currentState!.lockReel!
    lr.phase = 'bonus'
    lr.idx = 5
    lr.ante = 1
    lr.sevenCount = 3
    lr.respinsLeft = 2
    lr.collectCredits = 30
    // a full (stopped) grid is required by the bonus invariant
    lr.grid = lr.grid.map(() => ['SEVEN', 'C1', 'BLANK', 'C2'])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="bonus"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="bonus-spin"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="bonus-respins"]').text()).toBe('2')
  })

  it('shows the result card + Play Again in the resolved phase', async () => {
    const { wrapper, store } = withLockReel()
    const lr = store.currentState!.lockReel!
    lr.phase = 'resolved'
    lr.idx = 5
    lr.ante = 1
    lr.sevenCount = 1
    lr.collectCredits = 12
    lr.grid = lr.grid.map(() => ['C1', 'BLANK', 'C2', 'BLANK'])
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-test="result"]').exists()).toBe(true)
    expect(wrapper.find('[data-test="result-title"]').text()).toContain('COLLECT')
    expect(wrapper.find('[data-test="result-amount"]').text()).toContain('$')
    expect(wrapper.find('[data-test="play-again"]').exists()).toBe(true)
  })
})
