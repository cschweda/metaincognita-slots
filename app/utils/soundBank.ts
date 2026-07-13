// app/utils/soundBank.ts
// Period-authentic cabinet voices for the betting floor (spec:
// docs/superpowers/specs/2026-07-09-floor-sound-design.md). Synthesized from
// audio.ts primitives — no files, CSP-clean; every call is a no-op while
// muted/locked/SSR. Temple of Gold (cascade) keeps its bespoke Aztec voice;
// the parked interactive families stay silent.
//
// Registers are deliberately far apart so the families can't blur together:
// stepper lives LOW (thunks, a coin tray), bally-em MID with a true struck
// bell, video HIGH and melodic, pachislo all square-wave arcade.
import type { MachineDef, SpinOutcome } from '~/engine'
import type { SampleName } from '~/utils/audio'
import { bell, noiseBurst, playSampleNow, reducedMotion, tone } from '~/utils/audio'

// ── The two sampled moments ─────────────────────────────────────────────────
// Recorded stings (public/audio) take over from the synth at the peaks — a
// feature arming, a jackpot landing — and NOWHERE else. Every one is guarded:
// playSampleNow() returns false when the sample is muted, locked or not yet
// decoded, and the synth fanfare sings in its place. A missing file costs the
// sweetener, never the sound.
const BONUS_VOL = 0.4
const JACKPOT_VOL = 0.45

/** The two bonus stings alternate, so back-to-back features never play twice. */
let bonusFlip = 0
function nextBonusSting(): SampleName {
  bonusFlip ^= 1
  return bonusFlip === 1 ? 'bonus-1' : 'bonus-2'
}

export interface CabinetVoice {
  /** the reels spin up (once per paid game) */
  spinStart(): void
  /** reel `reel` (0-based of `reelCount`) just locked in */
  reelStop(reel: number, reelCount: number): void
  /** the outcome is on the glass — one big moment, payout-scaled */
  reveal(def: MachineDef, out: SpinOutcome): void
}

export type WinTier = 'none' | 'small' | 'medium' | 'big' | 'huge'

/**
 * Payout-vs-bet tier. 'small' (paid but under the bet) is the LDW — it still
 * gets a genuine celebration, exactly like a real machine; the ResultBar's
 * "net down" line does the exposing.
 */
export function winTier(out: SpinOutcome): WinTier {
  if (out.totalPayout <= 0) return 'none'
  const ratio = out.totalPayout / Math.max(1, out.coinsIn)
  if (ratio < 1) return 'small'
  if (ratio < 4) return 'medium'
  if (ratio < 15) return 'big'
  return 'huge'
}

/** What a family's reveal can play; playReveal picks ONE big moment. */
interface Fanfares {
  win(tier: Exclude<WinTier, 'none'>): void
  jackpot(): void
  bonusStart(): void
  stinger(kind: 'feature' | 'lock' | 'bonusEnd' | 'replay'): void
}

function playReveal(f: Fanfares, out: SpinOutcome): void {
  const grandFill = out.featureEvents.some(e => e.type === 'hold-and-spin-ended' && e.filled)
  if (out.progressiveEvents.length > 0 || grandFill) {
    if (!playSampleNow('jackpot', JACKPOT_VOL)) f.jackpot()
    return
  }
  if (out.featureEvents.some(e => e.type === 'bonus-started')) {
    if (!playSampleNow(nextBonusSting(), BONUS_VOL)) f.bonusStart()
    return
  }
  const tier = winTier(out)
  if (tier !== 'none') f.win(tier)
  if (out.featureEvents.some(e => e.type === 'free-spins-triggered' || e.type === 'free-spins-retriggered')) {
    if (!playSampleNow(nextBonusSting(), BONUS_VOL)) f.stinger('feature')
  }
  if (out.featureEvents.some(e => e.type === 'orbs-locked' || e.type === 'mult-orbs-locked')) f.stinger('lock')
  if (out.featureEvents.some(e => e.type === 'bonus-ended')) f.stinger('bonusEnd')
  if (out.featureEvents.some(e => e.type === 'replay-granted')) f.stinger('replay')
  // 'flag-stocked' is deliberately soundless: stock-era machines HIDE the
  // stock — the X-ray exposes it visually. Silence is the authentic behavior.
}

// ── Stepper: LOW register, purely mechanical — thunks and a coin tray ──────

/** Coins rattling into the metal tray. */
function tray(clinks: number, delay = 0): void {
  for (let i = 0; i < clinks; i++) {
    noiseBurst(0.05, 0.15, 'bandpass', 2400 - (i % 5) * 90, 5, delay + i * 0.07)
  }
}

