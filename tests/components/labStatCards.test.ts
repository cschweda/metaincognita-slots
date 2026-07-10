// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LabStatCards from '../../app/components/lab/LabStatCards.vue'
import type { SimLabResult } from '../../app/engine/sessions'

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

// Only the fields the card grid reads matter for this display test.
const result = {
  machineId: 'diamond-doubler',
  riskOfRuin: 0.25,
  pctAhead: 0.3,
  medianEnd: 50,
  meanEnd: 60,
  avgSpins: 120,
  avgMaxDrawdown: 40,
  empiricalRtp: 0.9,
  houseEdge: 0.1
} as unknown as SimLabResult

describe('LabStatCards', () => {
  it('glosses every stat in plain English and links the glossary', () => {
    setActivePinia(createPinia())
    const w = mount(LabStatCards, { props: { result }, global: { stubs } })
    // every card carries a plain-English title gloss
    const cards = w.findAll('[data-test="lab-stat"]')
    expect(cards.length).toBe(8)
    for (const c of cards) {
      expect((c.attributes('title') ?? '').length, `${c.text()} needs a gloss`).toBeGreaterThan(20)
    }
    // and the footer points at the glossary
    const hrefs = w.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/learn/glossary')
  })
})
