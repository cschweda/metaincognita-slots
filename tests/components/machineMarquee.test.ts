// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MachineMarquee from '../../app/components/game/MachineMarquee.vue'
import { useSlotsStore } from '../../app/stores/slots'

// GameSymbolIcon is a Nuxt auto-import; in isolated mounts we stub it with a
// prop-capturing stub so we can assert the right hero icon is wired.
const heroStub = { props: ['icon', 'label', 'size'], template: '<i data-test="hero" :data-icon="icon" />' }

function setup(id: string) {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100000)
  store.selectMachine(id)
  return mount(MachineMarquee, { global: { stubs: { UIcon: true, GameSymbolIcon: heroStub } } })
}

describe('MachineMarquee', () => {
  beforeEach(() => localStorage.clear())

  it('shows the machine name, tagline, and the themed hero icon', () => {
    const w = setup('canal-royale')
    expect(w.text()).toContain('CANAL ROYALE')
    expect(w.text()).toMatch(/Venetian/i)
    expect(w.find('[data-test="hero"]').attributes('data-icon')).toBe('mask')
  })

  it('renders another machine (different name + hero)', () => {
    const w = setup('stock-rush')
    expect(w.text()).toContain('STOCK RUSH')
    expect(w.find('[data-test="hero"]').attributes('data-icon')).toBe('seven-red')
  })
})