const stepperFanfares: Fanfares = {
  win(tier) {
    if (tier === 'huge') {
      stepperFanfares.jackpot()
      return
    }
    if (tier === 'small') {
      tray(4)
      bell(660, 0.4, 0.08, 0.05)
    } else if (tier === 'medium') {
      tray(8)
      bell(660, 0.5, 0.1, 0.05)
    } else {
      tray(14)
      bell(660, 0.5, 0.11, 0.05)
      bell(880, 0.5, 0.09, 0.35)
    }
  },
  jackpot() {
    const rings = reducedMotion() ? 2 : 4
    for (let i = 0; i < rings; i++) bell(880, 0.45, 0.16, i * 0.3) // the old jackpot bell
    tray(reducedMotion() ? 8 : 18, 0.15)
  },
  bonusStart() {
    stepperFanfares.win('big')
  },
  stinger(kind) {
    if (kind === 'replay') {
      tone(660, 0.08, 0.1, 'triangle')
      tone(880, 0.08, 0.1, 'triangle', 0.1)
    } else if (kind === 'lock') {
      bell(1046, 0.25, 0.09)
    } else {
      bell(784, 0.3, 0.08)
    }
  }
}

const stepperVoice: CabinetVoice = {
  spinStart() {
    noiseBurst(0.08, 0.2, 'lowpass', 200) // the lever clunk
    tone(110, 0.4, 0.055, 'sawtooth')
    tone(165, 0.9, 0.04, 'sawtooth')
  },
  reelStop(reel) {
    noiseBurst(0.09, 0.3, 'lowpass', 300)
    tone([65, 60, 55][Math.min(reel, 2)]!, 0.09, 0.25, 'sine') // heavier per reel
  },
  reveal(_def, out) {
    playReveal(stepperFanfares, out)
  }
}

// ── Bally EM: MID register, electromechanical — motor, relays, a TRUE bell ─

function dings(n: number, gap = 0.22): void {
  for (let i = 0; i < n; i++) bell(1318, 0.5, 0.18, i * gap)
}

/** Payout slides clunking coins out. */
function clunks(n: number, delay = 0): void {
  for (let i = 0; i < n; i++) noiseBurst(0.07, 0.16, 'bandpass', 1200, 3, delay + i * 0.11)
}

const ballyFanfares: Fanfares = {
  win(tier) {
    if (tier === 'huge') {
      ballyFanfares.jackpot()
      return
    }
    if (tier === 'small') {
      dings(1)
      clunks(2, 0.15)
    } else if (tier === 'medium') {
      dings(2)
      clunks(4, 0.2)
    } else {
      dings(3)
      clunks(8, 0.25)
    }
  },
  jackpot() {
    const n = reducedMotion() ? 3 : 6
    for (let i = 0; i < n; i++) bell(1318, 0.5, 0.19, i * (0.26 - i * 0.02)) // accelerando peal
    clunks(reducedMotion() ? 6 : 12, 0.3)
  },
  bonusStart() {
    ballyFanfares.win('big')
  },
  stinger(kind) {
    if (kind === 'replay') {
      tone(1046, 0.08, 0.1, 'triangle')
      tone(1318, 0.08, 0.1, 'triangle', 0.1)
    } else {
      bell(1046, 0.3, 0.1)
    }
  }
}

const ballyVoice: CabinetVoice = {
  spinStart() {
    tone(55, 1.1, 0.05, 'sawtooth') // motor spin-up
    tone(110, 1.1, 0.028, 'sawtooth')
    noiseBurst(0.04, 0.12, 'bandpass', 1500, 4) // relay click
  },
  reelStop() {
    noiseBurst(0.1, 0.3, 'lowpass', 250)
    tone(80, 0.1, 0.26, 'sine')
    noiseBurst(0.03, 0.08, 'bandpass', 1500, 4, 0.02) // relay tick
  },
  reveal(_def, out) {
    playReveal(ballyFanfares, out)
  }
}

// ── Video: HIGH register, digital and melodic ──────────────────────────────

const ARP = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568] // ascending digital run

function arpeggio(n: number, gap = 0.07, vol = 0.09): void {
  for (let i = 0; i < n; i++) {
    const f = ARP[Math.min(i, ARP.length - 1)]!
    tone(f, 0.18, vol, 'square', i * gap)
    tone(f, 0.3, vol * 0.85, 'sine', i * gap)
  }
}

