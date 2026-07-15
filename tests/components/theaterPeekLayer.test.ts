// tests/components/theaterPeekLayer.test.ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TheaterPeekLayer from '../../app/components/game/TheaterPeekLayer.vue'
import { useSlotsStore } from '../../app/stores/slots'
import { useTheater } from '../../app/composables/useTheater'

const stubs = { GameXrayContent: true, GameCascadeXray: true }

describe('TheaterPeekLayer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    useTheater().exit()
  })

  it('renders nothing while peek is off', () => {
    const w = mount(TheaterPeekLayer, { global: { stubs } })
    expect(w.find('[data-test="peek-layer"]').exists()).toBe(false)
  })

  it('renders the X-ray content when peeking', async () => {
    const t = useTheater()
    t.peek.value = 'pinned'
    const w = mount(TheaterPeekLayer, { global: { stubs } })
    await w.vm.$nextTick()
    expect(w.find('[data-test="peek-layer"]').exists()).toBe(true)
    expect(w.findComponent({ name: 'GameXrayContent' }).exists()).toBe(true)
  })

  it('renders the cascade X-ray (not the shared X-ray) for Temple of Gold', async () => {
    const store = useSlotsStore()
    store.selectMachine('temple-of-gold')
    useTheater().peek.value = 'pinned'
    const w = mount(TheaterPeekLayer, { global: { stubs } })
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'GameCascadeXray' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'GameXrayContent' }).exists()).toBe(false)
  })

  it('renders the shared X-ray (not the cascade X-ray) for a video machine', async () => {
    const store = useSlotsStore()
    store.selectMachine('canal-royale')
    useTheater().peek.value = 'pinned'
    const w = mount(TheaterPeekLayer, { global: { stubs } })
    await w.vm.$nextTick()
    expect(w.findComponent({ name: 'GameXrayContent' }).exists()).toBe(true)
    expect(w.findComponent({ name: 'GameCascadeXray' }).exists()).toBe(false)
  })
})
