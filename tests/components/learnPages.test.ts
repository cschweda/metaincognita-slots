// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import LearnDisclosure from '../../app/components/learn/LearnDisclosure.vue'
import HouseEdge from '../../app/pages/learn/house-edge.vue'
import Telnaes from '../../app/pages/learn/telnaes-reels.vue'
import HoldAndSpin from '../../app/pages/learn/hold-and-spin.vue'
import GargoylesEye from '../../app/pages/learn/gargoyles-eye.vue'
import CascadeTumble from '../../app/pages/learn/cascade-tumble.vue'
import Pachislo from '../../app/pages/learn/pachislo.vue'
import LdwNearMiss from '../../app/pages/learn/ldw-near-miss.vue'
import Glossary from '../../app/pages/learn/glossary.vue'

const stubs = { NuxtLink: { template: '<a><slot /></a>' }, UIcon: true }

describe('LearnDisclosure', () => {
  it('renders a native details/summary with the label and slotted body', () => {
    const w = mount(LearnDisclosure, {
      props: { label: 'Show the math' },
      slots: { default: '<p data-test="body">derivation</p>' },
      global: { stubs }
    })
    expect(w.find('details').exists()).toBe(true)
    expect(w.find('summary').text()).toContain('Show the math')
    expect(w.find('[data-test="body"]').exists()).toBe(true)
  })
})

describe('house-edge', () => {
  it('renders a live floor-wide house-edge table', () => {
    const w = mount(HouseEdge, { global: { stubs } })
    expect(w.text()).toContain('Diamond Doubler')
    expect(w.text()).toMatch(/\d+\.\d+%/) // at least one computed percentage
    expect(w.text().toLowerCase()).toContain('house edge')
  })
})

describe('telnaes-reels', () => {
  it('contrasts physical vs virtual stops with live numbers', () => {
    const w = mount(Telnaes, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('virtual')
    expect(w.text().toLowerCase()).toContain('physical')
    expect(w.text()).toMatch(/1 in [\d,]+/) // a formatOdds() figure
  })
})

describe('hold-and-spin', () => {
  it('explains the respin-reset chain with a live fill number', () => {
    const w = mount(HoldAndSpin, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('respin')
    expect(w.text().toLowerCase()).toContain('markov')
    expect(w.text()).toMatch(/%|1 in/) // a computed probability
  })
})

describe('gargoyles-eye', () => {
  it('explains the additive multiplier with live values', () => {
    const w = mount(GargoylesEye, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('additive')
    expect(w.text()).toMatch(/×\s*\d/) // a multiplier value rendered
  })
})

describe('cascade-tumble', () => {
  it('explains scatter pays + the tumble chain with live computed odds', () => {
    const w = mount(CascadeTumble, { global: { stubs } })
    const t = w.text().toLowerCase()
    expect(t).toContain('tumble')
    expect(t).toContain('scatter')
    expect(t).toContain('ladder')
    expect(w.text()).toMatch(/1 in [\d,]+/) // a live formatOdds() figure
  })

  it('tells the truth about the hard math and the free-play trainer', () => {
    const w = mount(CascadeTumble, { global: { stubs } })
    const t = w.text().toLowerCase()
    expect(t).toContain('markov') // the absorbing-Markov DP is named
    expect(t).toContain('free play') // the trainer rationale is on the page
    expect(t).toContain('par sheet') // points at the full enumeration
  })
})

describe('pachislo', () => {
  it('explains that the lottery decides and the reels obey', () => {
    const w = mount(Pachislo, { global: { stubs } })
    const t = w.text().toLowerCase()
    expect(t).toContain('flag')
    expect(t).toContain('stock')
    expect(t).toMatch(/slip/) // the ≤4-stop slip
  })

  it('renders a LIVE six-level operator RTP table from the engine', () => {
    const w = mount(Pachislo, { global: { stubs } })
    // six levels, each with a computed percentage
    const percents = w.text().match(/\d{2,3}\.\d+%/g) ?? []
    expect(percents.length).toBeGreaterThanOrEqual(6)
    expect(w.text().toLowerCase()).toContain('operator')
  })
})

describe('ldw-near-miss', () => {
  it('defines LDW and near-miss and runs a live seeded experiment', async () => {
    const w = mount(LdwNearMiss, { global: { stubs } })
    await nextTick() // the experiment runs onMounted so first paint never blocks
    const t = w.text().toLowerCase()
    expect(t).toContain('loss disguised as a win')
    expect(t).toContain('near miss')
    // the in-browser experiment reports its spin count and findings
    expect(w.text()).toMatch(/10,000/)
    expect(w.text()).toMatch(/\d+\.\d+%/)
  })

  it('points the reader at the Temple trick-exposer', () => {
    const w = mount(LdwNearMiss, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('temple of gold')
  })
})

describe('glossary', () => {
  it('defines the core floor vocabulary in plain English', () => {
    const w = mount(Glossary, { global: { stubs } })
    const t = w.text().toLowerCase()
    for (const term of [
      'rtp', 'house edge', 'par sheet', 'hit frequency', 'volatility',
      'payline', 'ways', 'scatter', 'virtual reel', 'progressive',
      'loss disguised as a win', 'near miss', 'hold and spin', 'tumble',
      'free spins', 'denomination', 'skill stop', 'coin-in'
    ]) {
      expect(t, `glossary must define "${term}"`).toContain(term)
    }
  })

  it('uses real definition-list semantics', () => {
    const w = mount(Glossary, { global: { stubs } })
    expect(w.find('dl').exists()).toBe(true)
    expect(w.findAll('dt').length).toBeGreaterThanOrEqual(15)
  })
})
