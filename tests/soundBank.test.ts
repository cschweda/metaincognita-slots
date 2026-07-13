import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MachineDef, SpinOutcome } from '../app/engine'
import * as audio from '../app/utils/audio'
import { voiceFor, winTier } from '../app/utils/soundBank'

// Spy on the primitives so routing is observable without an AudioContext.
// (vi.mock is hoisted above the imports by vitest's transform.)
// playSampleNow defaults to FALSE here — "the recorded sting isn't available" —
// which is exactly the degraded path, so every synth-routing assertion below is
// really asserting that a missing sample never costs us the sound.
vi.mock('../app/utils/audio', () => ({
  tone: vi.fn(),
  noiseBurst: vi.fn(),
  bell: vi.fn(),
  reducedMotion: vi.fn(() => false),
  playSampleNow: vi.fn(() => false)
}))

function out(partial: Partial<SpinOutcome>): SpinOutcome {
  return {
    coinsIn: 25, totalPayout: 0, featureEvents: [], progressiveEvents: [], wins: [],
    ...partial
  } as unknown as SpinOutcome
}
const DEF = { family: 'stepper' } as unknown as MachineDef

function anySoundPlayed(): boolean {
  return (audio.tone as ReturnType<typeof vi.fn>).mock.calls.length > 0
    || (audio.noiseBurst as ReturnType<typeof vi.fn>).mock.calls.length > 0
    || (audio.bell as ReturnType<typeof vi.fn>).mock.calls.length > 0
}

describe('winTier', () => {
  it('scales by payout/bet ratio — the LDW small tier still exists', () => {
    expect(winTier(out({ totalPayout: 0 }))).toBe('none')
    expect(winTier(out({ totalPayout: 14 }))).toBe('small') // bet 25, paid 14: the LDW
    expect(winTier(out({ totalPayout: 50 }))).toBe('medium')
    expect(winTier(out({ totalPayout: 250 }))).toBe('big')
    expect(winTier(out({ totalPayout: 2000 }))).toBe('huge')
  })
})

describe('voiceFor', () => {
  it('gives the four betting families distinct voices and everyone else silence', () => {
    const sounding = (['stepper', 'bally-em', 'video', 'pachislo'] as const).map(f => voiceFor(f))
    expect(new Set(sounding).size).toBe(4)
    const silent = voiceFor('cascade')
    expect(voiceFor('blackjack-reel')).toBe(silent)
    expect(voiceFor('lock-reel')).toBe(silent)
  })

  it('every method of every voice is callable without throwing', () => {
    for (const f of ['stepper', 'bally-em', 'video', 'pachislo', 'cascade', 'blackjack-reel', 'lock-reel'] as const) {
      const v = voiceFor(f)
      expect(() => v.spinStart()).not.toThrow()
      expect(() => v.reelStop(0, 3)).not.toThrow()
      expect(() => v.reelStop(4, 5)).not.toThrow()
      expect(() => v.reveal(DEF, out({ totalPayout: 100 }))).not.toThrow()
    }
  })
})

describe('reveal routing (spec: one big moment, payout-scaled)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('a clean loss is SILENT, like a real machine', () => {
    voiceFor('stepper').reveal(DEF, out({ totalPayout: 0 }))
    expect(anySoundPlayed()).toBe(false)
  })

  it('an LDW (paid 14 on a 25 bet) still throws the party — that is the lesson', () => {
    voiceFor('video').reveal(DEF, out({ totalPayout: 14 }))
    expect(anySoundPlayed()).toBe(true)
  })

  it('a progressive hit plays the jackpot fanfare even at tiny listed payout', () => {
    voiceFor('bally-em').reveal(DEF, out({
      totalPayout: 1,
      progressiveEvents: [{ amountCredits: 5000 }] as unknown as SpinOutcome['progressiveEvents']
    }))
    expect(anySoundPlayed()).toBe(true)
  })

  it('flag-stocked alone stays SILENT — stock-era machines hide the stock', () => {
    voiceFor('pachislo').reveal(DEF, out({
      totalPayout: 0,
      featureEvents: [{ type: 'flag-stocked', flag: 'BIG' }] as unknown as SpinOutcome['featureEvents']
    }))
    expect(anySoundPlayed()).toBe(false)
  })

  it('bonus-started plays the fever jingle even with zero payout', () => {
    voiceFor('pachislo').reveal(DEF, out({
      totalPayout: 0,
      featureEvents: [{ type: 'bonus-started', bonus: 'big' }] as unknown as SpinOutcome['featureEvents']
    }))
    expect(anySoundPlayed()).toBe(true)
  })

  it('every sounding voice makes noise on spinStart and reelStop', () => {
    for (const f of ['stepper', 'bally-em', 'video', 'pachislo'] as const) {
      vi.clearAllMocks()
      voiceFor(f).spinStart()
      expect(anySoundPlayed(), `${f} spinStart`).toBe(true)
      vi.clearAllMocks()
      voiceFor(f).reelStop(1, 3)
      expect(anySoundPlayed(), `${f} reelStop`).toBe(true)
    }
  })
})

