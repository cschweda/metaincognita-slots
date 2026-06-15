# Hit or Bust (blackjack-reel) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 10th machine — **Hit or Bust**, a press-your-luck blackjack-reel — as a new `blackjack-reel` family: deal 2 cards, Hit/Stand across up to 5 reels, scaling paytable by hand value, additive multiplier cards, Five-Card Charlie bonus, forgive-and-continue Bust-Save, exact RTP under optimal stopping, plus bespoke chrome.

**Architecture:** A new discriminated-union family threaded through the four compiler-enforced `never` switches plus the conditional family guards. Pure engine modules do the work: `blackjackReel.ts` (hand evaluation + interactive deal/hit/stand step functions that mutate `MachineSessionState.blackjackReel`) and `blackjackReelRtp.ts` (backward-induction DP that computes both the optimal hit/stand policy and the exact RTP). The store gets deal/hit/stand actions (mirroring how pachislo drives multi-step play); a `ReelBlackjackReel.vue` surface + `BlackjackControls.vue` + `useBlackjackReel()` composable provide the UI. The machine is calibrated to ~90% RTP *using the DP enumerator itself*, then the computed figures are frozen into tests.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>` + TS, Pinia, Vitest + @vue/test-utils + happy-dom, the v0.7.0 chrome system.

**Spec:** `docs/superpowers/specs/2026-06-14-hit-or-bust-design.md`

---

## Conventions (every task)

- **Per-task gates:** `pnpm lint` && `pnpm typecheck` && `pnpm test` (currently 363 tests; 0 lint errors; pre-existing warnings OK).
- **Browser smoke** before any UI task (Phase 2+) is "done": play a hand end-to-end (deal, hit, stand, bust, Charlie, multiplier, save), chrome renders, console clean. **viewcap** screenshots.
- The four **compiler-enforced `never` switches** (`spin()` `app/engine/index.ts:69-82`, `nextSpinCost()` `index.ts:42-60`, `validateMachineDef()` `app/engine/validate.ts:254-257`, `nearMisses()` `app/engine/nearMiss.ts:167-169`) plus the `exactRtp()` switch (`app/engine/exactRtp.ts`) **will not compile** until the new family is handled at each — Task 1 handles all of them.
- TDD; pure-engine tests at `tests/*.test.ts`, component tests at `tests/components/*.test.ts` (`// @vitest-environment happy-dom`).
- Never touch blackjack (the standalone project). Push only when asked. Commit timestamps off-hours (Sunday — fine). No `Co-Authored-By` trailer.

## File Structure

**Create**
- `app/engine/blackjackReel.ts` — card-value/hand evaluation + interactive step functions (`dealHand`, `hitCard`, `standHand`).
- `app/engine/blackjackReelRtp.ts` — the optimal-stopping DP: optimal policy + exact RTP.
- `app/machines/hit-or-bust.ts` — the `BlackjackReelMachineDef` (calibrated ~90%).
- `app/components/game/ReelBlackjackReel.vue` — the card-reel surface.
- `app/components/game/BlackjackControls.vue` — Deal / Hit / Stand controls.
- `app/composables/useBlackjackReel.ts` — UI→store wiring for the hand flow.
- `app/components/game/chrome/BlackjackReelChrome.vue` — bespoke card-room chrome.
- `tests/blackjackReel.test.ts`, `tests/blackjackReelRtp.test.ts`, `tests/components/blackjackControls.test.ts`.

**Modify**
- `app/engine/types.ts` — `MachineFamily`, `BlackjackReelMachineDef`, `MachineDef` union, `BlackjackReelSessionState`, `MachineSessionState`.
- `app/engine/index.ts` — `spin()`, `nextSpinCost()`, `initMachineState()` family handling.
- `app/engine/validate.ts`, `app/engine/nearMiss.ts`, `app/engine/exactRtp.ts` — family cases.
- `app/stores/slots.ts` — deal/hit/stand actions + `sanitizeMachineState` branch.
- `app/pages/game.vue` — reel-surface switch (inside `<GameMachineChrome>`) + space-key handling.
- `app/pages/index.vue` — `FAMILY_ORDER` + `FAMILY_HEADING`.
- `app/machines/index.ts` — add to `FLOOR`.
- `app/components/game/chrome/theme.ts`, `registry.ts` — palette + module.
- `app/components/floor/MachineCard.vue` — `FAMILY_LABEL` entry.
- `tests/machines-pachislo.test.ts` — the family-order assertion (line ~26).
- `README.md`, `CHANGELOG.md`, `package.json` (0.8.0).

---

## Phase 0 — Engine

### Task 1: Family skeleton (types + the enforced switches compile)

**Files:** Modify `app/engine/types.ts`, `app/engine/index.ts`, `app/engine/validate.ts`, `app/engine/nearMiss.ts`, `app/engine/exactRtp.ts`. Test: `tests/blackjackReel.test.ts` (new, minimal).

Goal: the new family *exists* and the project compiles, with engine entry points stubbed to throw "not implemented" (filled in later tasks). This isolates the type-threading from the logic.

- [ ] **Step 1: Write a failing test** that imports the new types/def shape:

```ts
// tests/blackjackReel.test.ts
import { describe, expect, it } from 'vitest'
import type { BlackjackReelMachineDef, BlackjackReelSessionState } from '../app/engine/types'

describe('blackjack-reel types', () => {
  it('compiles a minimal def shape', () => {
    const def: Pick<BlackjackReelMachineDef, 'family'> = { family: 'blackjack-reel' }
    expect(def.family).toBe('blackjack-reel')
  })
})
```

- [ ] **Step 2: Run → fails** (`pnpm test blackjackReel` → type/import error).

- [ ] **Step 3: Add types** to `app/engine/types.ts`:
  - Extend `MachineFamily`: `'stepper' | 'bally-em' | 'video' | 'pachislo' | 'blackjack-reel'`.
  - Add the def interface and session state:

```ts
export interface BlackjackReelMachineDef extends MachineDefBase {
  family: 'blackjack-reel'
  /** 5 weighted reel strips of card/special SymbolIds (slot-style, with replacement) */
  strips: SymbolId[][]
  /** card SymbolId -> blackjack value (2..10; faces 10). Aces handled via aceSymbol. */
  cardValues: Record<SymbolId, number>
  aceSymbol: SymbolId
  /** special multiplier-card SymbolId -> additive face (e.g. {MX2:2, MX3:3}) */
  multiplierSymbols: Record<SymbolId, number>
  /** rare bust-save SymbolId (null = none) */
  bustSaveSymbol: SymbolId | null
  /** per-coin payout by final non-bust hand total */
  paytable: { total: number, pay: number }[]
  /** bonus per coin added when all five cards survive (Five-Card Charlie) */
  charlieBonus: number
  progressive: null
}

