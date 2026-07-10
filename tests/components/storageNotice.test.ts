// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import IndexPage from '../../app/pages/index.vue'
import { useSlotsStore } from '../../app/stores/slots'

const stubs = {
  FloorFeaturedMachine: true,
  FloorBankrollSetup: true,
  FloorMachineCard: true,
  UIcon: true,
  UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }
}

describe('storage-reset notice banner', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('is absent by default, shown when flagged, and dismissible', async () => {
    const store = useSlotsStore()
    const w = mount(IndexPage, { global: { stubs } })
    expect(w.find('[data-test="storage-notice"]').exists()).toBe(false)

    store.storageNotice = true
    await w.vm.$nextTick()
    const banner = w.find('[data-test="storage-notice"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text().toLowerCase()).toContain('older version')

    await banner.find('button').trigger('click')
    expect(store.storageNotice).toBe(false)
    expect(w.find('[data-test="storage-notice"]').exists()).toBe(false)
  })
})