// The recorded stings (public/audio) take over from the synth at exactly two
// moments — a feature arming and a jackpot landing — and nowhere else. Everything
// here also pins the degraded path: when the sample can't play, the cabinet must
// fall back to its synth fanfare, never to silence.
describe('sampled stings — the two peaks, and the fallback that keeps them honest', () => {
  const sample = () => audio.playSampleNow as ReturnType<typeof vi.fn>
  const names = () => sample().mock.calls.map(c => c[0] as string)

  beforeEach(() => {
    vi.clearAllMocks()
    sample().mockReturnValue(true) // the sting is loaded and audible
  })

  it('a jackpot fires the recorded jackpot — and the synth stands down', () => {
    voiceFor('bally-em').reveal(DEF, out({
      totalPayout: 1,
      progressiveEvents: [{ amountCredits: 5000 }] as unknown as SpinOutcome['progressiveEvents']
    }))
    expect(names()).toEqual(['jackpot'])
    expect(anySoundPlayed()).toBe(false) // the sample IS the fanfare now
  })

  it('a filled hold-and-spin Grand counts as a jackpot too', () => {
    voiceFor('video').reveal(DEF, out({
      totalPayout: 900,
      featureEvents: [{ type: 'hold-and-spin-ended', totalCredits: 900, filled: true }] as unknown as SpinOutcome['featureEvents']
    }))
    expect(names()).toEqual(['jackpot'])
  })

  it('a feature arming fires a bonus sting — and back-to-back features alternate', () => {
    voiceFor('pachislo').reveal(DEF, out({
      totalPayout: 0,
      featureEvents: [{ type: 'bonus-started', bonus: 'big' }] as unknown as SpinOutcome['featureEvents']
    }))
    voiceFor('video').reveal(DEF, out({
      totalPayout: 0,
      featureEvents: [{ type: 'free-spins-triggered', count: 10, multiplier: 2 }] as unknown as SpinOutcome['featureEvents']
    }))
    const [first, second] = names()
    expect([first, second].every(n => n === 'bonus-1' || n === 'bonus-2')).toBe(true)
    expect(first).not.toBe(second) // never the same sound twice running
  })

  it('the wheel topper arming is a feature trigger; the MEGA wedge is a jackpot', () => {
    voiceFor('wheel').reveal(DEF, out({
      totalPayout: 0,
      featureEvents: [{ type: 'wheel-armed' }] as unknown as SpinOutcome['featureEvents']
    }))
    expect(names()[0]).toMatch(/^bonus-[12]$/)

    vi.clearAllMocks()
    sample().mockReturnValue(true)
    voiceFor('wheel').reveal(DEF, out({
      totalPayout: 2500,
      featureEvents: [{ type: 'wheel-landed', wedgeIndex: 3, credits: 2500 }] as unknown as SpinOutcome['featureEvents']
    }))
    expect(names()).toEqual(['jackpot'])
  })

  it('an ordinary win — even a big one — never touches a sample', () => {
    voiceFor('stepper').reveal(DEF, out({ totalPayout: 2000 }))
    expect(sample()).not.toHaveBeenCalled()
    expect(anySoundPlayed()).toBe(true) // the synth still sings, as always
  })

  it('when the sting cannot play, the synth fanfare sings in its place', () => {
    sample().mockReturnValue(false) // muted, still locked, or not yet decoded
    voiceFor('bally-em').reveal(DEF, out({
      totalPayout: 1,
      progressiveEvents: [{ amountCredits: 5000 }] as unknown as SpinOutcome['progressiveEvents']
    }))
    expect(names()).toEqual(['jackpot']) // it was attempted...
    expect(anySoundPlayed()).toBe(true) // ...and the cabinet covered for it
  })
})
