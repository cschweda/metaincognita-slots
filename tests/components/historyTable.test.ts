// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HistoryTable from '../../app/components/history/HistoryTable.vue'
import HistoryPage from '../../app/pages/history.vue'
import { useSlotsStore } from '../../app/stores/slots'
import type { SpinRecord } from '../../app/stores/slots'

const stubs = {
  UIcon: true,
  UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  HistoryTable
}

const row = (over: Partial<SpinRecord>): SpinRecord => ({
  id: 1, machineId: 'sevens-ablaze', gameKind: 'base', coins: 1,
  coinsInCents: 100, payoutCents: 0, entryIds: [], t: 0, ...over
})

function seedStore(rows: SpinRecord[]) {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.history.push(...rows)
  for (const r of rows) {
    store.stats.spins++
    store.stats.totalInCents += r.coinsInCents
    store.stats.totalOutCents += r.payoutCents
  }
  return store
}

describe('HistoryTable', () => {
  beforeEach(() => localStorage.clear())

  it('shows machine names, humanized awards, and humanized game kinds — no raw ids', () => {
    seedStore([row({ id: 1, payoutCents: 100_000, entryIds: ['3f7'], gameKind: 'base' })])
    const w = mount(HistoryTable, { global: { stubs } })
    expect(w.text()).toContain('Sevens Ablaze')
    expect(w.text()).toContain('3× Flaming Seven')
    expect(w.text()).toContain('Base')
    expect(w.text()).not.toContain('sevens-ablaze')
    expect(w.text()).not.toContain('3f7')
  })

  it('keeps raw ids for machines that no longer resolve', () => {
    seedStore([row({ id: 1, machineId: 'retired-machine', entryIds: ['old-award'] })])
    const w = mount(HistoryTable, { global: { stubs } })
    expect(w.text()).toContain('retired-machine')
    expect(w.text()).toContain('old-award')
  })
})

describe('history page takeaway', () => {
  beforeEach(() => localStorage.clear())

  it('renders expected-vs-actual at the machines\' exact edges once history exists', async () => {
    seedStore([row({ id: 1 }), row({ id: 2, payoutCents: 200 })])
    const w = mount(HistoryPage, { global: { stubs } })
    await flushPromises() // edges resolve through the rtpClient sync fallback
    const t = w.text().toLowerCase()
    expect(t).toContain('expected')
    expect(t).toContain('actual')
    expect(w.find('[data-test="takeaway"]').exists()).toBe(true)
  })

  it('stays silent with an empty history', () => {
    seedStore([])
    const w = mount(HistoryPage, { global: { stubs } })
    expect(w.find('[data-test="takeaway"]').exists()).toBe(false)
  })
})
