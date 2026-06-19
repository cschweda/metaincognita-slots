# Temple of Gold — Implementation Plan

> **For agentic workers:** implement task-by-task with TDD; run the gate (`pnpm lint && pnpm typecheck && pnpm test`) per task and `pnpm verify` after the engine/def land. Steps use `- [ ]`.

**Goal:** Ship Temple of Gold — a free-play Aztec cascade slot — as the Featured 10th floor machine, with an exact-RTP `cascade` engine, honest House Ledger, trick-exposer, single Grand, gaudy chrome, and synth SFX.

**Architecture:** New `cascade` machine family (non-interactive: the whole tumble chain resolves inside one `spin()`). Exact RTP via memoized absorbing-Markov DP over symbol-count states. Free-play driven by a `useCascade` composable that runs the engine directly and never debits the bankroll. Bespoke full-page cabinet (lock-reel pattern). Greenfield Web-Audio synth.

**Tech stack:** Nuxt 4, Vue 3 `<script setup>`, Pinia, TypeScript strict, Vitest, tsx verify script.

Spec: `docs/superpowers/specs/2026-06-19-temple-of-gold-design.md`.

---

## Task 1 — Cascade types + family wiring (typecheck-green skeleton)

**Files:** `app/engine/types.ts`, `app/engine/exactRtp.ts`, `app/engine/index.ts`, `app/engine/validate.ts`, `scripts/verify-floor.ts`.

- [ ] Add `'cascade'` to `MachineFamily`.
- [ ] Add `CascadeMachineDef` and append to the `MachineDef` union:

```ts
/** Count-tier scatter pay: countAtLeast ascending; first match from the TOP (highest count) wins. */
export interface CascadeTier { countAtLeast: number, pay: number }

export interface CascadeMachineDef extends MachineDefBase {
  family: 'cascade'
  cols: number              // 6
  rows: number              // 5
  /** integer draw weights per PAYING symbol id + the idol scatter id */
  weights: Record<SymbolId, number>
  /** a symbol pays when it lands >= minMatch times anywhere on the grid */
  minMatch: number
  /** per paying symbol: count tiers (>= minMatch), pay PER COIN = tier.pay */
  paytable: Record<SymbolId, CascadeTier[]>
  /** chain k (1-based) multiplies its pay by ladder[min(k, len)-1] */
  multiplierLadder: number[]
  /** non-paying scatter that triggers the Grand */
  idolSymbol: SymbolId
  /** >= grandTrigger idols on a (post-tumble) grid awards the Grand meter */
  grandTrigger: number
  progressive: PercentProgressiveConfig | null
}
```

- [ ] `exactRtp.ts`: at the top, `if (def.family === 'cascade') return cascadeExactRtp(def, opts)` (import stub added in Task 3).
- [ ] `engine/index.ts`: `spin()` → `case 'cascade': return spinCascade(def, state, coins, rand)`; `nextSpinCost` → `case 'cascade': return coins`; `initMachineState` needs no cascade slot (progressive is handled generically); in `simulateMachine`'s `playOne`, add cascade to the post-spin Grand feed (`def.family === 'video' || def.family === 'cascade'`).
- [ ] `validate.ts`: add `case 'cascade'` (full checks in Task 5; a minimal version now to keep the switch exhaustive).
- [ ] `verify-floor.ts`: `coinsFor` → `case 'cascade': return def.maxCoins`.
- [ ] **Gate:** `pnpm typecheck` green (stubs `spinCascade`/`cascadeExactRtp` may temporarily throw).

## Task 2 — Cascade spin engine (TDD)

**Files:** `app/engine/cascade.ts`, `tests/cascade.test.ts`.

