// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useReelSpin } from '../app/composables/useReelSpin'
import { useSlotsStore } from '../app/stores/slots'

const bank = {
  spinStart: vi.fn(),
  reelStop: vi.fn(),
  reveal: vi.fn()
}
// (vi.mock is hoisted above the imports by vitest's transform.)
vi.mock('../app/utils/soundBank', () => ({
  voiceFor: vi.fn(() => bank)
}))

const reduced = ref(false)
vi.mock('../app/composables/useReducedMotion', () => ({
  useReducedMotion: () => reduced
}))

function mountHarness() {
  const Harness = defineComponent({
    setup() {
      useReelSpin({
        reelCount: () => 3,
        visibleRows: 3,
        grid: () => [['A'], ['B'], ['C']],
        filler: () => ['A', 'B', 'C']
      })
      return () => h('div')
    }
  })
  return mount(Harness)
}

describe('useReelSpin sound wiring', () => {
  let wrapper: VueWrapper
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    localStorage.clear()
    reduced.value = false
    vi.clearAllMocks()
  })
  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
  })

  async function startSpin() {
    const store = useSlotsStore()
    store.startSession(100_000)
    store.selectMachine('diamond-doubler')
    wrapper = mountHarness()
    store.spinning = true // drive the watcher directly; outcome preset below
    store.lastOutcome = { coinsIn: 3, totalPayout: 0, featureEvents: [], progressiveEvents: [], wins: [] } as never
    await wrapper.vm.$nextTick()
    return store
  }

  it('plays spinStart, one reelStop per reel in order, then exactly one reveal', async () => {
    await startSpin()
    expect(bank.spinStart).toHaveBeenCalledTimes(1)
    expect(bank.reveal).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1100) // reel 0 lands
    expect(bank.reelStop).toHaveBeenCalledTimes(1)
    expect(bank.reelStop).toHaveBeenNthCalledWith(1, 0, 3)

    vi.advanceTimersByTime(220) // reel 1
    vi.advanceTimersByTime(220) // reel 2 (last) → reveal
    expect(bank.reelStop).toHaveBeenCalledTimes(3)
    expect(bank.reelStop).toHaveBeenNthCalledWith(3, 2, 3)
    expect(bank.reveal).toHaveBeenCalledTimes(1)
  })

  it('reduced motion: no ticks — one settle click + the reveal', async () => {
    reduced.value = true
    await startSpin()
    expect(bank.spinStart).not.toHaveBeenCalled()
    expect(bank.reelStop).toHaveBeenCalledTimes(1) // the settle click
    expect(bank.reveal).toHaveBeenCalledTimes(1)
  })

  it('unmounting mid-spin never fires the reveal', async () => {
    await startSpin()
    vi.advanceTimersByTime(1100) // one reel landed
    wrapper.unmount()
    vi.advanceTimersByTime(5000)
    expect(bank.reveal).not.toHaveBeenCalled()
  })
})
