// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FeaturedMachine from '../../app/components/floor/FeaturedMachine.vue'
import { FEATURED_COPY } from '../../app/components/floor/featuredCopy'
import { FEATURED_ID, FLOOR } from '../../app/machines'
import { WONDER_WHEEL } from '../../app/machines/wonder-wheel'
import { TEMPLE_OF_GOLD } from '../../app/machines/temple-of-gold'

const stubs = { UIcon: true, NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

describe('the revolving Featured slot', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('the curated headliner is Wonder Wheel and has copy', () => {
    expect(FEATURED_ID).toBe('wonder-wheel')
    expect(FLOOR.some(d => d.id === FEATURED_ID)).toBe(true)
    expect(FEATURED_COPY[FEATURED_ID]).toBeDefined()
  })

  it('renders whichever def it is handed — the housing is data-driven', () => {
    const wheel = mount(FeaturedMachine, { props: { def: WONDER_WHEEL }, global: { stubs } })
    expect(wheel.text()).toContain('WONDER WHEEL')
    expect(wheel.text().toLowerCase()).toContain('wedge weight')
    const temple = mount(FeaturedMachine, { props: { def: TEMPLE_OF_GOLD }, global: { stubs } })
    expect(temple.text()).toContain('TEMPLE OF GOLD')
    expect(temple.text().toLowerCase()).toContain('free play')
  })

  it('past headliners keep their copy so the spotlight can revolve back', () => {
    expect(FEATURED_COPY['temple-of-gold']).toBeDefined()
  })
})