- [ ] **Test first:** with a tiny hand-built def (e.g. 3×3, 2 symbols, `minMatch: 4`, a fixed-seed RNG), assert: a known seed produces a known grid; a forced ≥minMatch landing pays `tier.pay` and removes those cells; the refill produces a second grid; chain 2 applies `ladder[1]`; `totalPayout` sums all chains; a no-win grid pays 0; `gameKind === 'base'`, `coinsIn === coins`.
- [ ] **Implement** `spinCascade(def, state, coins, rand): SpinOutcome`:
  - Draw `cols×rows` cells via weighted RNG (mirror existing weighted-draw helpers; integer weights).
  - Loop: find paying symbols with count ≥ `minMatch`; if none, stop. Score each via its highest matching `CascadeTier`, × `ladder[min(chain,len)-1]`; record a `LineWin` per scored symbol; remove those cells; tumble survivors down per column; refill empties by fresh weighted draws; chain++.
  - Grand: if idol count ≥ `grandTrigger` at any grid, emit a progressive `hit` (handled by the generic sim/store progressive path) once.
  - Carry the per-tumble snapshots (grid + wins + chainMult) for the UI — via a typed field on the outcome (extend `SpinOutcome` with optional `cascadeSteps?` OR pack into `featureEvents`; prefer a dedicated optional field to keep events clean).
- [ ] **Gate:** new tests green; `pnpm lint && pnpm typecheck`.

## Task 3 — Cascade exact RTP + variance (TDD, de-risk FIRST)

**Files:** `app/engine/cascadeRtp.ts`, `tests/cascade.test.ts` (extend).

- [ ] **De-risk step:** implement `cascadeExactRtp` for the tiny test def; assert it returns finite `rtpPerCoin`/`variancePerCoin`/`hitFrequency`, runs fast, and **matches a 2M-spin sim within 3.5σ**. This proves the model before tuning the real 6×5.
- [ ] **Implement** memoized `EV(countState, depth)` and `EV2(...)` over symbol-count vectors (absorbing when no paying symbol ≥ `minMatch`), summing over the multinomial refill of cleared cells; depth cap `D` with tail `< 1e-9`. Fold the percent Grand at reset (`P(grand) × reset / coins`) into `rtpPerCoin` like `videoExactRtp`. Return `{ rtpPerCoin, hitFrequency, variancePerCoin, breakdown }`.
- [ ] If the full 6×5 × 9-symbol state is too branchy: raise `minMatch`, trim to 7 symbols, or convolve per-symbol generating functions — **stay exact, never sim**. Document the chosen route in a header comment.
- [ ] **Gate:** tiny-def exact==sim test green.

## Task 4 — Machine def + tune to ~90% RTP

**Files:** `app/machines/temple-of-gold.ts`, `app/machines/index.ts`, symbol icon components under the symbol registry.

- [ ] Author `TEMPLE_OF_GOLD: CascadeMachineDef` (6×5, 8 paying + idol, `minMatch`, count-tier paytable, ascending `multiplierLadder`, `progressive: { kind:'percent', reset, max, feedRate: 0.01 }`, Aztec `history`).
- [ ] Add SVG icon components (decorative) for the 8 symbols + idol, following the existing symbol registry pattern.
- [ ] **Tune** weights/paytable/`minMatch`/ladder so `cascadeExactRtp` lands ~90% RTP, low volatility (frequent small wins). Iterate against the exact module (fast).
- [ ] Add `TEMPLE_OF_GOLD` to `FLOOR` in `machines/index.ts` (→ 10).
- [ ] **Gate:** `validateMachineDef(TEMPLE_OF_GOLD)` passes.

## Task 5 — Validation + sim + verify + frozen test

**Files:** `app/engine/validate.ts` (complete the cascade case), `tests/machines-cascade.test.ts`.

- [ ] Flesh out `validate.ts` `case 'cascade'`: `cols/rows ≥ 1`, all weights > 0 and declared, `minMatch` in `1..cols*rows`, every paying symbol has ≥1 tier with `countAtLeast ≥ minMatch`, tiers ascending, `multiplierLadder` non-empty and ≥1, `idolSymbol` declared and not in `paytable`, percent-progressive present iff a Grand is configured.
- [ ] `tests/machines-cascade.test.ts`: def validates; **frozen exact RTP/HF** (6-decimal) for `TEMPLE_OF_GOLD`; a modest convergence check (e.g. 2M spins within 3.5σ).
- [ ] **Gate:** `pnpm test` green; **`pnpm verify` 10/10** within 3.5σ.

## Task 6 — Synth SFX util + sound toggle

**Files:** `app/utils/audio.ts`, `tests/audio.test.ts` (light — guards/no-throw under happy-dom).

