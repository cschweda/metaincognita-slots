// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LabExpectedMath from '../../app/components/lab/LabExpectedMath.vue'
import { SEVENS_ABLAZE } from '../../app/machines/sevens-ablaze'
import { exactRtp } from '../../app/engine'
import { labExpectedMath } from '../../app/utils/labMath'
import type { SimLabResult } from '../../app/engine/sessions'

const stubs = { NuxtLink: { template: '<a><slot /></a>' }, UIcon: true }
const model = labExpectedMath(SEVENS_ABLAZE, exactRtp(SEVENS_ABLAZE), { startCredits: 100, bet: 2, spinCap: 500 })

describe('LabExpectedMath', () => {
  it('renders the model figures, labeled as model', () => {
    const w = mount(LabExpectedMath, { props: { def: SEVENS_ABLAZE, model, result: null }, global: { stubs } })
    const t = w.text().toLowerCase()
    expect(t).toContain('model')
    expect(t).toContain('per spin')
    expect(t).toContain('luck')
    expect(w.text()).toMatch(/\$\d/) // dollar figures rendered
    expect(w.text()).toMatch(/\d[\d,]* spins/) // N₀ / bust-horizon rendered
  })

  it('reconciles model vs measured once a run exists', () => {
    const result = { meanEnd: 80, machineId: 'sevens-ablaze' } as SimLabResult
    const w = mount(LabExpectedMath, { props: { def: SEVENS_ABLAZE, model, result }, global: { stubs } })
    const t = w.text().toLowerCase()
    expect(t).toContain('measured')
    expect(t).toContain('bust') // explains why measured mean > no-bust model
  })

  it('shows a computing state while the exact report is cold', () => {
    const w = mount(LabExpectedMath, { props: { def: SEVENS_ABLAZE, model: null, result: null }, global: { stubs } })
    expect(w.text().toLowerCase()).toContain('computing')
  })
})
