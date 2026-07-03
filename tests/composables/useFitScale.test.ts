// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { useFitScale } from '../../app/composables/useFitScale'

type ROCallback = (entries: unknown[], observer: unknown) => void
class FakeRO {
  static last: FakeRO | null = null
  cb: ROCallback
  observe = vi.fn()
  disconnect = vi.fn()
  constructor(cb: ROCallback) {
    this.cb = cb
    FakeRO.last = this
  }
}

function harness(base: number) {
  let api!: ReturnType<typeof useFitScale>
  const cmp = defineComponent({
    setup() {
      api = useFitScale(base)
      return () => h('div', { ref: api.host })
    }
  })
  const w = mount(cmp)
  return { w, api }
}

// The video reel window is a fixed 556px; inside overflow:hidden chrome it
// silently clipped reels 4-5 on phones. useFitScale watches the available
// width and yields the shrink factor the cabinet applies as a transform.
describe('useFitScale', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('scales down when the host is narrower than the base width', async () => {
    vi.stubGlobal('ResizeObserver', FakeRO)
    const { w, api } = harness(556)
    Object.defineProperty(w.element, 'clientWidth', { value: 334, configurable: true })
    FakeRO.last!.cb([], FakeRO.last)
    await nextTick()
    expect(api.scale.value).toBeCloseTo(334 / 556, 5)
  })

  it('never scales past 1, and treats width 0 (hidden/SSR) as 1', () => {
    vi.stubGlobal('ResizeObserver', FakeRO)
    const { w, api } = harness(556)
    Object.defineProperty(w.element, 'clientWidth', { value: 900, configurable: true })
    FakeRO.last!.cb([], FakeRO.last)
    expect(api.scale.value).toBe(1)
    Object.defineProperty(w.element, 'clientWidth', { value: 0, configurable: true })
    FakeRO.last!.cb([], FakeRO.last)
    expect(api.scale.value).toBe(1)
  })

  it('observes the host on mount and disconnects on unmount', () => {
    vi.stubGlobal('ResizeObserver', FakeRO)
    const { w } = harness(556)
    const ro = FakeRO.last!
    expect(ro.observe).toHaveBeenCalledWith(w.element)
    w.unmount()
    expect(ro.disconnect).toHaveBeenCalled()
  })
})
