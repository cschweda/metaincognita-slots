// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import XrayPanel from '../../app/components/game/XrayPanel.vue'
import { useSlotsStore } from '../../app/stores/slots'
import { bonusEv, lockReelExactRtp, reelCashEvs } from '../../app/engine/lockReelRtp'
import { STOP_AND_LOCK_777 } from '../../app/machines/stop-and-lock-777'
import { formatPercent } from '../../app/utils/format'

function withLockReel() {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.startSession(100000)
  store.selectMachine('stop-and-lock-777')
  store.setXray(true)
  const wrapper = mount(XrayPanel, {
    global: {
      stubs: { UIcon: true }
    }
  })
  return { wrapper, store }
}

describe('XrayPanel — Stop & Lock 777 (lock-reel)', () => {
  beforeEach(() => localStorage.clear())

  it('renders the strip-driven cash/bonus block with the honest-stop note', () => {
    const { wrapper } = withLockReel()
    const panel = wrapper.find('[data-test="lock-odds-panel"]')
    expect(panel.exists()).toBe(true)
    const text = panel.text()
    // exact RTP + house edge line — derived the way the panel computes them;
    // the engine-side FROZEN value lives in machines-lockreel.test.ts.
    const report = lockReelExactRtp(STOP_AND_LOCK_777)
    expect(text).toContain(formatPercent(report.rtpPerCoin, 4)) // RTP
    expect(text).toMatch(/House edge/i)
    expect(text).toContain(formatPercent(1 - report.rtpPerCoin, 4)) // 1 - RTP
    // per-reel cash EV: reel 3's expected cash (highest, 0.168) appears
    const evs = reelCashEvs(STOP_AND_LOCK_777)
    expect(text).toContain(evs[2]!.toFixed(3))
    // 777 bonus odds (1 in 96) + bonus EV given trigger
    expect(text).toContain('1 in 96')
    expect(text).toContain(bonusEv(STOP_AND_LOCK_777).toFixed(2))
    // the GRAND fill rate as a 1-in-N figure
    expect(text).toMatch(/GRAND/)
    // the honest-stop note (same stance pachislo/Flameout 21 teach)
    expect(text).toMatch(/uniform draw/i)
    expect(text).toMatch(/doesn't change the odds/i)
  })

  it('does not render the lock block when X-ray is off', () => {
    const { wrapper, store } = withLockReel()
    store.setXray(false)
    return wrapper.vm.$nextTick().then(() => {
      expect(wrapper.find('[data-test="lock-odds-panel"]').exists()).toBe(false)
    })
  })
})