- [ ] CSP-clean Web Audio synth: lazy `AudioContext`, `tone`, `noiseBurst`, `bell` (partials), and `whirr/click/win/shatter/drop/jackpot`. Module-level `muted` (default **false** = ON), `setMuted`, `unlock()` on first gesture. No-op safely when Web Audio is absent (SSR/tests). Honor `prefers-reduced-motion` (skip long fanfares).
- [ ] **Gate:** importing + calling under happy-dom never throws; `pnpm lint`.

## Task 7 — useCascade composable + cabinet

**Files:** `app/composables/useCascade.ts`, `app/components/game/ReelCascade.vue`, `tests/components/cascade.test.ts` (mount smoke).

- [ ] `useCascade`: holds the def (from store `currentDef`), runs `spin(def, freshState, coins, liveRand)` on demand (free-play; **no `bookOutcome`**), exposes reactive `grid`, `tumbleSteps`, `currentWin`, `grand`, `phase`, the **ledger** (`spins/fed/back/net/payback`), and the **exposer** classification (LDW/near-miss/clean-loss/win/jackpot). Drives SFX.
- [ ] `ReelCascade.vue`: gaudy gold Temple cabinet — idol + torches, chasing bulbs, the **vertical cascade ladder** (lights one rung per tumble), the **climbing-Grand banner**, the **tumbling 6×5 grid** (shatter→fall→drop animation, reduced-motion-safe), the **House Ledger**, the **trick-exposer** panel, **SPIN**/**STOP**, the **sound toggle**. `role`/`aria` on the grid; CSP-clean; no inline handlers that violate CSP.
- [ ] **Gate:** mount smoke green; `pnpm lint && pnpm typecheck`.

## Task 8 — game.vue branch + X-ray + PAR

**Files:** `app/pages/game.vue`, `app/components/game/XrayPanel.vue`, `app/components/game/ParSheetModal.vue`.

- [ ] `game.vue`: add `v-else-if family === 'cascade'` `tg-page` block (cabinet main + X-ray/PAR sidebar, gold backdrop); add cascade to `onKeydown` (Space → spin/stop).
- [ ] X-ray + PAR cascade cases: live EV / exact RTP, symbol weights, `minMatch`, the multiplier ladder, hit-frequency, the Grand contribution + plain-English "what is a cascade / a progressive" explainer.
- [ ] **Gate:** `pnpm typecheck`; visual check deferred to Task 10 smoke.

## Task 9 — Featured card + floor (ten machines)

**Files:** `app/components/floor/FeaturedMachine.vue`, `app/pages/index.vue`.

- [ ] Re-skin `FeaturedMachine.vue` for Temple of Gold (gold idol, cascade motif, "The Honest Machine" tag; keep the `def` prop + `selectMachine`/navigate behavior).
- [ ] `index.vue`: render `<FloorFeaturedMachine :def="..." />` atop the playing floor (resolve Temple from `FLOOR`); `'Nine'` → `'Ten'`. Leave `'cascade'` out of `FAMILY_ORDER` (no grid duplication).
- [ ] **Gate:** `pnpm typecheck`.

## Task 10 — Full gate + browser smoke + a11y

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm verify` (10/10).
- [ ] `pnpm build` + serve `dist/` under the **production CSP**; load Temple; **smoke**: spin → tumble chain animates → ledger updates in real dollars → exposer narrates (force an LDW + a near-miss) → Grand banner climbs → sound plays + mutes → X-ray + PAR open and read correctly. Verify the **production CSP console is clean**.
- [ ] **a11y 100** via lightcap on `/game` (Temple). Fix contrast/roles.
- [ ] Fix every finding; re-run the gate.

## Task 11 — Docs + version + off-hours commits

**Files:** `README.md`, `CHANGELOG.md`, og-image (svg+png), social meta, `package.json`.

- [ ] `CHANGELOG.md` `## [0.12.0]`; bump `package.json` to `0.12.0`.
- [ ] README + og-image + social meta → "ten machines"; add Temple of Gold (cascade, free-play, the exposer). Reread README end-to-end for order/structure.
- [ ] Commit each milestone **off-hours** (outside M–F 7am–7pm), **no AI trailer**. **Do not push** until the owner approves. Then finishing-a-development-branch (ff-merge to main locally; push on thumbs-up).
