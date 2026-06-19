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

  it('lock-reel: paytable shows cash values, prizes, the 777 bonus row + explainer', async () => {
    const { wrapper } = setup('stop-and-lock-777')
    await wrapper.find('[data-test="tab-paytable"]').trigger('click')
    const text = wrapper.text()
    // cash-collect values (labels $1/$2/$5) and the cash-collect note
    expect(text).toMatch(/cash collect/i)
    expect(text).toMatch(/\$5/)
    // fixed prizes + the GRAND with its grid-fill label and value
    expect(text).toMatch(/MINI/)
    expect(text).toMatch(/MAJOR/)
    expect(text).toMatch(/GRAND/)
    expect(text).toContain('460') // GRAND credit value
    // the 777 BONUS rows: trigger odds (1 in 96) + bonus EV
    expect(text).toMatch(/777 BONUS/i)
    expect(text).toContain('1 in 96')
    // explainer: collection / no paylines / skill-stop / hold-and-spin
    const explainer = wrapper.find('[data-test="lock-explainer"]')
    expect(explainer.exists()).toBe(true)
    expect(explainer.text()).toMatch(/skill-stop/i)
    expect(explainer.text()).toMatch(/hold-and-spin/i)
    expect(explainer.text()).toMatch(/See the strips, know the edge/i)
  })

  it('lock-reel: strips tab surfaces the denser 777 bonus strips', async () => {
    const { wrapper } = setup('stop-and-lock-777')
    await wrapper.find('[data-test="tab-strips"]').trigger('click')
    const bonus = wrapper.find('[data-test="bonus-strips"]')
    expect(bonus.exists()).toBe(true)
    // the bonus strips note its denser cells (40-cell strips) feeding the hold-and-spin
    expect(bonus.text()).toMatch(/40 cells/i)
    expect(bonus.text()).toMatch(/hold-and-spin/i)
  })

  it('lock-reel: math tab shows the exact 94.5073% RTP and friendly breakdown labels', async () => {
    const { wrapper } = setup('stop-and-lock-777')
    await wrapper.find('[data-test="tab-math"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 80))
    await wrapper.vm.$nextTick()
    const text = wrapper.text()
    expect(text).toContain('94.5073%')
    expect(text).toMatch(/Base collect/i)
    expect(text).toMatch(/GRAND \(grid fill\)/i)
  })
})
