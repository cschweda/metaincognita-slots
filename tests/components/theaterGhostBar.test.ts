// tests/components/theaterGhostBar.test.ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TheaterGhostBar from '../../app/components/game/TheaterGhostBar.vue'
import { useTheater } from '../../app/composables/useTheater'

const stubs = {
  UIcon: true,
  AppHubLink: { template: '<a data-test="hub-link" href="https://metaincognita.com" aria-label="METAINCOGNITA — exit the simulator, back to all the games">METAINCOGNITA</a>' }
}

describe('TheaterGhostBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => vi.useRealTimers())

  it('carries the hub exit AND a distinct exit-theater control', () => {
    const w = mount(TheaterGhostBar, { global: { stubs } })
    const hub = w.find('[data-test="hub-link"]')
    expect(hub.attributes('href')).toBe('https://metaincognita.com')
    expect(hub.attributes('aria-label')).toContain('METAINCOGNITA') // WCAG 2.5.3
    const exit = w.find('[data-test="exit-theater"]')
    expect(exit.exists()).toBe(true)
    expect(exit.element).not.toBe(hub.element) // two different controls
  })

  it('the exit-theater button calls useTheater().exit', async () => {
    const t = useTheater()
    t.setTarget(document.createElement('div'))
    t.enter()
    const w = mount(TheaterGhostBar, { global: { stubs } })
    await w.find('[data-test="exit-theater"]').trigger('click')
    expect(t.active.value).toBe(false)
  })

  it('sleeps after the idle timeout, wakes on interaction', async () => {
    const w = mount(TheaterGhostBar, { global: { stubs } })
    expect(w.find('[data-test="ghost-bar"]').classes()).toContain('is-awake')
    vi.advanceTimersByTime(3500)
    await w.vm.$nextTick()
    expect(w.find('[data-test="ghost-bar"]').classes()).not.toContain('is-awake')
    window.dispatchEvent(new Event('pointermove'))
    await w.vm.$nextTick()
    expect(w.find('[data-test="ghost-bar"]').classes()).toContain('is-awake')
  })
})
