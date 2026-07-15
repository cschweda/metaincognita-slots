// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import XrayContent from '../../app/components/game/XrayContent.vue'
import { useSlotsStore } from '../../app/stores/slots'

const stubs = { UIcon: true, LazyGameXrayParkedPanel: true }

describe('XrayContent', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('renders the X-ray body with no settings.xray gate (usable in the peek drawer)', () => {
    const store = useSlotsStore()
    store.selectMachine('canal-royale')
    store.settings.xray = false // gate is OFF, content must still render
    const w = mount(XrayContent, { global: { stubs } })
    expect(w.find('[data-test="xray-content"]').exists()).toBe(true)
    expect(w.text()).toMatch(/X-ray/i)
  })
})
