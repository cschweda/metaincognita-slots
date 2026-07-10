# Floor Sound — Design Spec (2026-07-09)

Owner decisions (heard live via the audible companion, then delegated tuning):
**Direction A — period-authentic per family**, and **LDW treatment A — the
authentic payout-scaled party** (the ResultBar "net down" line and the X-ray do
the exposing, exactly as `/learn/ldw-near-miss` teaches). Owner deferred all
fine-grained sound choices: differentiation should be pushed HARDER than the
brainstorm sketches (distinct registers, waveforms, and rhythms per family).

## Scope

- The nine silent floor machines get voices: 4 video, 2 steppers, 2 Bally EM,
  1 pachislo. Temple of Gold's existing Aztec voice is untouched.
- The two PARKED cabinets (Flameout 21, Stop & Lock 777) stay silent — off the
  floor, bespoke flows, YAGNI.
- Sound defaults ON ("the racket is the point" — audio.ts). Clean losses are
  SILENT, like real machines.
- No new assets, no files: pure Web Audio synthesis, CSP-clean, SSR-safe,
  exactly like Temple today.

## Architecture

One new module, three wiring points, zero per-cabinet duplication.

### `app/utils/audio.ts` (edit: export the primitives)
Keeps AudioContext/mute/unlock and Temple's sfx* untouched. The private
`tone`, `noiseBurst`, `bell`, and `reducedMotion` helpers become exports so the
sound bank composes them. No behavior change.

### `app/utils/soundBank.ts` (new)
Per-family voices behind one interface:

```ts
export interface CabinetVoice {
  spinStart(): void
  reelStop(reel: number, reelCount: number): void
  reveal(def: MachineDef, out: SpinOutcome): void
}
export function voiceFor(family: MachineDef['family']): CabinetVoice
```

`cascade`, `blackjack-reel`, `lock-reel` → a shared SILENT voice (no-ops).
Every function is a safe no-op when muted/locked/SSR (the `live()` guard
pattern) — never throws.

### Wiring point 1 — `useReelSpin` (covers video + stepper + bally)
- spin watcher (post reduced-motion check) → `voice.spinStart()`
- each per-reel reveal timer → `voice.reelStop(r, reelCount)`
- last reel's timer (after `revealDone()`/`settle()`) →
  `voice.reveal(def, store.lastOutcome)`
- reduced-motion branch: no per-reel ticks — one settle click + `reveal`
  (fanfares already shorten via audio.ts's reducedMotion()).
- unmount clears timers → no reveal after navigating away (existing behavior).

### Wiring point 2 — `usePachisloPress` (covers pachislo)
- `arm()` → `unlockAudio()` (it IS the gesture) + spin-up sound
- `press(reel)` → arcade stop-beep (rising pitch per press)
- `resolveWith()` → after `store.spinOnce(presses)` returns,
  `voice.reveal(def, store.lastOutcome)`
- reduced-motion `arm()` resolves instantly → reveal only, no press beeps.

### Wiring point 3 — gesture unlocks
`unlockAudio()` from the real user gestures: `BetControls.spin()`, `game.vue`'s
keydown handler, pachislo `arm()`. (Temple already unlocks itself.)

### Mute UI
New `app/components/AppSoundToggle.vue` in the TOP nav of
`layouts/default.vue`: speaker icon button, `aria-pressed`, binds the existing
persisted reactive `muted` state (`isMuted`/`setMuted`). Temple's in-cabinet
toggle keeps working; both stay in sync for free (same module ref).

## Reveal logic (payout-scaled, one big moment per reveal)

Priority: progressive jackpot > hold-and-spin GRAND > bonus-started > win tier.
Light stingers may layer on top (orb-lock clink); never stack two fanfares.

```
tier by ratio = totalPayout / max(1, coinsIn):
  none   (payout 0)  → silence
  small  (ratio < 1) → the LDW party: genuine chimes, fewer of them
  medium (ratio < 4)
  big    (ratio < 15)
  huge   (ratio ≥ 15) → near-jackpot fanfare
```

Feature stingers: free-spins-triggered/retriggered (flourish), orbs-locked /
mult-orbs-locked (glassy clink), hold-and-spin-ended (filled → GRAND fanfare,
else medium), bonus-started (pachislo fever jingle), bonus-ended (short
resolve), replay-granted (two quick beeps).
**flag-stocked is deliberately SILENT** — real stock-era machines hide the
stock; the X-ray reveals it visually. Authentic secrecy is the lesson.

## The four voices (registers/waveforms chosen to NOT blur together)

| Event | Stepper (low, mechanical) | Bally EM (mid, electromechanical) | Video (high, digital) | Pachislo (square, arcade) |
|---|---|---|---|---|
| spinStart | lever clunk + saw whirr 110/165Hz | motor spin-up 55Hz + relay click | soft sine whoosh 300→900Hz | coin-in chunk + rising blip |
| reelStop | heavy lowpass thunk, pitch drops per reel (65/60/55Hz) | heavier clunk + relay tick | bright tick, pitch RISES per reel (2600+150r Hz) | square beep rising per press (880/990/1175) |
| win small | 4 coin-tray clinks + low bell 660 | ONE true bell ding (1318) + 2 coin clunks | 3-note arpeggio 523/659/784 | 3-note 8-bit ditty |
| win medium | 8 clinks + bell | 2 dings + 4 clunks | 4-note arpeggio + 1046 | 5-note ditty |
| win big | 14-clink tray rattle + bells 660/880 | 3 dings + 8 clunks | 6-note run + shimmer | longer ditty |
| win huge / jackpot | extended tray + repeated jackpot bell 880×4 | bell peal ×6 accelerando + clatter | full double ascending run + sparkle | fever jingle (fast square arpeggio) |

Volume discipline: every gain within audio.ts's established 0.04–0.3 range.
No master-volume slider (mute exists; YAGNI).

## Testing

- `soundBank`: `voiceFor` returns a distinct voice for the four sounding
  families and the silent voice otherwise; every method is callable headless
  (no ctx) without throwing; reveal picks the right tier/fanfare per synthetic
  outcome (spy on exported primitives).
- `useReelSpin` wiring: fake timers + mocked bank — spinStart once, reelStop ×
  reelCount in order, reveal once at the end; reduced-motion path emits no
  reelStops; unmount mid-spin emits no reveal.
- `usePachisloPress` wiring: arm → spin-up + unlock, press ×3 beeps,
  resolve → reveal; reduced-motion arm → reveal only.
- `AppSoundToggle`: renders in nav, `aria-pressed` mirrors state, click
  persists via localStorage (existing MUTE_KEY).
- Gates: pnpm check (incl. 5M verify) + live browser listen-through of all four
  families, the mute toggle, and Temple regression.

## Rejected alternatives

- **Store-level dispatch** — wrong timing: the engine resolves ~2s before the
  reels visually stop; sounds must follow the animation layer.
- **Per-cabinet instrumentation** (Temple's pattern everywhere) — 4-5 copies of
  identical lifecycle wiring; the duplication disease this codebase just cured.
