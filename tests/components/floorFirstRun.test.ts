// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IndexPage from '../../app/pages/index.vue'

const stubs = {
  NuxtLink: { template: '<a><slot /></a>' },
  UButton: true,
  UIcon: true,
  FloorBankrollSetup: { template: '<form data-test="bankroll-setup" />' },
  FloorFeaturedMachine: { props: ['def'], template: '<div data-test="featured-card" />' },
  FloorMachineCard: { props: ['def'], template: '<div data-test="machine-card" />' }
}

// First-run: a brand-new visitor must SEE the walk-up free-play Featured
// machine (and a learn pointer) without first inventing a bankroll — the
// bankroll form gates only the nine betting machines.
describe('floor first-run (no session yet)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('shows the free-play Featured card above the bankroll gate', () => {
    const w = mount(IndexPage, { global: { stubs } })
    expect(w.find('[data-test="featured-card"]').exists()).toBe(true)
    expect(w.find('[data-test="bankroll-setup"]').exists()).toBe(true)
    const html = w.html()
    expect(html.indexOf('featured-card')).toBeLessThan(html.indexOf('bankroll-setup'))
    expect(w.text().toLowerCase()).toContain('free play')
    // the nine betting machines stay behind the session gate
    expect(w.find('[data-test="machine-card"]').exists()).toBe(false)
  })
})
