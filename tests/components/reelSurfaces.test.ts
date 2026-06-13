// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ReelStepper from '../../app/components/game/ReelStepper.vue'
import ReelBally from '../../app/components/game/ReelBally.vue'
import { useSlotsStore } from '../../app/stores/slots'

const IconStub = { props: ['icon', 'label', 'wild', 'size'], template: '<i data-test="cell" :data-icon="icon" />' }

function withMachine(Comp: unknown, id: string) {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100000)
  store.selectMachine(id)
  return mount(Comp as never, { global: { stubs: { UIcon: true, GameProgressiveMeter: true, GameSymbolIcon: IconStub } } })
}

describe('Reel surfaces', () => {
  beforeEach(() => localStorage.clear())
  it('stepper renders icon cells', () => {
    expect(withMachine(ReelStepper, 'diamond-doubler').findAll('[data-test="cell"]').length).toBeGreaterThanOrEqual(9)
  })
  it('bally renders icon cells', () => {
    expect(withMachine(ReelBally, 'series-e-3line').findAll('[data-test="cell"]').length).toBeGreaterThanOrEqual(9)
  })
})
