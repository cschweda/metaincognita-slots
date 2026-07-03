// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { watchSyncEffect } from 'vue'
import {
  unlockAudio, setMuted, isMuted,
  sfxWhirr, sfxClick, sfxWin, sfxShatter, sfxDrop, sfxJackpot
} from '../app/utils/audio'

/**
 * The synth must be SSR/test-safe: with no AudioContext (server, happy-dom,
 * pre-unlock) every play function is a silent no-op and never throws.
 */
describe('audio synth', () => {
  it('mute toggle round-trips', () => {
    setMuted(true)
    expect(isMuted()).toBe(true)
    setMuted(false)
    expect(isMuted()).toBe(false)
  })

  it('mute is reactive: an effect tracking isMuted() re-runs on setMuted', () => {
    setMuted(false)
    const seen: boolean[] = []
    const stop = watchSyncEffect(() => seen.push(isMuted()))
    setMuted(true)
    setMuted(false)
    stop()
    // A non-reactive flag leaves the cabinet's 🔊/🔇 label and aria-pressed stale.
    expect(seen).toEqual([false, true, false])
  })

  it('mute persists across visits (fresh module reads it back)', async () => {
    setMuted(true)
    vi.resetModules()
    const fresh = await import('../app/utils/audio')
    expect(fresh.isMuted()).toBe(true)
    fresh.setMuted(false)
    setMuted(false)
  })

  it('every sfx is a safe no-op without an unlocked context', () => {
    expect(() => {
      unlockAudio()
      sfxWhirr()
      sfxClick()
      sfxWin(1)
      sfxWin(8)
      sfxShatter()
      sfxDrop()
      sfxJackpot()
    }).not.toThrow()
  })
})
