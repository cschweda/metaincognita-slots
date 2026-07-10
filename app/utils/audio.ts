/**
 * Temple of Gold synth SFX — zero files, pure Web Audio, CSP-clean (no inline
 * scripts, no external media; nothing for the production CSP to block). The
 * floor had no audio before this; keep it self-contained and SSR-safe.
 *
 * Browser autoplay policy: an AudioContext starts suspended until a user
 * gesture, so unlock() must be called from a click/keydown. Every play fn is a
 * no-op when muted, on the server, or before unlock — they never throw.
 *
 * Sound defaults ON (the racket is the point) with a visible toggle; reduced-
 * motion shortens the longest fanfares.
 */

import { ref } from 'vue'

const MUTE_KEY = 'slots-sound-muted'

let ctx: AudioContext | null = null
// Reactive so cabinet mute buttons (label + aria-pressed) track it live;
// seeded from localStorage so the choice survives a revisit.
const muted = ref(loadMuted())

function loadMuted(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** True when the OS asks for reduced motion — fanfares shorten. */
export function reducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Create/resume the AudioContext from a user gesture. Safe to call repeatedly. */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch { /* Web Audio unavailable — play on in silence */ }
}

export function setMuted(on: boolean): void {
  muted.value = on
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(MUTE_KEY, on ? '1' : '0')
  } catch { /* storage unavailable (private mode) — session-only mute */ }
}

export function isMuted(): boolean {
  return muted.value
}

/** True when a sound may actually play right now. */
function live(): boolean {
  return !muted.value && ctx !== null && ctx.state === 'running'
}

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

/** Filtered white-noise burst — clinks, shatters, thunks. */
export function noiseBurst(dur: number, vol: number, filter: BiquadFilterType, freq: number, q = 1, delay = 0): void {
  if (!live()) return
  const c = ctx!
  const t = c.currentTime + delay
  const frames = Math.max(1, Math.floor(c.sampleRate * dur))
  const buffer = c.createBuffer(1, frames, c.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  const src = c.createBufferSource()
  src.buffer = buffer
  const biq = c.createBiquadFilter()
  biq.type = filter
  biq.frequency.value = freq
  biq.Q.value = q
  const gain = c.createGain()
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(biq).connect(gain).connect(c.destination)
  src.start(t)
  src.stop(t + dur + 0.02)
}

/** A struck bell — a few inharmonic partials over a single chime frequency. */
export function bell(freq: number, dur: number, vol: number, delay = 0): void {
  const partials = [1, 2.01, 3.0, 4.72]
  partials.forEach((p, i) => tone(freq * p, dur * (1 - i * 0.12), vol * (0.7 ** i), 'sine', delay))
}

// Pentatonic climb for cascade chains (each deeper tumble rings a higher note).
const PENT = [523.25, 587.33, 698.46, 783.99, 880, 1046.5, 1318.5, 1760]

/** Reels spin up. */
export function sfxWhirr(): void {
  tone(140, 0.18, 0.05, 'sawtooth')
  tone(210, 0.5, 0.04, 'sawtooth')
}

/** A reel stops / a UI click. */
export function sfxClick(): void {
  noiseBurst(0.05, 0.18, 'bandpass', 2200, 6)
}

/** A win at the given 1-based chain level — pentatonic chime + coin clink. */
export function sfxWin(chain = 1): void {
  const note = PENT[Math.min(chain - 1, PENT.length - 1)]!
  bell(note, 0.6, 0.16)
  noiseBurst(0.12, 0.12, 'highpass', 5000, 1, 0.02)
}

/** Symbols shatter on a tumble. */
export function sfxShatter(): void {
  noiseBurst(0.18, 0.2, 'highpass', 3000, 0.7)
  noiseBurst(0.1, 0.12, 'bandpass', 1400, 3, 0.03)
}

/** New symbols drop in. */
export function sfxDrop(): void {
  tone(90, 0.12, 0.12, 'triangle')
  noiseBurst(0.06, 0.08, 'lowpass', 600, 1, 0.02)
}

/** The Grand fanfare — an ascending pentatonic run, shortened under reduced-motion. */
export function sfxJackpot(): void {
  const notes = reducedMotion() ? PENT.slice(0, 4) : PENT
  notes.forEach((f, i) => bell(f, 0.7, 0.18, i * 0.12))
  tone(130.81, reducedMotion() ? 0.5 : 1.2, 0.06, 'sawtooth')
}

/** CASCADE! — a big escalating riser + double bell + sub boom + sparkle, bigger per chain. */
export function sfxCascade(chain = 2): void {
  if (!live()) return
  const c = ctx!
  const t = c.currentTime
  // rising whoosh
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = 'sawtooth'
  const base = 160 + chain * 45
  osc.frequency.setValueAtTime(base, t)
  osc.frequency.exponentialRampToValueAtTime(base * 4, t + 0.5)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.linearRampToValueAtTime(0.09, t + 0.1)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55)
  osc.connect(g).connect(c.destination)
  osc.start(t)
  osc.stop(t + 0.6)
  // big double bell hit on top (climbs with the chain)
  const note = PENT[Math.min(chain - 1, PENT.length - 1)]!
  bell(note * 1.5, 0.8, 0.22, 0.12)
  bell(note, 0.95, 0.18, 0.12)
  // sub boom + sparkle sweep
  tone(68, 0.55, 0.13, 'sine', 0.1)
  noiseBurst(0.32, 0.12, 'bandpass', 4200, 2, 0.14)
}
