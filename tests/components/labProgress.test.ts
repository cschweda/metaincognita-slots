// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LabProgress from '../../app/components/lab/LabProgress.vue'

const stubs = { UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' } }

describe('LabProgress', () => {
  it('renders a labelled progressbar reflecting progress', () => {
    const w = mount(LabProgress, { props: { progress: 0.42, completed: 4200, total: 10000 }, global: { stubs } })
    const bar = w.find('[role="progressbar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.attributes('aria-valuenow')).toBe('42')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
    expect(w.text()).toContain('4,200')
  })
  it('emits cancel when the cancel button is clicked', async () => {
    const w = mount(LabProgress, { props: { progress: 0.1, completed: 1000, total: 10000 }, global: { stubs } })
    await w.find('[data-test="cancel"]').trigger('click')
    expect(w.emitted('cancel')).toBeTruthy()
  })
})
