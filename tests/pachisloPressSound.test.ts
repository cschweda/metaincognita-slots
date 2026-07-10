// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePachisloPress } from '../app/composables/usePachisloPress'
import { useSlotsStore } from '../app/stores/slots'
import { unlockAudio } from '../app/utils/audio'

const bank = {
  spinStart: vi.fn(),
  reelStop: vi.fn(),
  reveal: vi.fn()
}
// (vi.mock is hoisted above the imports by vitest's transform.)
vi.mock('../app/utils/soundBank', () => ({
  voiceFor: vi.fn(() => bank)
}))
vi.mock('../app/utils/audio', () => ({
  unlockAudio: vi.fn()
}))

describe('usePachisloPress sound wiring', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('arm unlocks audio + plays spin-up; each press beeps; resolve reveals once', () => {
    const store = useSlotsStore()
    store.startSession(100_000)
    store.selectMachine('stock-rush')
    const p = usePachisloPress()
    p.cancelPress() // reset the module-level reel state from other tests

    p.arm()
    expect(unlockAudio).toHaveBeenCalled()
    expect(bank.spinStart).toHaveBeenCalledTimes(1)
    expect(bank.reveal).not.toHaveBeenCalled()

    p.press(0)
    p.press(1)
    expect(bank.reelStop).toHaveBeenCalledTimes(2)
    expect(bank.reelStop).toHaveBeenNthCalledWith(1, 0, 3)

    p.press(2) // third press resolves the game
    expect(bank.reelStop).toHaveBeenCalledTimes(3)
    expect(bank.reveal).toHaveBeenCalledTimes(1)
    expect(store.lastOutcome).not.toBeNull()
    p.cancelPress()
  })

  it('a dead press (not armed) makes no sound', () => {
    const store = useSlotsStore()
    store.startSession(100_000)
    store.selectMachine('stock-rush')
    const p = usePachisloPress()
    p.cancelPress()
    p.press(0)
    expect(bank.reelStop).not.toHaveBeenCalled()
  })
})
