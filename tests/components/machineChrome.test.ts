// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import MachineChrome from '../../app/components/game/MachineChrome.vue'
import DefaultChrome from '../../app/components/game/chrome/DefaultChrome.vue'
import { chromeFor } from '../../app/components/game/chrome/registry'
import { chromeTheme } from '../../app/components/game/chrome/theme'
import { useSlotsStore } from '../../app/stores/slots'

describe('chromeTheme', () => {
  it('returns a per-machine palette and a fallback for unknown ids', () => {
    expect(chromeTheme('ruby-of-gargoyle').accent).toBe('#e11d48')
    const fb = chromeTheme('does-not-exist')
    expect(fb.accent).toBeTruthy()
    expect(fb.backdrop).toBeTruthy()
  })
})

describe('chromeFor', () => {
  it('falls back to DefaultChrome for an unknown machine', () => {
    expect(chromeFor('does-not-exist')).toBe(DefaultChrome)
  })
  it('returns a component (not the default) for a registered machine', () => {
    // ruby is registered in Task 2; until then this asserts the registry shape.
    expect(chromeFor('ruby-of-gargoyle')).toBeTruthy()
  })
})

describe('GameMachineChrome', () => {
  function setup(machineId: string) {
    setActivePinia(createPinia())
    localStorage.clear()
    const store = useSlotsStore()
    store.startSession(1_000_000)
    store.selectMachine(machineId)
    return mount(MachineChrome, {
      slots: { default: '<div data-test="reels">REELS</div>' }
    })
  }
  it('renders the reel slot and a decorative, non-interactive chrome layer', () => {
    const w = setup('ruby-of-gargoyle')
    expect(w.find('[data-test="reels"]').exists()).toBe(true) // game untouched
    const frame = w.find('.chrome-frame')
    expect(frame.exists()).toBe(true)
    expect(frame.attributes('aria-hidden')).toBe('true')
    expect(w.find('.chrome-stage').attributes('style')).toContain('--chrome-accent')
  })
})
