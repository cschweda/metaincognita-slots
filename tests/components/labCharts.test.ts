// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChartFrame from '../../app/components/lab/ChartFrame.vue'
import LabStatCards from '../../app/components/lab/LabStatCards.vue'
import SurvivalCurve from '../../app/components/lab/SurvivalCurve.vue'
import type { SimLabResult } from '../../app/engine/sessions'

const result: SimLabResult = {
  machineId: 'diamond-doubler', sessions: 1000, startCredits: 200, bet: 1, spinCap: 500,
  riskOfRuin: 0.62, medianEnd: 0, meanEnd: 140, pctAhead: 0.21, avgSpins: 230, avgMaxDrawdown: 160,
  empiricalRtp: 0.901, houseEdge: 0.099,
  survival: [{ spins: 0, fraction: 1 }, { spins: 250, fraction: 0.6 }, { spins: 500, fraction: 0.38 }],
  endHistogram: { binEdges: [0, 100, 200, 300], counts: [620, 200, 180], bustCount: 620 },
  drawdownHistogram: { binEdges: [0, 100, 200], counts: [300, 700] },
  sampleTrajectories: [{ busted: true, points: [200, 100, 0] }, { busted: false, points: [200, 260] }]
}

describe('ChartFrame', () => {
  it('renders a titled, labelled svg', () => {
    const w = mount(ChartFrame, {
      props: { title: 'Survival', summary: 'curve decays to 38%' },
      slots: { default: '<rect data-test="child" />' }
    })
    const svg = w.find('svg')
    expect(svg.attributes('aria-label')).toContain('Survival')
    expect(w.text()).toContain('curve decays to 38%') // sr-only summary present in DOM
    expect(w.find('[data-test="child"]').exists()).toBe(true)
  })
})

describe('LabStatCards', () => {
  it('shows the headline numbers', () => {
    const w = mount(LabStatCards, { props: { result } })
    expect(w.text()).toMatch(/62(\.0+)?%/) // risk of ruin
    expect(w.text()).toMatch(/21(\.0+)?%/) // % ahead
    expect(w.text().toLowerCase()).toContain('risk of ruin')
  })
})

describe('SurvivalCurve', () => {
  it('plots a polyline and labels the final survival rate', () => {
    const w = mount(SurvivalCurve, { props: { result } })
    expect(w.find('polyline').exists()).toBe(true)
    const pts = w.find('polyline').attributes('points')!.trim().split(/\s+/)
    expect(pts.length).toBe(result.survival.length) // one point per survival sample
    expect(w.find('svg').attributes('aria-label')).toMatch(/survival/i)
  })
})
