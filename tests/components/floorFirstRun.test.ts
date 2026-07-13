// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IndexPage from '../../app/pages/index.vue'
import { FEATURED_ID, FLOOR } from '../../app/machines'

const stubs = {
  NuxtLink: { template: '<a><slot /></a>' },
  UButton: true,
  UIcon: true,
  FloorBankrollSetup: { template: '<form data-test="bankroll-setup" />' },
  FloorFeaturedMachine: { props: ['def'], template: '<div data-test="featured-card">{{ def.id }}</div>' },
  FloorMachineCard: { props: ['def'], template: '<div data-test="machine-card">{{ def.id }}</div>' }
}

function ids(w: ReturnType<typeof mount>, sel: string) {
  return w.findAll(`[data-test="${sel}"]`).map(el => el.text())
}

// First-run: a brand-new visitor sees the WHOLE floor — the headliner AND every
// other machine — before inventing a bankroll. The floor is a showroom you can
// walk; the bankroll is dialed on the way into a betting cabinet, not at the door.
describe('floor first-run (no session yet)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('features the curated headliner (not the free-play trainer)', () => {
    const w = mount(IndexPage, { global: { stubs } })
    expect(w.find('[data-test="featured-card"]').text()).toBe(FEATURED_ID)
  })

  it('shows EVERY other machine on the grid — nothing hides behind the bankroll gate', () => {
    const w = mount(IndexPage, { global: { stubs } })
    const cards = ids(w, 'machine-card')
    // the headliner is on the big card, everyone else is on the grid: all 11 visible
    expect(cards).toHaveLength(FLOOR.length - 1)
    expect(cards).not.toContain(FEATURED_ID)
    expect([...cards, FEATURED_ID].sort()).toEqual(FLOOR.map(d => d.id).sort())
  })

  it('the free-play trainer rides the grid like any other machine', () => {
    const w = mount(IndexPage, { global: { stubs } })
    expect(ids(w, 'machine-card')).toContain('temple-of-gold')
    expect(w.text().toLowerCase()).toContain('free play')
  })

  it('still offers the bankroll setup, above the grid', () => {
    const w = mount(IndexPage, { global: { stubs } })
    expect(w.find('[data-test="bankroll-setup"]').exists()).toBe(true)
    const html = w.html()
    expect(html.indexOf('bankroll-setup')).toBeLessThan(html.indexOf('machine-card'))
  })
})
