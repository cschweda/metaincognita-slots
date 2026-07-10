// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { exactRtp } from '../app/engine'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'
import type { MachineDef } from '../app/engine'
import { useExactRtp } from '../app/composables/useExactRtp'
import { floorIntel, intelFromReport } from '../app/utils/floorIntel'

describe('useExactRtp (no-Worker env → sync fill)', () => {
  it('fills synchronously in fallback mode, nulls on a null def, tracks def changes', async () => {
    const def = ref<MachineDef | null>(null)
    let report!: ReturnType<typeof useExactRtp>
    const w = mount(defineComponent({
      setup() {
        report = useExactRtp(() => def.value)
        return () => h('div')
      }
    }))
    expect(report.value).toBeNull()

    def.value = DIAMOND_DOUBLER
    await nextTick()
    expect(report.value).toEqual(exactRtp(DIAMOND_DOUBLER))

    def.value = SEVENS_ABLAZE
    await nextTick()
    expect(report.value).toEqual(exactRtp(SEVENS_ABLAZE))

    def.value = null
    await nextTick()
    expect(report.value).toBeNull()
    w.unmount()
  })
})

describe('intelFromReport', () => {
  it('derives exactly what the sync floorIntel derives', () => {
    const viaSync = floorIntel(DIAMOND_DOUBLER, { coins: 2 })
    const viaReport = intelFromReport(DIAMOND_DOUBLER, exactRtp(DIAMOND_DOUBLER, { coins: 2 }))
    expect(viaReport).toEqual(viaSync)
  })
})
