// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ParSheetModal from '../../app/components/game/ParSheetModal.vue'
import { useSlotsStore } from '../../app/stores/slots'

function setup(machineId: string) {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100_000)
  store.selectMachine(machineId)
  const wrapper = mount(ParSheetModal, {
    props: { open: true },
    global: {
      stubs: {
        UIcon: true,
        UModal: { template: '<div><slot name="body" /></div>' },
        UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }
      }
    }
  })
  return { store, wrapper }
}

describe('ParSheetModal', () => {
  beforeEach(() => localStorage.clear())

  it('stock-rush: shows the exact level-4 RTP, flag table, and bonus values', async () => {
    const { wrapper } = setup('stock-rush')
    await wrapper.find('[data-test="tab-math"]').trigger('click')
    // the report computes lazily (30 ms paint delay) — wait it out
    await new Promise(resolve => setTimeout(resolve, 80))
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('91.5013%')
    expect(wrapper.text()).toMatch(/big/i)
    await wrapper.find('[data-test="tab-paytable"]').trigger('click')
    expect(wrapper.text()).toContain('16384') // the lottery denominator is shown, not hidden
    await wrapper.find('[data-test="tab-strips"]').trigger('click')
    expect(wrapper.text()).toMatch(/Bell\s*×\s*5/) // reel-1 composition
  })

  it('stepper: strips tab includes Telnaes virtual weights', async () => {
    const { wrapper } = setup('diamond-doubler')
    await wrapper.find('[data-test="tab-strips"]').trigger('click')
    expect(wrapper.text()).toMatch(/of 72/) // virtual entries per reel
  })
})
