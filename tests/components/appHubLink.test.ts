// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppHubLink from '../../app/components/AppHubLink.vue'

const stubs = { UIcon: true }

describe('AppHubLink', () => {
  it('is a real anchor to the hub', () => {
    const a = mount(AppHubLink, { global: { stubs } }).find('a')
    expect(a.exists()).toBe(true)
    expect(a.attributes('href')).toBe('https://metaincognita.com')
  })

  it('exits in the same tab', () => {
    // A new tab would leave the simulator running behind it — this is an exit,
    // not a side trip.
    const a = mount(AppHubLink, { global: { stubs } }).find('a')
    expect(a.attributes('target')).toBeUndefined()
  })

  it('accessible name contains the visible wordmark (WCAG 2.5.3 Label in Name)', () => {
    const a = mount(AppHubLink, { global: { stubs } }).find('a')
    const visible = a.text().trim()
    expect(visible).toBe('METAINCOGNITA')
    // "Meta Incognita floor" would read fine and still fail 2.5.3, on the space.
    expect(a.attributes('aria-label')).toContain(visible)
  })
})