export interface BlackjackReelSessionState {
  phase: 'idle' | 'dealt' | 'resolved'
  cards: SymbolId[]      // revealed symbols (cards + specials), in draw order
  total: number          // best hand total <= 21 (or the busting min if busted)
  isSoft: boolean        // an ace is currently counted as 11
  multSum: number        // additive multiplier sum (0 => pays x1)
  saveHeld: boolean      // a bust-save is available
  busted: boolean
  charlie: boolean       // survived all five
  ante: number           // coins wagered for this hand (locks the payout scale)
}
```
  - Add `| BlackjackReelMachineDef` to the `MachineDef` union.
  - Add `blackjackReel: BlackjackReelSessionState | null` to `MachineSessionState`.

- [ ] **Step 4: Handle the family at every enforced switch** (stub the logic):
  - `app/engine/index.ts` `initMachineState()`: add `blackjackReel: def.family === 'blackjack-reel' ? freshBlackjackState(def) : null` (define `freshBlackjackState` returning `{ phase:'idle', cards:[], total:0, isSoft:false, multSum:0, saveHeld:false, busted:false, charlie:false, ante:0 }`).
  - `nextSpinCost()`: `case 'blackjack-reel': return coins` (the ante; a hand costs one bet — hits are free but go through dedicated actions, not `spin()`).
  - `spin()`: `case 'blackjack-reel': throw new Error('blackjack-reel uses dealHand/hitCard/standHand, not spin()')` (it's interactive; the store calls the step functions directly — see Task 3).
  - `validateMachineDef()`: add `case 'blackjack-reel':` with minimal validation now (strips length === 5, paytable non-empty, every strip symbol present in `cardValues`/`multiplierSymbols`/`bustSaveSymbol`); expand in Task 6.
  - `nearMisses()`: `case 'blackjack-reel': return []` (no near-miss analysis for this family).
  - `exactRtp()`: `if (def.family === 'blackjack-reel') return blackjackReelExactRtp(def, opts)` — stub `blackjackReelExactRtp` in Task 5; for now `throw new Error('not implemented')` imported lazily, OR temporarily return a zero report and finish it in Task 5. (Pick: throw; Task 5 implements.)

- [ ] **Step 5: Run → passes** (`pnpm test blackjackReel`), then full gates `pnpm lint && pnpm typecheck && pnpm test` (typecheck proves all `never` switches are satisfied).

- [ ] **Step 6: Commit** `feat(engine): blackjack-reel family skeleton + type threading`.

### Task 2: Hand evaluation

**Files:** `app/engine/blackjackReel.ts`. Test: `tests/blackjackReel.test.ts`.

- [ ] **Step 1: Write failing tests** for evaluation:

```ts
import { evaluateHand } from '../app/engine/blackjackReel'
import { HIT_OR_BUST } from '../app/machines/hit-or-bust' // exists by Task 6; until then use a local fixture def

