import { describe, it, expect } from 'vitest'
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
