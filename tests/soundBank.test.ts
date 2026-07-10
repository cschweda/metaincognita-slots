import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MachineDef, SpinOutcome } from '../app/engine'
import * as audio from '../app/utils/audio'
import { voiceFor, winTier } from '../app/utils/soundBank'

// Spy on the primitives so routing is observable without an AudioContext.
// (vi.mock is hoisted above the imports by vitest's transform.)
vi.mock('../app/utils/audio', () => ({
  tone: vi.fn(),
  noiseBurst: vi.fn(),
  bell: vi.fn(),
  reducedMotion: vi.fn(() => false)
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
