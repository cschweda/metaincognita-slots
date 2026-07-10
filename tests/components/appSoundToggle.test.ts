// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppSoundToggle from '../../app/components/AppSoundToggle.vue'
import { setMuted } from '../../app/utils/audio'

const stubs = { UIcon: true }

describe('AppSoundToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    setMuted(false) // module-level ref persists across files — reset explicitly
  })

  it('mirrors state on aria-pressed and persists the choice', async () => {
    const w = mount(AppSoundToggle, { global: { stubs } })
    const btn = w.find('button')
    expect(btn.attributes('aria-pressed')).toBe('true') // sound ON by default
    expect(btn.text()).toMatch(/sound on/i)

    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('false')
    expect(btn.text()).toMatch(/sound off/i)
    expect(localStorage.getItem('slots-sound-muted')).toBe('1')

    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('slots-sound-muted')).toBe('0')
  })
})
