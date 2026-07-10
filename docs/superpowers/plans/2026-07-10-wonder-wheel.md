# Wonder Wheel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `wonder-wheel` per `docs/superpowers/specs/2026-07-10-wonder-wheel-design.md`: the 8th engine family (`wheel`), the 11th floor machine, and the curated Featured slot.

**Architecture:** The wheel is a pending FREE game consumed through the ordinary `spin()` path (video-free-spins pattern) — the engine stays non-interactive; all drama is presentation. Exact math = 72³ stepper enumeration + a disjoint max-coins wheel term. Featured becomes `FEATURED_ID` + a per-machine copy record.

**Tech Stack:** Nuxt 4 / Vue 3 (package.json: nuxt ^4.4.2), vitest 4 + happy-dom, tsx calibration script, pnpm.

## Global Constraints

House standard (as prior plans): style/lint rules, per-task lint + targeted vitest with real exit codes, full `pnpm check` once at the end, no dev/generate during check, engine purity (no framework imports in `app/engine/`), conventional commits without AI trailers, WCAG ≤3 flashes/sec, `prefers-reduced-motion` honored, production CSP (no external assets), commits stay LOCAL on branch `wonder-wheel` until the owner says push (in-hours stamps get the standard rewrite then).

## Pinned contracts (cross-task names)

```ts
// types.ts
export type MachineFamily = '…' | 'wheel'
export interface WheelWedge { credits: number, weight: number }
export interface WheelMachineDef extends MachineDefBase {
  family: 'wheel'
  physicalStrips: SymbolId[][]        // 3 reels × 22 stops
  virtualMaps: number[][]             // 3 × 72 (Telnaes)
  paytable: StepperPayEntry[]         // reuse stepper entry kinds
  wheelSymbol: SymbolId               // 'WH', reel 3 only
  wedges: WheelWedge[]                // exactly 24
}
export interface WheelSessionState { pending: boolean }
// MachineSessionState gains: wheel: WheelSessionState | null
// FeatureEvent gains: { type: 'wheel-armed' } | { type: 'wheel-wasted' }
//                   | { type: 'wheel-landed', wedgeIndex: number, credits: number }

// engine/wheelGame.ts
export function spinWheel(def: WheelMachineDef, state: MachineSessionState, coins: number, rand: RandomFn): SpinOutcome
export function drawWedgeIndex(def: WheelMachineDef, rand: RandomFn): number  // exported for UI honesty tests

// engine/wheelRtp.ts
export function wheelExactRtp(def: WheelMachineDef, opts: ExactRtpOptions): ExactRtpReport
// breakdown: line entries + `wedge-${credits}` rows; wheel entries only at coins === maxCoins

// machines/index.ts
export const FEATURED_ID = 'wonder-wheel'
// machines/wonder-wheel.ts: export const WONDER_WHEEL: WheelMachineDef

// components/floor/featuredCopy.ts
export interface FeaturedCopy { tagline: string, bullets: { icon: string, text: string }[], badge: string, footer: string }
export const FEATURED_COPY: Record<string, FeaturedCopy>
```

Wedge entryIds are `wedge-${credits}`; the arm event carries no win; the
resolve spin's single win entry is `{ line: 'wheel', entryId: 'wedge-<c>' }`.

---

### Task 1: Types + engine + exact math + calibrated def (TDD, frozen numbers)

**Files:** Modify `app/engine/types.ts`, `app/engine/exactRtp.ts` (static wheel branch), `app/engine/index.ts` (spin routing, nextSpinCost, initMachineState), `app/engine/validate.ts`; create `app/engine/wheelGame.ts`, `app/engine/wheelRtp.ts`, `app/machines/wonder-wheel.ts`, calibration script in scratchpad; tests `tests/wheelGame.test.ts`, `tests/wheelRtp.test.ts`, `tests/machines-wheel.test.ts`.

