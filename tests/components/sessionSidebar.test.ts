// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import SessionSidebar from '../../app/components/game/SessionSidebar.vue'
import { useSlotsStore } from '../../app/stores/slots'

const stubs = {
  UIcon: true,
  UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' }
}

function setup(machineId: string) {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100_000)
  store.selectMachine(machineId)
  return { store, wrapper: mount(SessionSidebar, { global: { stubs } }) }
}

describe('SessionSidebar', () => {
  beforeEach(() => localStorage.clear())

  it('machine tab links to the machine\'s learn page', async () => {
    const { wrapper } = setup('diamond-doubler')
    const tab = wrapper.findAll('button').find(b => b.text().includes('Machine intel'))!
    await tab.trigger('click')
    const link = wrapper.find('[data-test="learn-link"]')
    expect(link.exists()).toBe(true)
    expect(link.attributes('href')).toBe('/learn/telnaes-reels')
  })

  it('stat labels deep-link into the glossary', async () => {
    const { wrapper } = setup('diamond-doubler')
    const tab = wrapper.findAll('button').find(b => b.text().includes('Machine intel'))!
    await tab.trigger('click')
    const hrefs = wrapper.findAll('a').map(a => a.attributes('href'))
    expect(hrefs).toContain('/learn/glossary#rtp')
    expect(hrefs).toContain('/learn/glossary#hit-frequency')
    expect(hrefs).toContain('/learn/glossary#volatility')
  })
})