const videoFanfares: Fanfares = {
  win(tier) {
    if (tier === 'huge') {
      videoFanfares.jackpot()
      return
    }
    if (tier === 'small') {
      arpeggio(3)
    } else if (tier === 'medium') {
      arpeggio(4)
      noiseBurst(0.2, 0.07, 'highpass', 5000, 1, 0.28)
    } else {
      arpeggio(6)
      noiseBurst(0.3, 0.09, 'highpass', 5500, 1, 0.4)
    }
  },
  jackpot() {
    const runs = reducedMotion() ? 1 : 2
    for (let r = 0; r < runs; r++) {
      ARP.forEach((f, i) => {
        tone(f, 0.2, 0.1, 'square', r * 0.5 + i * 0.08)
        bell(f, 0.4, 0.08, r * 0.5 + i * 0.08)
      })
    }
    noiseBurst(0.35, 0.1, 'highpass', 6000, 1, 0.3)
  },
  bonusStart() {
    videoFanfares.win('big')
  },
  stinger(kind) {
    if (kind === 'feature') {
      tone(1046, 0.09, 0.09, 'square')
      tone(1318, 0.09, 0.09, 'square', 0.09)
      tone(1568, 0.14, 0.09, 'square', 0.18)
    } else if (kind === 'lock') {
      bell(1568, 0.22, 0.09) // glassy orb clink
    } else if (kind === 'replay') {
      tone(880, 0.08, 0.09, 'square')
      tone(1046, 0.08, 0.09, 'square', 0.1)
    } else {
      bell(1046, 0.25, 0.08)
    }
  }
}

const videoVoice: CabinetVoice = {
  spinStart() {
    tone(300, 0.4, 0.05, 'sine', 0, 900) // soft rising whoosh
  },
  reelStop(reel) {
    noiseBurst(0.04, 0.14, 'bandpass', 2600 + reel * 150, 6) // ticks form a tiny scale
  },
  reveal(_def, out) {
    playReveal(videoFanfares, out)
  }
}

// ── Pachislo: all square waves — a Japanese arcade in a metal box ──────────

const FEVER = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5, 1046.5, 1318.5, 1568]

const pachisloFanfares: Fanfares = {
  win(tier) {
    if (tier === 'huge') {
      pachisloFanfares.jackpot()
      return
    }
    const n = tier === 'small' ? 3 : tier === 'medium' ? 5 : 7
    for (let i = 0; i < n; i++) tone(FEVER[i]!, 0.09, 0.1, 'square', i * 0.08)
  },
  jackpot() {
    pachisloFanfares.bonusStart()
  },
  bonusStart() {
    // THE fever jingle — the REG/BIG moment every parlor knows.
    const loops = reducedMotion() ? 1 : 2
    for (let l = 0; l < loops; l++) {
      FEVER.forEach((f, i) => tone(f, 0.08, 0.11, 'square', l * 0.8 + i * 0.075))
    }
    noiseBurst(0.25, 0.08, 'highpass', 5000, 1, 0.5)
  },
  stinger(kind) {
    if (kind === 'bonusEnd') {
      tone(783.99, 0.1, 0.1, 'square')
      tone(523.25, 0.14, 0.1, 'square', 0.12)
    } else if (kind === 'replay') {
      tone(1046.5, 0.07, 0.11, 'square')
      tone(1046.5, 0.07, 0.11, 'square', 0.11)
    } else {
      tone(1318.5, 0.1, 0.1, 'square')
    }
  }
}

const pachisloVoice: CabinetVoice = {
  spinStart() {
    noiseBurst(0.06, 0.18, 'lowpass', 500) // tokens chunk in
    tone(220, 0.18, 0.07, 'triangle', 0.05, 440) // rising arm blip
  },
  reelStop(reel) {
    tone([880, 990, 1175][Math.min(reel, 2)]!, 0.07, 0.12, 'square') // rising press beeps
    noiseBurst(0.03, 0.1, 'bandpass', 3000, 6)
  },
  reveal(_def, out) {
    playReveal(pachisloFanfares, out)
  }
}

// ── Wonder Wheel: a modern carnival cabinet — digital bed, big topper voice ─

/** Fanfare tiers by WEDGE CREDITS (the wheel resolve has coinsIn 0, so the
 *  payout-vs-bet winTier would read every wedge as 'huge'). */
function wheelWedgeTier(credits: number): Exclude<WinTier, 'none'> {
  if (credits < 60) return 'small'
  if (credits < 150) return 'medium'
  if (credits < 400) return 'big'
  return 'huge'
}

