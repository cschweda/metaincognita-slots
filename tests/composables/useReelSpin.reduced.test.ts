// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useReelSpin } from '../../app/composables/useReelSpin'
import { useSlotsStore } from '../../app/stores/slots'

vi.mock('~/composables/useReducedMotion', () => ({ useReducedMotion: () => ({ value: true }) }))

describe('useReelSpin (reduced motion)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })
  it('settles instantly and calls revealDone with no animation wait', async () => {
    const store = useSlotsStore()
    store.startSession(100000)
    store.selectMachine('canal-royale')
    const done = vi.spyOn(store, 'revealDone')
    const w = mount(defineComponent({
      setup() { return { api: useReelSpin({ reelCount: () => 5, visibleRows: 3, grid: () => [[], [], [], [], []], filler: () => ['AA'] }) } },
      render() { return h('div') }
    }))
    store.spinning = true
    await w.vm.$nextTick()
    expect((w.vm as unknown as { api: { revealed: { value: number } } }).api.revealed.value).toBe(5)
    expect(done).toHaveBeenCalled()
  })
})