- [ ] Types per pinned contracts (+ `wheel: null` in every `MachineSessionState` literal: `initMachineState`, `ldwExperiment`, `mythsExperiment`, restore fresh-state, any test literals).
- [ ] `wheelGame.ts`: pending → wedge resolve (labeled draw `wheel wedge` over summed weights, payout = credits, `coinsIn 0`, `gameKind 'bonus'`); else base spin = 3 virtual-stop draws (labeled like stepper), `bestStepperAward` line evaluation, WHEEL-on-reel-3 events per coins-vs-maxCoins. Reuse `awards.ts` so play and math share the evaluator.
- [ ] `wheelRtp.ts`: enumerate 72³ weight products for line pays per coin (mirror the stepper path in `exactRtp.ts`); wheel term when `coins === maxCoins`: `pWheel = weight(WH on reel3)/72`; per-coin contribution `pWheel × E[wedge]/coins`; exact variance including the disjointness of WHEEL tuples vs line wins; hitFrequency counts paying tuples (+ wheel arms as feature-hits, matching how video counts feature triggers — mirror `videoRtp`'s convention); breakdown rows as pinned.
- [ ] `exactRtp.ts`: `if (def.family === 'wheel') return wheelExactRtp(def, opts)` (floor family — static import).
- [ ] Barrel: `spin()` routes `'wheel'` → `spinWheel`; `nextSpinCost` → `state.wheel?.pending ? 0 : coins`; `initMachineState` → `wheel: def.family === 'wheel' ? { pending: false } : null`.
- [ ] `validate.ts`: WH on reel 3 only, exactly 24 wedges, positive integer weights/credits, `topAwardEntryId` resolves in breakdown.
- [ ] **Calibrate** with a tsx scratch script iterating strips/wedge weights until: max-coins RTP ∈ [92.3%, 92.6%] with wheel share ∈ [19%, 21%]; 1-coin RTP ∈ [71%, 74%]; HF(line) ≈ 14–16%; P(arm) ≈ 1/70–1/75; MEGA odds ≈ 1-in-50k–90k spins (pWheel × its wedge weight share). Freeze the landed numbers in `tests/wheelRtp.test.ts` (6-decimal RTP, HF, variance, per-coin ladder, wedge-share sum) and in the def's doc comment.
- [ ] Sim-vs-exact: seeded `simulateMachine` (needs Task 2's drain — write the test now, it passes after Task 2; or drain in this task) 500k cycles within 3.5σ.
- [ ] Gate: targeted vitest + lint. Commit.

### Task 2: Store/infra integration

**Files:** `app/engine/restore.ts` (sanitize `{ pending: boolean }`), `app/engine/simulate.ts` + `app/engine/sessions.ts` (drain loops add `state.wheel?.pending`), `app/machines/index.ts` (FLOOR gains WONDER_WHEEL after Stock Rush + `FEATURED_ID`), `app/stores/slots.ts` (`setBet` guarded while pending — mirror the mid-feature guard), `scripts/verify-floor.ts` (11 rows; wheel arms are feature-hits not jackpots).

- [ ] Update, then gates: `tests/store.test.ts` additions (restore a pending wheel; bet locked while pending), `tests/machines.test.ts` count 11, `tests/cost.test.ts` wheel family row, sim-vs-exact test from Task 1 green. `pnpm verify -- --spins 250000` prints 11 PASS rows. Commit.

### Task 3: UI — surface, overlay, chrome, icons, featured, floor

**Files:** create `app/components/game/ReelWheelGame.vue`, `app/components/game/WheelOverlay.vue`, `app/components/game/chrome/WonderWheelChrome.vue` (+ registry line), `app/components/floor/featuredCopy.ts`; modify `app/components/game/symbols/registry.ts` (7 icons), `app/pages/game.vue` (family branch), `app/components/floor/FeaturedMachine.vue` (data-driven), `app/pages/index.vue` (grid groups incl. Cascade/Wheel for the resting headliner, header copy), `app/utils/learnLink.ts` (wheel → telnaes-reels).

- [ ] Surface: marquee mini-wheel (aria-hidden ambient), 3 GameReelColumn reels + payline glass + fit-scale (ReelStepper pattern), bet controls, STOP-less — SPIN + the pending-state handoff to the overlay.
- [ ] WheelOverlay: props `{ def, wedgeIndex: number | null, spinning: boolean }`; 24 equal SVG wedges (6-hue neon gradient cycle), gold rim, 24 chasing bulbs (CSS `steps()`, disabled under reduced-motion), flapper, center crest; "SPIN THE WHEEL" button → emits `spin` (page calls the ordinary store spin); rotation = 5 turns + drawn-wedge angle over 4.2s; landing glow pulse ≤3Hz; reduced-motion snaps. The DRAWN index comes from the outcome's `wheel-landed` event — the animation must land on it (test asserts the transform target angle matches the event index).
- [ ] FeaturedMachine: render from `FEATURED_ID` def + `FEATURED_COPY` (Temple entry preserved; Wonder Wheel entry sells the wheel + honest footer). Grid = FLOOR minus featured, grouped by family with labels (+Cascade, +Wheel).
- [ ] Tests: `tests/components/wheelSurface.test.ts` (armed → overlay, button fires spin, honest landing angle, wasted line shown), `tests/components/floorFeatured.test.ts` (featured = wonder-wheel; Temple back in grid under a Cascade group), iconCoverage green. Commit.

### Task 4: Sound + X-ray/PAR + text surfaces

**Files:** `app/utils/soundBank.ts` (+`wheel` voice + `voiceFor`), the wheel ticker hook in WheelOverlay (decelerating click schedule), `app/components/game/XrayPanel.vue` (wedge weight table: visual 4.17% vs true %, armed/wasted stat), `app/components/game/ParSheetModal.vue` (wedge math + 1/2/3-coin RTP ladder), `app/utils/outcomeText.ts` (armed/landed/wasted lines), `app/utils/entryLabel.ts` (`wedge-N` → "Wheel: N credits", family map).

- [ ] Tests: `soundBank.test.ts` voice mapping + no-gain-over cap, `parSheet.test.ts` + `xray` additions (ladder shows the under-max cliff; wedge rows sum), `outcomeText`/`entryLabel` cases. Commit.

### Task 5: Copy/branding + full gates + live smoke

- [ ] Sweep Ten→Eleven: `app/pages/index.vue` header ("Eleven machines — ten you bet, one you can't lose"), `nuxt.config.ts` description/og/twitter, README (status, floor table row: `Wonder Wheel | Wheel (1996 lineage) | 3 reels Telnaes, WHEEL→24-wedge weighted topper at max coins | <frozen>% @ max`, playing-it Featured note, og alt), CHANGELOG `[Unreleased]`.
- [ ] og-image: check how `public/og-image.png` is produced (memory: regenerated per machine-count change); update source + regenerate if scripted, else annotate README task for owner.
- [ ] Full `pnpm check` (626+ tests, verify 11/11) → `pnpm generate` → `pnpm run smoke:csp` → live browser smoke: arm the wheel with a seeded/live session (force by dev seed or spin loop), record the overlay spin, screenshot the cabinet + wheel for the owner; a11y pass on the new page surfaces (contrast + reduced-motion). ff-merge `wonder-wheel` → main locally. Report with screenshots; NO push (owner asks).