const WHEEL_ARP = [523.25, 659.25, 783.99, 1046.5]

const wheelFanfares: Fanfares = {
  win(tier) {
    const n = tier === 'small' ? 3 : tier === 'medium' ? 5 : tier === 'big' ? 7 : 9
    for (let i = 0; i < n; i++) {
      const f = WHEEL_ARP[i % WHEEL_ARP.length]! * (1 + Math.floor(i / WHEEL_ARP.length))
      tone(f, 0.11, 0.1, 'triangle', i * 0.08)
      if (tier !== 'small') bell(f, 0.25, 0.05, i * 0.08)
    }
  },
  jackpot() {
    // the MEGA wedge — the full 1996 attendant-pays moment
    const runs = reducedMotion() ? 1 : 3
    for (let r = 0; r < runs; r++) {
      WHEEL_ARP.forEach((f, i) => {
        tone(f * 2, 0.18, 0.1, 'square', r * 0.45 + i * 0.07)
        bell(f, 0.5, 0.09, r * 0.45 + i * 0.07)
      })
    }
    noiseBurst(0.4, 0.1, 'highpass', 5200, 1, 0.5)
  },
  bonusStart() {
    wheelFanfares.stinger('feature')
  },
  stinger(kind) {
    if (kind === 'feature') {
      // WHEEL! — the rising arm sting the whole floor turns toward
      [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone(f, 0.12, 0.11, 'sawtooth', i * 0.07)
      })
      bell(1568, 0.5, 0.1, 0.38)
    } else {
      bell(1046, 0.25, 0.08)
    }
  }
}

const wheelVoice: CabinetVoice = {
  spinStart() {
    tone(340, 0.3, 0.05, 'triangle', 0, 760) // bright modern whoosh
  },
  reelStop(reel) {
    noiseBurst(0.04, 0.13, 'bandpass', 2200 + reel * 260, 6)
    tone(660 + reel * 120, 0.05, 0.07, 'square')
  },
  reveal(_def, out) {
    if (out.featureEvents.some(e => e.type === 'wheel-armed')) {
      // the topper arming IS this cabinet's feature trigger
      if (!playSampleNow(nextBonusSting(), BONUS_VOL)) wheelFanfares.stinger('feature')
      return
    }
    const landed = out.featureEvents.find(e => e.type === 'wheel-landed')
    if (landed !== undefined && landed.type === 'wheel-landed') {
      // MEGA (2,500 credits) is the wheel's jackpot — the recorded one
      if (landed.credits >= 2500) {
        if (!playSampleNow('jackpot', JACKPOT_VOL)) wheelFanfares.jackpot()
      } else {
        wheelFanfares.win(wheelWedgeTier(landed.credits))
      }
      return
    }
    // 'wheel-wasted' stays SOUNDLESS on purpose: a real cabinet says nothing
    // when an under-max bet wastes the trigger — the result line does the
    // talking here. Ordinary line pays get the ordinary celebration.
    playReveal(wheelFanfares, out)
  }
}

/**
 * The topper's decelerating ticker: ~N clicks whose gaps stretch as the wheel
 * slows, matching the overlay's 4.2s ease-out. Called once per wheel spin by
 * the overlay (a gesture always precedes it, so the context is unlocked).
 */
export function wheelTicker(totalMs = 4200): void {
  const clicks = reducedMotion() ? 0 : 26
  let t = 0
  for (let i = 0; i < clicks; i++) {
    const progress = i / clicks
    const gap = 0.03 + 0.145 * progress * progress // fast then stretching
    t += gap
    if (t * 1000 > totalMs) break
    noiseBurst(0.018, 0.11, 'bandpass', 3000, 7, t)
  }
  bell(784, 0.3, 0.09, Math.min(t + 0.05, totalMs / 1000)) // the flapper settles
}

// ── Registry ────────────────────────────────────────────────────────────────

const SILENT: CabinetVoice = {
  spinStart() { /* cascade self-instruments; parked cabinets stay quiet */ },
  reelStop() { /* silent */ },
  reveal() { /* silent */ }
}

const VOICES: Record<MachineDef['family'], CabinetVoice> = {
  'stepper': stepperVoice,
  'bally-em': ballyVoice,
  'video': videoVoice,
  'pachislo': pachisloVoice,
  'cascade': SILENT,
  'blackjack-reel': SILENT,
  'lock-reel': SILENT,
  'wheel': wheelVoice
}

export function voiceFor(family: MachineDef['family']): CabinetVoice {
  return VOICES[family]
}
