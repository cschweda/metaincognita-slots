// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DefaultLayout from '../../app/layouts/default.vue'

const stubs = {
  UIcon: true,
  AppSoundToggle: true,
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  AppHubLink: { template: '<a data-test="hub-link" href="https://metaincognita.com">METAINCOGNITA</a>' }
}

// `useRoute` is a Nuxt auto-import, so it is a free identifier here; a global
// read resolves it even under ESM strict mode.
function mountAt(path: string) {
  vi.stubGlobal('useRoute', () => ({ path }))
  return mount(DefaultLayout, { global: { stubs } })
}

describe('default layout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // The whole point of the feature: there is no route you can get stranded on.
  it.each([
    ['the floor', '/'],
    ['a cabinet', '/game'],
    ['the sim lab', '/sim-lab'],
    ['a learn page', '/learn/glossary'],
    ['history', '/history']
  ])('shows the hub exit on %s', (_where, path) => {
    expect(mountAt(path).find('[data-test="hub-link"]').exists()).toBe(true)
  })

  it('leaves "Floor" meaning this app\'s machine index — hidden on the floor, shown in a cabinet', () => {
    // Guards the collision the design turns on: the hub exit must not have
    // become a second "Floor", and must not have displaced the first one.
    expect(mountAt('/').text()).not.toMatch(/Floor/)
    expect(mountAt('/game').text()).toMatch(/Floor/)
  })
})
