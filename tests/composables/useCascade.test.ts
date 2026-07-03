// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { effectScope } from 'vue'
import { useSlotsStore } from '../../app/stores/slots'
import { useCascade } from '../../app/composables/useCascade'
import { sfxWin, sfxShatter, sfxDrop, sfxJackpot } from '../../app/utils/audio'

vi.mock('~/utils/audio', () => ({
  unlockAudio: vi.fn(),
  sfxWhirr: vi.fn(),
  sfxWin: vi.fn(),
  sfxShatter: vi.fn(),
  sfxDrop: vi.fn(),
  sfxJackpot: vi.fn(),
  sfxCascade: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn()
}))

// Navigating away mid-spin disposes the component scope. The awaited timer
// chain must stop there: no more SFX (sound was bleeding onto the floor page),
// no more ledger/state mutation from a cabinet that no longer exists.
describe('useCascade — dispose cancels the awaited spin chain', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('stops mutating state and firing SFX after the scope is disposed', async () => {
    const store = useSlotsStore()
    store.startSession(100000)
    store.selectMachine('temple-of-gold')

    const scope = effectScope()
    const c = scope.run(() => useCascade())!
    c.ensure()
    const p = c.spin()
    await vi.advanceTimersByTimeAsync(150) // inside the 3×110ms spin shuffle
    scope.stop() // unmount mid-spin

    await vi.advanceTimersByTimeAsync(30_000) // drain every pending timer
    await p

    expect(c.spins.value).toBe(0) // the ledger never advanced after unmount
    expect(c.phase.value).not.toBe('idle') // the spin never "completed" offstage
    expect(sfxWin).not.toHaveBeenCalled()
    expect(sfxShatter).not.toHaveBeenCalled()
    expect(sfxDrop).not.toHaveBeenCalled()
    expect(sfxJackpot).not.toHaveBeenCalled()
  })
})
