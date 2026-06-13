// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useReelSpin } from '../../app/composables/useReelSpin'
import { useSlotsStore } from '../../app/stores/slots'

const GRID = [['AA', 'KK', 'QQ'], ['AA', 'KK', 'QQ'], ['AA', 'KK', 'QQ'], ['AA', 'KK', 'QQ'], ['AA', 'KK', 'QQ']]

function harness() {
  return defineComponent({
    setup() {
      const api = useReelSpin({ reelCount: () => 5, visibleRows: 3, grid: () => GRID, filler: () => ['AA', 'KK'] })
      return { api }
    },
    render() { return h('div') }
  })
}
function apiOf(w: ReturnType<typeof mount>) {
  return (w.vm as unknown as { api: { revealed: { value: number }, strips: { value: string[][] } } }).api
}

describe('useReelSpin', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })
  afterEach(() => vi.useRealTimers())

  it('reveals all reels and calls revealDone after the staggered timers', async () => {
    const store = useSlotsStore()
    store.startSession(100000)
    store.selectMachine('canal-royale')
    const w = mount(harness())
    const done = vi.spyOn(store, 'revealDone')
    store.spinning = true
    await w.vm.$nextTick()
    await new Promise(r => setTimeout(r, 2600))
    expect(apiOf(w).revealed.value).toBe(5)
    expect(done).toHaveBeenCalled()
  })

  it('revealed climbs monotonically to the reel count', async () => {
    const store = useSlotsStore()
    store.startSession(100000)
    store.selectMachine('canal-royale')
    const w = mount(harness())
    store.spinning = true
    await w.vm.$nextTick()
    await new Promise(r => setTimeout(r, 1200))
    const mid = apiOf(w).revealed.value
    await new Promise(r => setTimeout(r, 1600))
    expect(apiOf(w).revealed.value).toBeGreaterThanOrEqual(mid)
    expect(apiOf(w).revealed.value).toBe(5)
  })
})
