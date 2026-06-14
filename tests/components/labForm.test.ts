// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LabForm from '../../app/components/lab/LabForm.vue'

const stubs = { UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }, UIcon: true }

describe('LabForm', () => {
  it('emits a run payload with dollars converted to credits', async () => {
    // canal-royale denomination is 1 cent → $20 = 2000 credits; default bet = maxCoins
    const w = mount(LabForm, { props: { running: false }, global: { stubs } })
    await w.find('[data-test="machine"]').setValue('canal-royale')
    await w.find('[data-test="bankroll"]').setValue('20')
    await w.find('[data-test="run"]').trigger('click')
    const ev = w.emitted('run')
    expect(ev).toBeTruthy()
    const payload = ev![0]![0] as Record<string, number | string>
    expect(payload.machineId).toBe('canal-royale')
    expect(payload.startCredits).toBe(2000)
    expect(payload.sessions).toBeGreaterThan(0)
  })

  it('warns above 50k sessions but still allows running', async () => {
    const w = mount(LabForm, { props: { running: false }, global: { stubs } })
    await w.find('[data-test="sessions"]').setValue('80000')
    expect(w.text().toLowerCase()).toMatch(/slow|while|large/)
    expect(w.find('[data-test="run"]').attributes('disabled')).toBeUndefined()
  })
})