// Use a local minimal fixture for this task (avoid depending on Task 6):
const fix = {
  cardValues: { C2:2, C7:7, CK:10, CA:11 /* aceSymbol */ },
  aceSymbol: 'CA', multiplierSymbols: { MX2:2, MX3:3 }, bustSaveSymbol: 'SAVE'
} as any

it('sums hard cards', () => {
  expect(evaluateHand(fix, ['C7','CK']).total).toBe(17)
  expect(evaluateHand(fix, ['C7','CK']).isSoft).toBe(false)
})
it('counts an ace as 11 when it fits (soft), 1 when it would bust', () => {
  expect(evaluateHand(fix, ['CA','C7'])).toMatchObject({ total: 18, isSoft: true })
  expect(evaluateHand(fix, ['CA','C7','CK'])).toMatchObject({ total: 18, isSoft: false }) // ace drops to 1
})
it('ignores specials in the total but reports them', () => {
  const r = evaluateHand(fix, ['CK','MX2','C7','SAVE'])
  expect(r.total).toBe(17)
  expect(r.multSum).toBe(2)
  expect(r.saveSeen).toBe(true)
})
it('flags bust over 21', () => {
  expect(evaluateHand(fix, ['CK','CK','C2']).busted).toBe(true)
})
```

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** `evaluateHand` in `app/engine/blackjackReel.ts`:

```ts
import type { BlackjackReelMachineDef, SymbolId } from './types'

export interface HandEval {
  total: number        // best total <= 21, or the minimum total if busted
  isSoft: boolean
  busted: boolean
  multSum: number
  saveSeen: boolean
}

type EvalCfg = Pick<BlackjackReelMachineDef, 'cardValues' | 'aceSymbol' | 'multiplierSymbols' | 'bustSaveSymbol'>

