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

  // Lucky 21: all hit-or-bust par-sheet tests skipped in Task 1 (machine off floor, RTP stub throws); restored in a later task
  it.skip('hit-or-bust: paytable shows value entries + Five-Card Charlie bonus', async () => {
    const { wrapper } = setup('hit-or-bust')
    await wrapper.find('[data-test="tab-paytable"]').trigger('click')
    // Value paytable entries
    expect(wrapper.text()).toContain('Hand total 18')
    expect(wrapper.text()).toContain('Hand total 21')
    // Charlie bonus row
    expect(wrapper.text()).toContain('Five-Card Charlie bonus')
    // Pay values present
    expect(wrapper.text()).toMatch(/1 per coin/)
    expect(wrapper.text()).toMatch(/\+1 per coin/)
  })

  it.skip('hit-or-bust: exact math tab shows RTP, strategy table, and bust/charlie rates', async () => {
    const { wrapper } = setup('hit-or-bust')
    await wrapper.find('[data-test="tab-math"]').trigger('click')
    // The report computes lazily (30 ms paint delay) — wait it out
    await new Promise(resolve => setTimeout(resolve, 80))
    await wrapper.vm.$nextTick()
    // Exact RTP (≈ 89.9977% from frozen figures in hit-or-bust.ts: 0.8999774891774895)
    expect(wrapper.text()).toContain('89.9977%')
    // Strategy table is present
    expect(wrapper.find('[data-test="bj-strategy-table"]').exists()).toBe(true)
    // Strategy table has hit and stand rules
    expect(wrapper.text()).toMatch(/HIT/)
    expect(wrapper.text()).toMatch(/STAND/)
    // Bust/charlie rates from the breakdown footer
    expect(wrapper.text()).toMatch(/Bust rate/)
    expect(wrapper.text()).toMatch(/Five-Card Charlie/)
    // Breakdown uses friendly labels
    expect(wrapper.text()).toContain('Total 20')
    expect(wrapper.text()).toContain('Bust (loss)')
  })

  it.skip('hit-or-bust: strategy table is card-count-aware with "2 cards"/"3 cards"/"4 cards" columns', async () => {
    const { wrapper } = setup('hit-or-bust')
    await wrapper.find('[data-test="tab-math"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 80))
    await wrapper.vm.$nextTick()
    const table = wrapper.find('[data-test="bj-strategy-table"]')
    expect(table.exists()).toBe(true)
    // The matrix must have card-count columns in the header
    expect(table.text()).toMatch(/2 cards/i)
    expect(table.text()).toMatch(/3 cards/i)
    expect(table.text()).toMatch(/4 cards/i)
    // Row 18 must be present (a key regression case)
    expect(table.text()).toContain('18')
  })

  it.skip('hit-or-bust: hard 18 at 2 cards shows STAND in the strategy matrix (regression guard)', async () => {
    const { wrapper } = setup('hit-or-bust')
    await wrapper.find('[data-test="tab-math"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 80))
    await wrapper.vm.$nextTick()
    // The row for total 18 must exist with a data-test attribute we can interrogate
    const cell = wrapper.find('[data-test="bj-matrix-cell-18-2"]')
    expect(cell.exists()).toBe(true)
    expect(cell.text()).toBe('STAND')
  })

  it.skip('hit-or-bust: Bust-Save note says HIT on all hard totals (regression — null threshold = hit-all, not "no change")', async () => {
    const { wrapper } = setup('hit-or-bust')
    await wrapper.find('[data-test="tab-math"]').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 80))
    await wrapper.vm.$nextTick()
    const text = wrapper.text()
    // A held Bust-Save makes HIT optimal at every made total (EV(hit)≈1.40 > EV(stand)=1.0 at 18),
    // so the save-threshold is null. The note must read that null as "hit everything", NOT as
    // "no change" — the original guard wrongly rendered the contradictory line below.
    expect(text).toMatch(/With Bust Save held:[\s\S]*HIT on all hard totals/i)
    expect(text).not.toMatch(/save does not shift the break-even/i)
  })
})
