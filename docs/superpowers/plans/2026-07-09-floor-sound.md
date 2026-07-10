# Floor Sound Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the nine silent floor machines period-authentic voices (spec: `docs/superpowers/specs/2026-07-09-floor-sound-design.md`) — synthesized Web Audio, payout-scaled reveals with the authentic LDW party, wired through the shared spin lifecycle, with a global mute in the top nav.

**Architecture:** `utils/audio.ts` exports its synth primitives; a new `utils/soundBank.ts` defines four `CabinetVoice`s (stepper/bally-em/video/pachislo) plus a silent voice behind `voiceFor(family)`; `useReelSpin` (video+stepper+bally) and `usePachisloPress` (pachislo) call the voice at their existing lifecycle points; gestures call `unlockAudio()`; a nav `AppSoundToggle` binds the existing persisted mute state.

**Tech Stack:** Nuxt 4 (auto-imports: `app/components/AppSoundToggle.vue` → `<AppSoundToggle>`), Pinia, Web Audio API, Vitest 4 (+@vue/test-utils, happy-dom per-file).

## Global Constraints

- **No `Co-Authored-By`/AI trailer in commits** (user's global rule).
- **Temple of Gold's cascade voice is untouched**; parked families (`blackjack-reel`, `lock-reel`) stay SILENT.
- **Every sound function is a safe no-op when muted/locked/SSR** — never throws (the `live()` guard already inside `tone`/`noiseBurst`).
- **Gain discipline:** every volume within 0.04–0.3 (audio.ts's established range).
- **Clean losses are silent; LDWs get the genuine payout-scaled party; `flag-stocked` is deliberately silent.**
- Per-task gate: `pnpm lint` + the task's vitest files. Full `pnpm check` only in the final task.
- Work on the existing `floor-sound` branch. Repo root: `/Volumes/satechi/webdev/metaincognita-slots`.

---

### Task 1: Export the synth primitives (+ optional glide on `tone`)

**Files:**
- Modify: `app/utils/audio.ts` (functions `tone` :67, `noiseBurst` :84, `bell` :107, `reducedMotion` :32)
- Modify: `tests/audio.test.ts` (append a describe block)

**Interfaces:**
- Produces: `export function tone(freq: number, dur: number, vol: number, type?: OscillatorType, delay?: number, glideTo?: number | null): void`, `export function noiseBurst(dur: number, vol: number, filter: BiquadFilterType, freq: number, q?: number, delay?: number): void`, `export function bell(freq: number, dur: number, vol: number, delay?: number): void`, `export function reducedMotion(): boolean` — all from `~/utils/audio`. Task 2 composes these.

- [ ] **Step 1: Write the failing test** — append to `tests/audio.test.ts`:

```ts
describe('synth primitives (exported for the sound bank)', () => {
  it('tone/noiseBurst/bell/reducedMotion are exported and headless-safe (no ctx → no-op, never throw)', async () => {
    const audio = await import('../app/utils/audio')
    expect(typeof audio.tone).toBe('function')
    expect(typeof audio.noiseBurst).toBe('function')
    expect(typeof audio.bell).toBe('function')
    expect(typeof audio.reducedMotion).toBe('function')
    expect(() => audio.tone(440, 0.1, 0.1)).not.toThrow()
    expect(() => audio.tone(300, 0.3, 0.05, 'sine', 0, 900)).not.toThrow() // glide variant
    expect(() => audio.noiseBurst(0.1, 0.1, 'lowpass', 300)).not.toThrow()
    expect(() => audio.bell(660, 0.4, 0.1)).not.toThrow()
    expect(audio.reducedMotion()).toBe(false) // node env: no matchMedia
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run tests/audio.test.ts`
Expected: FAIL — `audio.tone` is undefined (not exported).

- [ ] **Step 3: Implement** — in `app/utils/audio.ts`:

(a) `function reducedMotion(` → `export function reducedMotion(` (line 32; JSDoc-comment it: `/** True when the OS asks for reduced motion — fanfares shorten. */`)
(b) `function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0): void {` → add the glide param and ramp:

```ts
/** A single oscillator note with an attack/decay envelope; optional pitch glide. */
export function tone(freq: number, dur: number, vol: number, type: OscillatorType = 'sine', delay = 0, glideTo: number | null = null): void {
  if (!live()) return
  const c = ctx!
  const t = c.currentTime + delay
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (glideTo !== null) osc.frequency.exponentialRampToValueAtTime(glideTo, t + dur)
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(vol, t + Math.min(0.01, dur * 0.2))
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}
```

(c) `function noiseBurst(` → `export function noiseBurst(` (body unchanged)
(d) `function bell(` → `export function bell(` (body unchanged)

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/audio.test.ts`
Expected: PASS (existing + new).

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint
git add app/utils/audio.ts tests/audio.test.ts
git commit -m "feat(audio): export synth primitives + optional pitch glide on tone"
```

---

### Task 2: The sound bank — four period-authentic voices

**Files:**
- Create: `app/utils/soundBank.ts`
- Create: `tests/soundBank.test.ts`

**Interfaces:**
- Consumes: `tone`, `noiseBurst`, `bell`, `reducedMotion` from `~/utils/audio` (Task 1).
- Produces: `export interface CabinetVoice { spinStart(): void, reelStop(reel: number, reelCount: number): void, reveal(def: MachineDef, out: SpinOutcome): void }`, `export function voiceFor(family: MachineDef['family']): CabinetVoice`, `export function winTier(out: SpinOutcome): 'none' | 'small' | 'medium' | 'big' | 'huge'` — Tasks 3 and 4 consume `voiceFor`.

- [ ] **Step 1: Write the failing tests** — create `tests/soundBank.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MachineDef, SpinOutcome } from '../app/engine'

// Spy on the primitives so routing is observable without an AudioContext.
vi.mock('../app/utils/audio', () => ({
  tone: vi.fn(),
  noiseBurst: vi.fn(),
  bell: vi.fn(),
  reducedMotion: vi.fn(() => false)
}))

import * as audio from '../app/utils/audio'
import { voiceFor, winTier } from '../app/utils/soundBank'

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
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/soundBank.test.ts`
Expected: FAIL — module `app/utils/soundBank` not found.

- [ ] **Step 3: Implement `app/utils/soundBank.ts`**

```ts
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
import { bell, noiseBurst, reducedMotion, tone } from '~/utils/audio'

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
    f.jackpot()
    return
  }
  if (out.featureEvents.some(e => e.type === 'bonus-started')) {
    f.bonusStart()
    return
  }
  const tier = winTier(out)
  if (tier !== 'none') f.win(tier)
  if (out.featureEvents.some(e => e.type === 'free-spins-triggered' || e.type === 'free-spins-retriggered')) f.stinger('feature')
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
  'lock-reel': SILENT
}

export function voiceFor(family: MachineDef['family']): CabinetVoice {
  return VOICES[family]
}
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/soundBank.test.ts`
Expected: PASS (all describes).

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint
git add app/utils/soundBank.ts tests/soundBank.test.ts
git commit -m "feat(sound): four period-authentic cabinet voices behind voiceFor()"
```

---

### Task 3: Wire the shared spin lifecycle (video + stepper + bally)

**Files:**
- Modify: `app/composables/useReelSpin.ts`
- Create: `tests/useReelSpinSound.test.ts`

**Interfaces:**
- Consumes: `voiceFor` from `~/utils/soundBank` (Task 2); `store.currentDef`, `store.lastOutcome`.
- Produces: nothing new — behavior only.

- [ ] **Step 1: Write the failing test** — create `tests/useReelSpinSound.test.ts`:

```ts
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const bank = {
  spinStart: vi.fn(),
  reelStop: vi.fn(),
  reveal: vi.fn()
}
vi.mock('../app/utils/soundBank', () => ({
  voiceFor: vi.fn(() => bank)
}))

const reduced = ref(false)
vi.mock('../app/composables/useReducedMotion', () => ({
  useReducedMotion: () => reduced
}))

import { useReelSpin } from '../app/composables/useReelSpin'
import { useSlotsStore } from '../app/stores/slots'

function mountHarness() {
  const Harness = defineComponent({
    setup() {
      useReelSpin({
        reelCount: () => 3,
        visibleRows: 3,
        grid: () => [['A'], ['B'], ['C']],
        filler: () => ['A', 'B', 'C']
      })
      return () => h('div')
    }
  })
  return mount(Harness)
}

describe('useReelSpin sound wiring', () => {
  let wrapper: VueWrapper
  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    localStorage.clear()
    reduced.value = false
    vi.clearAllMocks()
  })
  afterEach(() => {
    wrapper?.unmount()
    vi.useRealTimers()
  })

  async function startSpin() {
    const store = useSlotsStore()
    store.startSession(100_000)
    store.selectMachine('diamond-doubler')
    wrapper = mountHarness()
    store.spinning = true // drive the watcher directly; outcome preset below
    store.lastOutcome = { coinsIn: 3, totalPayout: 0, featureEvents: [], progressiveEvents: [], wins: [] } as never
    await wrapper.vm.$nextTick()
    return store
  }

  it('plays spinStart, one reelStop per reel in order, then exactly one reveal', async () => {
    await startSpin()
    expect(bank.spinStart).toHaveBeenCalledTimes(1)
    expect(bank.reveal).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1100) // reel 0 lands
    expect(bank.reelStop).toHaveBeenCalledTimes(1)
    expect(bank.reelStop).toHaveBeenNthCalledWith(1, 0, 3)

    vi.advanceTimersByTime(220) // reel 1
    vi.advanceTimersByTime(220) // reel 2 (last) → reveal
    expect(bank.reelStop).toHaveBeenCalledTimes(3)
    expect(bank.reelStop).toHaveBeenNthCalledWith(3, 2, 3)
    expect(bank.reveal).toHaveBeenCalledTimes(1)
  })

  it('reduced motion: no ticks — one settle click + the reveal', async () => {
    reduced.value = true
    await startSpin()
    expect(bank.spinStart).not.toHaveBeenCalled()
    expect(bank.reelStop).toHaveBeenCalledTimes(1) // the settle click
    expect(bank.reveal).toHaveBeenCalledTimes(1)
  })

  it('unmounting mid-spin never fires the reveal', async () => {
    await startSpin()
    vi.advanceTimersByTime(1100) // one reel landed
    wrapper.unmount()
    vi.advanceTimersByTime(5000)
    expect(bank.reveal).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/useReelSpinSound.test.ts`
Expected: FAIL — `bank.spinStart` never called (no wiring yet).

- [ ] **Step 3: Wire `app/composables/useReelSpin.ts`**

(a) Imports:

```ts
import { useSlotsStore } from '~/stores/slots'
import { useReducedMotion } from '~/composables/useReducedMotion'
import { voiceFor } from '~/utils/soundBank'
```

(b) After `const reduced = useReducedMotion()` add:

```ts
  // The cabinet's period voice (silent for cascade/parked): reel thunks and
  // the payout-scaled reveal ride the SAME timers as the visuals.
  const voice = computed(() => voiceFor(store.currentDef?.family ?? 'cascade'))
  function revealSound() {
    const def = store.currentDef
    if (def !== null && store.lastOutcome !== null) voice.value.reveal(def, store.lastOutcome)
  }
```

(c) Replace the reduced-motion branch of the watcher:

```ts
    if (reduced.value) {
      settle()
      store.revealDone()
      voice.value.reelStop(opts.reelCount() - 1, opts.reelCount()) // one settle click
      revealSound()
      return
    }
```

(d) Right after the `buffer.value = …` / `offsetY.value = …` / `blur.value = …` setup block (before the `landing` const), add:

```ts
    voice.value.spinStart()
```

(e) In the per-reel landing timer, add the stop sound and the reveal:

```ts
      timers.push(setTimeout(() => {
        revealed.value = r + 1
        voice.value.reelStop(r, opts.reelCount())
        if (r === opts.reelCount() - 1) {
          store.revealDone()
          settle() // collapse the buffer: strips === grid (exact outcome, clean a11y tree)
          revealSound()
        }
      }, dur))
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/useReelSpinSound.test.ts`
Expected: PASS (3 tests). Also run the neighbors that exercise this composable:
`pnpm vitest run tests/components/reelSurfaces.test.ts tests/components/reelVideo.test.ts`
Expected: PASS unchanged.

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint
git add app/composables/useReelSpin.ts tests/useReelSpinSound.test.ts
git commit -m "feat(sound): reel thunks + payout-scaled reveal ride the shared spin timers"
```

---

### Task 4: Wire pachislo (arm / press / resolve)

**Files:**
- Modify: `app/composables/usePachisloPress.ts`
- Create: `tests/pachisloPressSound.test.ts`

**Interfaces:**
- Consumes: `voiceFor` (Task 2), `unlockAudio` from `~/utils/audio`.
- Produces: nothing new — behavior only.

- [ ] **Step 1: Write the failing test** — create `tests/pachisloPressSound.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const bank = {
  spinStart: vi.fn(),
  reelStop: vi.fn(),
  reveal: vi.fn()
}
vi.mock('../app/utils/soundBank', () => ({
  voiceFor: vi.fn(() => bank)
}))
vi.mock('../app/utils/audio', () => ({
  unlockAudio: vi.fn()
}))

import { usePachisloPress } from '../app/composables/usePachisloPress'
import { useSlotsStore } from '../app/stores/slots'
import { unlockAudio } from '../app/utils/audio'

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
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/pachisloPressSound.test.ts`
Expected: FAIL — `unlockAudio`/`bank.spinStart` not called.

- [ ] **Step 3: Wire `app/composables/usePachisloPress.ts`**

(a) Imports:

```ts
import { nextSpinCost } from '~/engine'
import { unlockAudio } from '~/utils/audio'
import { voiceFor } from '~/utils/soundBank'
```

(b) In `arm()`, after the cost guard passes (right before `pressed.value = [null, null, null]`):

```ts
    unlockAudio() // arm IS the user gesture — wake the AudioContext here
```

and in the non-reduced path, right before `lastT = 0`:

```ts
    voiceFor('pachislo').spinStart()
```

(The reduced-motion path resolves instantly — reveal only, no spin-up, per spec.)

(c) In `press()`, after the `pressed.value = [...pressed.value]` line (the press has registered):

```ts
    voiceFor('pachislo').reelStop(reel, 3)
```

(d) In `resolveWith()`, guard against a bailed spin replaying a stale outcome:

```ts
  function resolveWith(presses: [number, number, number]) {
    armed.value = false
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    const prev = store.lastOutcome
    store.spinOnce(presses)
    const def = store.currentDef
    // Only voice a FRESH outcome — spinOnce bails (announcement only) when the
    // bankroll can't cover the game, and a stale reveal would replay old news.
    if (def !== null && store.lastOutcome !== null && store.lastOutcome !== prev) {
      voiceFor('pachislo').reveal(def, store.lastOutcome)
    }
    store.revealDone() // the pachislo "reveal" is the slip annotation; no async animation gate
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm vitest run tests/pachisloPressSound.test.ts tests/components/pachisloControls.test.ts`
Expected: PASS (new file + existing controls suite unchanged).

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint
git add app/composables/usePachisloPress.ts tests/pachisloPressSound.test.ts
git commit -m "feat(sound): pachislo arm/press/resolve voice + gesture unlock"
```

---

### Task 5: Gesture unlocks for the button-and-keyboard spin paths

**Files:**
- Modify: `app/components/game/BetControls.vue` (:40-42 `spin()`)
- Modify: `app/pages/game.vue` (keydown handler)

**Interfaces:**
- Consumes: `unlockAudio` from `~/utils/audio`.

Why: `useReelSpin` plays from a watcher, which is NOT a user gesture — the AudioContext must be resumed in the actual click/keydown handler or the first spin stays silent.

- [ ] **Step 1: BetControls** — add the import and unlock:

```ts
import { nextSpinCost } from '~/engine'
import { unlockAudio } from '~/utils/audio'
```

```ts
function spin() {
  unlockAudio() // the click is the gesture that wakes the AudioContext
  store.spinOnce()
}
```

- [ ] **Step 2: game.vue keydown** — in `onKeydown`, the standard-family branch at the end:

```ts
  if (!isSpace) return
  e.preventDefault()
  unlockAudio() // keyboard spin is a gesture too
  store.spinOnce()
```

with the import added to the script block:

```ts
import { unlockAudio } from '~/utils/audio'
```

- [ ] **Step 3: Verify by typecheck + the component suite**

Run: `pnpm vitest run tests/components/betControls.test.ts && pnpm lint`
Expected: PASS / clean (the unlock is a headless no-op in tests).

- [ ] **Step 4: Commit**

```bash
git add app/components/game/BetControls.vue app/pages/game.vue
git commit -m "feat(sound): unlock the AudioContext from the real spin gestures"
```

---

### Task 6: The nav mute toggle

**Files:**
- Create: `app/components/AppSoundToggle.vue` (auto-imports as `<AppSoundToggle>`)
- Modify: `app/layouts/default.vue` (top-nav right side, :52-58)
- Create: `tests/components/appSoundToggle.test.ts`

**Interfaces:**
- Consumes: `isMuted`, `setMuted`, `unlockAudio` from `~/utils/audio` (existing persisted reactive state — Temple's in-cabinet toggle shares it automatically).

- [ ] **Step 1: Write the failing test** — create `tests/components/appSoundToggle.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AppSoundToggle from '../../app/components/AppSoundToggle.vue'
import { setMuted } from '../../app/utils/audio'

const stubs = { UIcon: true }

describe('AppSoundToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    setMuted(false) // module-level ref persists across files — reset explicitly
  })

  it('mirrors state on aria-pressed and persists the choice', async () => {
    const w = mount(AppSoundToggle, { global: { stubs } })
    const btn = w.find('button')
    expect(btn.attributes('aria-pressed')).toBe('true') // sound ON by default
    expect(btn.text()).toMatch(/sound on/i)

    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('false')
    expect(btn.text()).toMatch(/sound off/i)
    expect(localStorage.getItem('slots-sound-muted')).toBe('1')

    await btn.trigger('click')
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('slots-sound-muted')).toBe('0')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/components/appSoundToggle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/components/AppSoundToggle.vue`**

```vue
<!-- app/components/AppSoundToggle.vue -->
<!-- Global floor mute. Binds the same persisted reactive mute state as the
     Temple cabinet toggle, so the two can never disagree. aria-pressed=true
     means SOUND ON (the button asserts "sound"). -->
<script setup lang="ts">
import { computed } from 'vue'
import { isMuted, setMuted, unlockAudio } from '~/utils/audio'

const on = computed(() => !isMuted())
function toggle(): void {
  unlockAudio() // the toggle click doubles as the context-waking gesture
  setMuted(!isMuted())
}
</script>

<template>
  <button
    type="button"
    :aria-pressed="on"
    class="flex items-center gap-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 rounded"
    :class="on ? 'text-amber-400 hover:text-amber-300' : 'text-neutral-500 hover:text-neutral-400'"
    @click="toggle"
  >
    <UIcon
      :name="on ? 'i-lucide-volume-2' : 'i-lucide-volume-x'"
      class="w-3.5 h-3.5"
    />
    <span>{{ on ? 'Sound on' : 'Sound off' }}</span>
  </button>
</template>
```

- [ ] **Step 4: Mount it in the top nav** — in `app/layouts/default.vue`, replace the right-side session indicator block:

```html
      <div class="flex items-center gap-3">
        <AppSoundToggle />
        <div
          v-if="store.phase === 'playing'"
          class="flex items-center gap-1"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 motion-safe:animate-pulse" />
          <span class="text-[10px] text-neutral-400">Session active</span>
        </div>
      </div>
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm vitest run tests/components/appSoundToggle.test.ts && pnpm lint`
Expected: PASS / clean.

- [ ] **Step 6: Commit**

```bash
git add app/components/AppSoundToggle.vue app/layouts/default.vue tests/components/appSoundToggle.test.ts
git commit -m "feat(sound): global mute toggle in the top nav (shares Temple's persisted state)"
```

---

### Task 7: Full gates, CHANGELOG, live listen-through, merge

**Files:**
- Modify: `CHANGELOG.md` (Unreleased → Added)

- [ ] **Step 1: CHANGELOG** — under `## [Unreleased]` → `### Added`, insert as the FIRST bullet:

```markdown
- **The floor has a voice — all ten machines now make sound.** Four
  period-authentic synthesized voices (no audio files, CSP-clean): steppers
  thunk mechanically and rattle coins into the tray, the 1979 Bally EMs hum
  and ring a true striking bell, the video slots chime in digital arpeggios,
  and Stock Rush beeps like a Japanese parlor (with the fever jingle on a
  bonus). Reveals scale with the payout — a loss disguised as a win throws
  the same party a real machine would, while the ResultBar's net line keeps
  telling the truth; clean losses stay silent; a stocked pachislo flag stays
  deliberately silent (real machines hide it — the X-ray shows it). Global
  mute lives in the top nav and shares Temple of Gold's persisted state.
```

- [ ] **Step 2: Full repo gate**

Run: `pnpm check`
Expected: lint clean, typecheck clean, full suite green, verify 10/10 at 5M spins.

- [ ] **Step 3: Live listen-through** (`pnpm dev`, real browser, volume up)

1. Floor → nav shows the Sound on toggle; click it off/on (persists across reload).
2. Diamond Doubler (stepper): spin — lever clunk + whirr, three descending thunks, coin-tray rattle on a win; silence on a clean loss.
3. Series E (bally-em): motor hum, clunky stops, true bell dings on wins.
4. Canal Royale (video): whoosh, five rising ticks, arpeggio wins — confirm an LDW (win under bet) still chimes while ResultBar shows net down.
5. Stock Rush (pachislo): arm chunk+blip, rising press beeps on 1/2/3, fever jingle on a bonus if one hits.
6. Temple of Gold: REGRESSION — its Aztec voice unchanged, its cabinet toggle still tracks the nav toggle.
7. Reduced motion (macOS: System Settings → Accessibility → Display → Reduce motion): spin settles instantly with a single click + reveal.
8. Console: zero errors.

- [ ] **Step 4: Commit, merge to main (house pattern), stay unpushed**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG — the floor has a voice"
git checkout main && git merge --ff-only floor-sound && git branch -d floor-sound
```

(Commits are business-hours — rewrite to off-hours before any push, per the house rule. Push only when asked.)