export function evaluateHand(def: EvalCfg, cards: readonly SymbolId[]): HandEval {
  let hard = 0
  let aces = 0
  let multSum = 0
  let saveSeen = false
  for (const c of cards) {
    if (c === def.aceSymbol) { aces++; hard += 1; continue }
    if (c in def.multiplierSymbols) { multSum += def.multiplierSymbols[c]!; continue }
    if (def.bustSaveSymbol !== null && c === def.bustSaveSymbol) { saveSeen = true; continue }
    hard += def.cardValues[c] ?? 0
  }
  // promote one ace to 11 if it fits
  let total = hard
  let isSoft = false
  if (aces > 0 && hard + 10 <= 21) { total = hard + 10; isSoft = true }
  return { total, isSoft, busted: total > 21, multSum, saveSeen }
}
```

- [ ] **Step 4: Run → passes.** Gates. **Commit** `feat(engine): blackjack-reel hand evaluation (soft aces, specials)`.

### Task 3: Interactive step functions (deal / hit / stand)

**Files:** `app/engine/blackjackReel.ts`. Test: `tests/blackjackReel.test.ts`.

These mutate `state.blackjackReel` and return a `SpinOutcome` (so they slot into the store's history/stats machinery). Use a seeded `RandomFn` to pick a strip index per draw: `idx = Math.floor(rand() * strip.length)`.

- [ ] **Step 1: Write failing tests** (deal sets 2 cards + phase 'dealt'; hit adds a card; bust with no save resolves to 0; bust with save voids the card + continues; reaching 5 cards = charlie auto-resolve; stand pays `paytable(total) × max(1,multSum) × ante`). Use a deterministic `rand` (e.g. `mulberry32(seed)`) and a fixture def with known strips so outcomes are assertable. (Mirror `tests/pachislo.test.ts` for the deterministic-rand pattern.)

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** `dealHand`, `hitCard`, `standHand` in `app/engine/blackjackReel.ts`. Core logic:
  - `dealHand(def, state, coins, rand)`: reset `state.blackjackReel` to fresh, set `ante = coins`, draw cards from strips[0] and strips[1], push to `cards`, recompute `(total,isSoft,multSum,saveHeld)` via `evaluateHand`, `phase='dealt'`. Return a `SpinOutcome` with `coinsIn = coins`, `gameKind:'base'`, `grid` = the dealt cards as a single row, `totalPayout: 0`, a `featureEvent` `{type:'cards-dealt'}`.
  - `hitCard(def, state, rand)`: require `phase==='dealt'`; draw from `strips[cards.length]`; push; re-evaluate. If now busted: if `saveHeld` → consume save (pop the busting card OR mark voided; re-evaluate without it), keep `phase='dealt'`; else `busted=true`, `phase='resolved'`, payout 0. Else if `cards.length === 5` → `charlie=true`, auto-resolve (payout as in `standHand` + `charlieBonus`). Return a `SpinOutcome` with `coinsIn:0`, `grid` updated, `featureEvent` (`'hit'`/`'bust'`/`'bust-saved'`/`'charlie'`), and `totalPayout` only on resolve.
  - `standHand(def, state)`: require `phase==='dealt'`; resolve. Define a shared `resolvePayout(def, state)` = `payEntry(def.paytable, state.total) × Math.max(1, state.multSum) × state.ante + (state.charlie ? def.charlieBonus × Math.max(1,state.multSum) × state.ante : 0)` where `payEntry` looks up the paytable for `state.total` (0 if not listed). Set `phase='resolved'`, return the `SpinOutcome` with that `totalPayout`, `coinsIn:0`, a `feature` event `'stand'`.
  - Helper `payEntry(paytable, total): number`.
  - Decide the special-card-during-bust rule explicitly: a multiplier/save symbol contributes 0 to the total, so it can never *cause* a bust; only value cards can. (Document this in a comment.)

- [ ] **Step 4: Run → passes.** Gates. **Commit** `feat(engine): blackjack-reel deal/hit/stand step functions`.

### Task 4: Optimal-stopping DP — strategy + value

**Files:** `app/engine/blackjackReelRtp.ts`. Test: `tests/blackjackReelRtp.test.ts`.

- [ ] **Step 1: Write failing tests** on tiny hand-tuned defs where the optimal action is obvious (e.g. a def where standing on a high total clearly beats hitting into a near-certain bust → `optimalAction` returns `'stand'`; and the reverse where a guaranteed-safe card with a multiplier makes `'hit'` optimal), plus a determinism check (same def → same policy/value).

- [ ] **Step 2: Run → fails.**

- [ ] **Step 3: Implement** the DP. The reel `r` (0-based) for the *next* card is `cards.length` (reel index = number of cards already drawn; valid for draws 3,4,5 i.e. reels 2,3,4). Per-symbol probability on reel `r`: `count(symbol in strips[r]) / strips[r].length`.

```ts
// state key: (cardsDrawn, total, isSoft, multSum, saveHeld). Memoize.
// value(state) = best EV per coin (ante=1) from this decision onward.
//   stand: payEntry(total) * max(1, multSum)
//   hit (only if cardsDrawn < 5): sum over symbols s on reel[cardsDrawn] of
//        p(s) * valueAfterDraw(state, s)
//   value = cardsDrawn < 5 ? max(stand, hit) : standWithCharlie
// valueAfterDraw applies s: value card -> new total (ace logic); multiplier -> multSum += face;
//   save -> saveHeld = true; then if busted and saveHeld -> consume save, treat as no-op draw
//   (EV of the post-save state, still cardsDrawn+1); if busted and !save -> 0.
// At cardsDrawn==5 reached without bust: charlie -> (payEntry(total) + charlieBonus) * max(1,multSum).
export function optimalAction(def, partialState): 'hit' | 'stand'
export function blackjackReelExactRtp(def, opts): ExactRtpReport
```
  `blackjackReelExactRtp` computes the whole-game EV by averaging `valueAfterDraw` over the first two deals (reels 0 and 1), so `rtpPerCoin = EV(initial) / 1`. Also compute `hitFrequency` (probability the resolved payout > 0 under the optimal policy) and `variancePerCoin` (enumerate the outcome distribution under optimal play). Reuse `evaluateHand` semantics for the ace/special logic so the DP and the live engine agree exactly.

- [ ] **Step 4: Run → passes.** Gates. **Commit** `feat(engine): blackjack-reel optimal-stopping DP (strategy + exact RTP)`.

### Task 5: Wire exactRtp + simulate; convergence cross-check

**Files:** Modify `app/engine/exactRtp.ts` (call `blackjackReelExactRtp`), `app/engine/index.ts` (`simulateMachine` plays the optimal policy for this family via `optimalAction` + the step functions). Test: `tests/blackjackReelRtp.test.ts`.

- [ ] **Step 1: Write a failing convergence test:** for a fixture def, `simulateMachine` (playing the optimal policy) over N hands yields an empirical RTP within ~3.5σ of `blackjackReelExactRtp(def).rtpPerCoin`. (Mirror `tests/convergence.test.ts`.)
- [ ] **Step 2–4:** Implement the `exactRtp` dispatch (replace Task 1's stub) and extend `simulateMachine` to drive deal→(optimalAction loop)→resolve for `blackjack-reel`. Run → passes. Gates. **Commit** `feat(engine): blackjack-reel exact RTP wired + simulate convergence`.

---

## Phase 1 — Machine definition + calibration

### Task 6: `hit-or-bust.ts` def, calibrated to ~90%

**Files:** `app/machines/hit-or-bust.ts`. Test: `tests/machines.test.ts` (add a block) or a new `tests/machines-blackjack.test.ts`.

The RTP tool for this family is the Task 4 DP — so calibration is done *with it* during this task (there is no pre-computed magic number to paste; the value is derived here and then frozen).

- [ ] **Step 1: Author a first-draft def** — symbols for cards `C2..C10, CJ, CQ, CK, CA`, multiplier cards `MX2, MX3`, bust-save `SAVE`; `cardValues`; five weighted `strips` (start near a real shoe distribution then bias for tuning); a scaling `paytable` (e.g. totals 12→0.x climbing to 21→top); `charlieBonus`; `maxCoins`. Wire into `app/machines/index.ts` `FLOOR` and the `MachineFamily`-keyed display maps (Task 9 covers floor display, but add the import now).
- [ ] **Step 2: Calibrate** — run `node`/`tsx` with `blackjackReelExactRtp(HIT_OR_BUST)` (or a temporary `tests/` probe) and adjust the strip weights + paytable until **`rtpPerCoin ∈ [0.89, 0.91]`** with a sensible bust frequency and Five-Card Charlie rate. (Document the chosen target in a comment, mirroring the other machines' frozen-value provenance comments.)
- [ ] **Step 3: Freeze** the resulting `rtpPerCoin`, hit frequency, bust rate, and Charlie rate into a test as exact-value invariants (so regressions are caught), and assert the def passes `validateMachineDef`. Add convergence to `pnpm verify` if that CLI enumerates the floor (check `scripts/verify-floor.ts`; extend it for the new family).
- [ ] **Step 4:** Gates (incl. the new frozen-value test). **Commit** `feat(machines): Hit or Bust def calibrated to ~90% RTP`.

---

## Phase 2 — Store + UI + floor

### Task 7: Store actions (deal/hit/stand) + persistence

**Files:** Modify `app/stores/slots.ts`. (Tests: covered via component tests in Task 8 + the store's existing test patterns; add store-level tests if practical.)

- [ ] Add actions mirroring `spinOnce`'s bookkeeping (cost, history push, stats, `saveToLocalStorage`, `spinning` gate) but for the multi-step flow: `dealHand()` (charges the ante via `nextSpinCost`/bet, calls `dealHand(def, state, coins, liveRand)`), `hitCard()` (free; calls `hitCard(...)`; on resolve, books the payout), `standHand()` (calls `standHand(...)`, books payout). Reuse the existing record/stats/credit helpers. Add a `case 'blackjack-reel'` to `sanitizeMachineState()` that validates+restores `blackjackReel` state (phase enum, cards array of known symbols, numeric fields clamped, booleans) or returns a fresh idle state if corrupt (mirror the pachislo restorer's rigor). Guard `setCurrentBet`/`spinOnce` family checks as needed (deal uses its own action, not `spinOnce`).

- [ ] Gates. **Commit** `feat(store): Hit or Bust deal/hit/stand actions + state restore`.

### Task 8: Reel surface + controls + composable

**Files:** `app/components/game/ReelBlackjackReel.vue`, `app/components/game/BlackjackControls.vue`, `app/composables/useBlackjackReel.ts`; modify `app/pages/game.vue`. Test: `tests/components/blackjackControls.test.ts`.

- [ ] `useBlackjackReel()` (model on `usePachisloPress`): exposes `phase`, `canDeal`, `canHit`, `canStand`, and `deal()/hit()/stand()` that call the store actions + `revealDone()`. `ReelBlackjackReel.vue` renders the up-to-5 cards as a row (reuse `GameSymbolIcon` for card faces; add card SVGs to the symbol registry if missing — check `app/components/game/symbols/registry.ts`), the live hand total (soft/hard, e.g. "7 / 17"), the running multiplier, a Bust-Save indicator, and a Five-Card Charlie flourish. `BlackjackControls.vue`: **Deal** (ante; disabled mid-hand), **Hit**, **Stand** (disabled unless `phase==='dealt'`); sensible keys (Space = Hit while in a hand, distinct from other families' handlers — update `game.vue:9-16` so Space hits during a blackjack-reel hand). Wire the reel surface into `game.vue`'s family `v-if` chain (inside `<GameMachineChrome>`), and add the controls (mirroring how pachislo controls slot into `BetControls`'s `#pachislo-controls` slot — add a `#blackjack-controls` slot or a parallel conditional).
- [ ] Component test: deal → hit → stand/bust/Charlie drives the right store calls and renders the hand total + buttons' enabled/disabled states.
- [ ] **Browser smoke** (controller). Gates. **Commit** `feat(ui): Hit or Bust reel surface + Hit/Stand controls`.

