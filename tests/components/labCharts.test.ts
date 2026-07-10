// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChartFrame from '../../app/components/lab/ChartFrame.vue'
import LabStatCards from '../../app/components/lab/LabStatCards.vue'
import SurvivalCurve from '../../app/components/lab/SurvivalCurve.vue'
import EndHistogram from '../../app/components/lab/EndHistogram.vue'
import DrawdownHistogram from '../../app/components/lab/DrawdownHistogram.vue'
import SampleCurves from '../../app/components/lab/SampleCurves.vue'
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

describe('EndHistogram', () => {
  it('draws one rect per bin and notes the bust count', () => {
    const w = mount(EndHistogram, { props: { result } })
    expect(w.findAll('rect').length).toBe(result.endHistogram.counts.length)
    expect(w.find('svg').attributes('aria-label')).toMatch(/620/) // bustCount surfaced in summary
  })

  it('overlays the model expected end and the measured mean when provided', () => {
    const w = mount(EndHistogram, { props: { result, expectedEndCredits: 60 } })
    const model = w.find('[data-test="model-end"]')
    const mean = w.find('[data-test="mean-end"]')
    expect(model.exists()).toBe(true)
    expect(mean.exists()).toBe(true)
    // linear map over [0, 300] credits between X0=34 and X1=312
    expect(Number(model.attributes('x1'))).toBeCloseTo(34 + (60 / 300) * (312 - 34), 3)
    expect(Number(mean.attributes('x1'))).toBeCloseTo(34 + (140 / 300) * (312 - 34), 3)
    expect(w.find('svg').attributes('aria-label')).toMatch(/model|expected/i)
  })

  it('draws no markers when the model end is absent', () => {
    const w = mount(EndHistogram, { props: { result } })
    expect(w.find('[data-test="model-end"]').exists()).toBe(false)
    expect(w.find('[data-test="mean-end"]').exists()).toBe(false)
  })
})

describe('DrawdownHistogram', () => {
  it('draws one rect per bin', () => {
    const w = mount(DrawdownHistogram, { props: { result } })
    expect(w.findAll('rect').length).toBe(result.drawdownHistogram.counts.length)
  })
})

describe('SampleCurves', () => {
  it('draws one polyline per sample trajectory, colored by fate', () => {
    const w = mount(SampleCurves, { props: { result } })
    const lines = w.findAll('polyline')
    expect(lines.length).toBe(result.sampleTrajectories.length)
    // busted curves rose, survived curves emerald
    expect(lines.some(l => l.attributes('stroke') === '#fb7185')).toBe(true)
    expect(lines.some(l => l.attributes('stroke') === '#34d399')).toBe(true)
  })
})
