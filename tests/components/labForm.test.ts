// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LabForm from '../../app/components/lab/LabForm.vue'
import { FLOOR } from '../../app/machines'

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

  it('clamps bet to the new machine maxCoins when the machine changes', async () => {
    const w = mount(LabForm, { props: { running: false }, global: { stubs } })
    await w.find('[data-test="bet"]').setValue('999')
    await w.find('[data-test="machine"]').setValue('diamond-doubler')
    await w.find('[data-test="run"]').trigger('click')
    const payload = w.emitted('run')![0]![0] as Record<string, number>
    const maxCoins = FLOOR.find(m => m.id === 'diamond-doubler')!.maxCoins
    expect(payload.bet).toBeLessThanOrEqual(maxCoins)
    expect(payload.bet).toBeGreaterThanOrEqual(1)
  })

  it('emits live change payloads: immediately on mount and on every edit', async () => {
    const w = mount(LabForm, { props: { running: false }, global: { stubs } })
    const initial = w.emitted('change')
    expect(initial).toBeTruthy() // immediate watch: the math panel is never blank
    await w.find('[data-test="machine"]').setValue('canal-royale')
    await w.find('[data-test="bankroll"]').setValue('20')
    const evs = w.emitted('change')!
    const last = evs[evs.length - 1]![0] as Record<string, number | string>
    expect(last.startCredits).toBe(2000) // $20 at canal-royale's 1¢ denom
  })
})
