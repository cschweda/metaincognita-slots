// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CabinetToolbar from '../../app/components/game/CabinetToolbar.vue'
import { useSlotsStore } from '../../app/stores/slots'

const stubs = {
  // NOTE: v-bind="$attrs" already forwards the parent's onClick to the native
  // button — do NOT also $emit('click'), or non-idempotent handlers (the X-ray
  // toggle) fire twice per click.
  UButton: { template: '<button v-bind="$attrs"><slot /></button>' },
  GameParSheetModal: { props: ['open'], template: '<div data-test="par-modal" :data-open="String(open)" />' }
}

describe('CabinetToolbar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('toggles the store X-ray flag and mirrors it on aria-pressed', async () => {
    const store = useSlotsStore()
    const w = mount(CabinetToolbar, { global: { stubs } })
    const xray = w.findAll('button').find(b => b.text().includes('X-ray'))!
    expect(xray.attributes('aria-pressed')).toBe('false')
    await xray.trigger('click')
    expect(store.settings.xray).toBe(true)
    expect(xray.attributes('aria-pressed')).toBe('true')
  })

  it('opens the PAR sheet modal', async () => {
    const w = mount(CabinetToolbar, { global: { stubs } })
    expect(w.find('[data-test="par-modal"]').attributes('data-open')).toBe('false')
    const par = w.findAll('button').find(b => b.text().includes('PAR sheet'))!
    await par.trigger('click')
    expect(w.find('[data-test="par-modal"]').attributes('data-open')).toBe('true')
  })
})