### Task 9: Floor registration

**Files:** Modify `app/machines/index.ts` (FLOOR — confirm Task 6's import), `app/pages/index.vue` (`FAMILY_ORDER` += `'blackjack-reel'`, `FAMILY_HEADING['blackjack-reel'] = 'Blackjack reel'`), `app/components/floor/MachineCard.vue` (`FAMILY_LABEL['blackjack-reel']`), `tests/machines-pachislo.test.ts` (update the family-order assertion to include the 10th machine).

- [ ] Update the floor groupings + the family-order test. Gates + a browser check that Hit or Bust appears on the floor and launches. **Commit** `feat(floor): register Hit or Bust (10th machine)`.

---

## Phase 3 — Chrome

### Task 10: Hit or Bust chrome (card-room glam)

**Files:** `app/components/game/chrome/BlackjackReelChrome.vue`; modify `chrome/theme.ts`, `chrome/registry.ts`.

- [ ] Add the palette to `theme.ts` (`'hit-or-bust'`: green felt backdrop, gold accent, neon glow), register the module in `registry.ts`, and build `BlackjackReelChrome.vue` following the existing chrome-module pattern (single root receiving `.chrome-frame` + `aria-hidden`; SVG/CSS only; subtle motion; reads `--chrome-*` vars): green-felt card-table frame, gold trim, a neon **"HIT OR BUST · 21"** sign, ♠♥♦♣ suit ornaments at the corners, a chip-stack flourish. Browser smoke (chrome renders around the card reels). Gates. **Commit** `feat(chrome): Hit or Bust card-room cabinet`.

---

## Phase 4 — Educational surfaces + verification

### Task 11: PAR sheet + X-ray for the family

**Files:** Modify `app/components/game/ParSheetModal.vue`, `app/components/game/XrayPanel.vue` (add `blackjack-reel` branches).

- [ ] PAR sheet: render the value paytable, the **derived optimal hit/stand strategy** (call `optimalAction` across the reachable decision states → a compact table), and the exact bust + Five-Card Charlie probabilities (from `blackjackReelExactRtp`). X-ray: show the live `EV(hit)` vs `EV(stand)` at the current decision (call into the DP for the current state). Component test that the PAR strategy table + odds render. Gates. **Commit** `feat(learn): PAR/X-ray strategy + odds for Hit or Bust`.

### Task 12: Responsive / reduced-motion / a11y / production-CSP verification

- [ ] Full browser smoke of a complete hand (deal/hit/stand/bust/save/Charlie) + the chrome; a11y audit on `/game` for Hit or Bust → 100/100 (chrome `aria-hidden`; controls labelled); `pnpm generate` + serve with the `_headers` CSP → no violations; reduced-motion stops chrome animation. Fix anything; commit `a11y/fix` as needed.

---

## Phase 5 — Docs & release

### Task 13: Version + CHANGELOG + README + verify

- [ ] `package.json` → `0.8.0`; `CHANGELOG.md` `0.8.0` entry (Hit or Bust: new blackjack-reel family, optimal-stopping exact RTP, additive multipliers, Five-Card Charlie, Bust-Save, bespoke chrome); `README.md` feature list + machine count (now 10) + reread end-to-end; refresh og-image/social meta if it enumerates machines. Gates; final full browser smoke; `pnpm verify` green. **Commit** `docs: v0.8.0 — Hit or Bust (blackjack-reel)`.

---

## Self-Review (author checklist — completed)

- **Spec coverage:** core loop + deal/hit/stand (Tasks 3,7,8) ✓; scaling paytable + additive multipliers + Charlie + Bust-Save forgive-and-continue (Tasks 2,3,6) ✓; weighted per-reel strips + blackjack values + aces (Tasks 2,6) ✓; one-ante-per-hand bet (Tasks 3,7) ✓; exact RTP under optimal stopping via DP + simulate convergence cross-check (Tasks 4,5) ✓; new family on the three seams + the four enforced switches (Task 1) ✓; UI sequential reveal + Hit/Stand + total/mult/save/Charlie (Task 8) ✓; bespoke chrome via v0.7.0 system (Task 10) ✓; PAR/X-ray optimal-strategy surface (Task 11) ✓; ~90% band frozen (Task 6) ✓; floor 10th machine + count test (Task 9) ✓; docs/version (Task 13) ✓.
- **Calibration note (not a placeholder):** the ~90% RTP is *derived during Task 6 using the Task 4 DP enumerator* (the family's exact-math tool), then frozen — there is no pre-computable number to paste because the tool is built in this same plan. Acceptance is explicit: `rtpPerCoin ∈ [0.89, 0.91]`, validated + frozen, with a simulate-convergence cross-check (Task 5).
- **Type consistency:** `BlackjackReelMachineDef` / `BlackjackReelSessionState` (Task 1) are consumed unchanged by `evaluateHand` (Task 2), the step functions (Task 3), the DP (Task 4), the store (Task 7), and the UI (Task 8). `HandEval`, `optimalAction`, `blackjackReelExactRtp` signatures defined in Tasks 2/4 and reused in 5/11. `phase`/`cards`/`total`/`isSoft`/`multSum`/`saveHeld`/`busted`/`charlie`/`ante` field names consistent across engine, store-restore, and UI.
- **Interactive model:** chosen the **video-like multi-call** flow (deal action + free hit actions + stand action) over a single pachislo-style call, because the per-card decision is the whole game; `spin()` explicitly throws for this family (Task 1) so no caller accidentally routes through it.
