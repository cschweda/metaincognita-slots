# Temple of Gold — Design Spec

**Date:** 2026-06-19
**Status:** Approved design → implementation
**Author:** built with the owner via the brainstorming visual companion (mockup at `/tmp/temple-of-gold/`)

---

## 1. Goal

Add **Temple of Gold**, a mega-kitsch Aztec gold-idol **cascade (tumbling) slot**, as the **Featured machine** on the floor — the floor's tenth machine and its showpiece "big daddy." It is the floor's first **free-play** machine: you spin forever and nothing drains, while the real (~90% RTP) engine runs underneath and an honest **House Ledger** plus a per-spin **trick-exposer** show — in real dollars — exactly how a paying machine would treat you, *without ever inflicting a loss.* Tagline: **"The Honest Machine."**

This is the right machine for this owner (a non-gambler with intense loss-aversion who loves the mechanics, kitsch, and aural spectacle): the cascade is a real, proven archetype (so we're replicating, not inventing — see the meta-lesson in memory), and free-play + exposure means the spectacle never has to dishearten him.

## 2. What's locked vs. what's new

The mockup (`/tmp/temple-of-gold/index.html`) is the **functional contract** for *feel*: 6×5 tumbling grid, single SPIN + single STOP, a vertical cascade "ladder," a climbing progressive, synth SFX, free-play, the House Ledger, and the trick-exposer. Per the demo-framing rule, **every number in the mockup is placeholder** — the real RTP/weights/paytable/Grand odds are computed and verified at build time, exactly like the nine floor machines.

- **Locked (from mockup):** the cascade mechanic, the one-SPIN/one-STOP control, the cascade ladder, free-play, the honest ledger, the trick-exposer, the gaudy gold theme, synth sound.
- **New for prod:** an exact-RTP cascade engine (the real math), the `cascade` machine family wired through the engine, a bespoke cabinet component, the synth-audio utility (greenfield — repo has none), X-ray + PAR teaching panels, the Featured-card floor wiring.
- **Decisions (owner pre-approved my recommendations):** **single climbing Grand** for v1 (4-tier deferred); **sound toggle defaults ON** (unlocked on first interaction).

## 3. The cascade mechanic + the exactly-computable model

**Player view:** Hit SPIN — the six reels spin. Hit STOP — they drop into a 6×5 grid. Any symbol that lands **≥ MIN times anywhere on the grid** (scatter / "pay-anywhere") pays `value × count`, those symbols shatter and vanish, the symbols above tumble down, fresh symbols drop in from the top, and the grid re-evaluates. Each successive tumble climbs an ascending **multiplier ladder** (×1, ×2, ×3, ×5, ×8, …). It keeps going until a grid produces no win. All of this is **one spin / one bet.** MIN is the volatility lever (higher MIN = rarer, bigger; lower = frequent, small).

**The model (chosen specifically so exact RTP is computable):**

- Grid = 6 columns × 5 rows = **30 cells**.
- **8 paying symbols**, plus a rare non-paying **idol scatter** (the Grand trigger, §7). Each cell is an **independent weighted draw** from integer weights `W_s` (total `T = ΣW_s`). i.i.d. cells give clean multinomial count marginals — the key to exact computation.
- **Scatter pays:** for a paying symbol `s` with grid count `c_s ≥ MIN`, pay `pay(s, c_s)` per coin, where `pay` is the symbol's base value scaled by a count tier (more symbols → higher tier). Position is irrelevant — only counts.
- **Tumble:** every cell of every winning symbol is removed and **refilled by fresh i.i.d. draws**; non-winning symbols persist in place. Re-evaluate. Chain `k` multiplies its pay by `ladder[k]`. Repeat until no symbol reaches MIN.

**Why this is exactly computable (the crux, and the main technical risk):**

The cascade is an **absorbing Markov process over the symbol-count state** `c = (c_1…c_8, c_idol)` (a vector summing to 30), absorbing when no paying symbol reaches MIN. Exact per-spin EV and variance are computed by a **memoized recursion** `EV(c, depth)` / `EV2(c, depth)` that, at each state, scores the winning symbols, then sums over the multinomial distribution of the `K` refilled cells to reach successor states. A **depth cap `D`** (≈16) bounds the recursion; the truncated tail probability is provably `< 1e-9`, far below the 3.5σ sim band, so the result is exact for all practical purposes (the project's other "exact" RTPs are likewise finite-precision computations) and uses **no Monte-Carlo in the exact path.**

**De-risking (first implementation step):** build `cascadeExactRtp` + a scratch sim immediately and confirm (a) it computes in < ~2s and (b) exact vs. sim agree within 3.5σ. MIN ≈ 8 (≈27% of the grid) makes second-and-deeper tumbles rare, so reachable/memoized states are few. If the i.i.d. 30-cell × 9-symbol state proves too branchy, the escape hatches that **preserve exactness** are: raise MIN / trim to 7 symbols / reduce the idol, or switch the refill sum to a per-symbol generating-function convolution. Grid size, symbol count, MIN, ladder, and weights are all parameters, so we tune for *both* fun and tractability. We never drop to sim for the "exact" number.

## 4. Exact RTP, variance, and the gate

`app/engine/cascadeRtp.ts` exports `cascadeExactRtp(def, opts): ExactRtpReport` returning `{ rtpPerCoin, hitFrequency, variancePerCoin, breakdown }` — same contract as the other families. `hitFrequency` = P(initial grid produces ≥1 win). `variancePerCoin` = exact Var(total spin payout)/coins² (required by `verify-floor.ts`'s 3.5σ band for non-pachislo families). `breakdown` attributes contribution per paying symbol + the Grand.

`exactRtp()` in `app/engine/exactRtp.ts` dispatches `if (def.family === 'cascade') return cascadeExactRtp(def, opts)` at the top (like video/pachislo/blackjack-reel/lock-reel). `pnpm verify` then checks cascade like any coin-linear family: `se = sqrt(exact.variancePerCoin / spins)`, PASS if RTP and HF land inside 3.5σ over 5M seeded spins. **Target: 10/10 PASS.**

## 5. Free-play + the House Ledger (play mode)

Temple is **free-play**: it never debits the session bankroll. It launches into `/game` like the other two bespoke cabinets (lock-reel, blackjack-reel), but is driven by a dedicated **`useCascade` composable** that calls the engine's `spin()` directly with `liveRand` and **does not** call `store.bookOutcome` — so the bankroll is untouched. The store still does `selectMachine('temple-of-gold')` (sets `currentDef` so X-ray/PAR/marquee work; `initMachineState` handles cascade with no session slot — the cascade resolves entirely within one `spin()`).

The **House Ledger** (in `useCascade`) accumulates the *honest* accounting of a hypothetical $1/spin: `spins`, `fed` (= spins × $1), `back` (= Σ real payouts in dollars), `net`, and live `payback %` → which provably settles toward the exact RTP (~90%). The ledger is the emotional + educational heart: the edge is shown as a *fact you observe*, never a loss you suffer.

> Teaching contrast (stated in-cabinet): every other machine on this floor debits your bankroll; this one is free — but watch what it *would* have done to it.

## 6. The trick-exposer

Productized from the mockup. After each spin, `useCascade` classifies the result and the cabinet narrates it:

- ⚠️ **Loss disguised as a win (LDW)** — a "win" below the $1 bet: "the lights and chimes celebrated $0.40 — you actually *lost* $0.60." The #1 trick, named out loud.
- 🎯 **Near miss — by design** — a paying symbol landed exactly `MIN-1`: "that 'so close' is engineered; your odds were identical to every spin."
- ➖ **Clean loss** — honest, at least.
- ✅ **Genuine win** — a real net-positive spin.
- 💥 **Jackpot** — labeled for what it is: the rare carrot funded by everyone's losses.

## 7. The Grand (single percent progressive)

A single climbing **Grand** using the proven floor pattern: `progressive: { kind: 'percent', reset, max, feedRate: 0.01 }` (identical config shape to Thunder Vault / Ruby of Gargoyle), folded into exact RTP exactly as `videoExactRtp` folds the hold-and-spin Grand. **Trigger:** a rare, exactly-computable event — landing **≥ `grandTrigger` idol scatters** on a (post-cascade) grid (à la Thunder Vault's grid-fill Grand). At reset the Grand contributes `P(grand) × reset / coin` to RTP; `feedRate` (1% of coin-in) funds it. In free-play the meter climbs off hypothetical coin-in for spectacle (the "I could hit it" carrot), exactly RTP-neutral since nothing is staked. *(The 4-tier mockup version — mini/minor/major/grand — is a documented fast-follow.)*

## 8. Symbols + tuning targets

Eight paying symbols (Aztec kitsch: idol mask, gem, crown, headdress, urn, serpent, sun, coin) + the rare idol-scatter Grand trigger. New SVG icon components under the symbol registry (decorative). **Tuning target: ~90% RTP, low volatility** (frequent small wins; satisfying-but-honest), tuned via `W_s`, the count-tier paytable, MIN, the multiplier ladder, and the Grand. Frozen exact values land in `tests/machines-cascade.test.ts`.

## 9. Architecture / file manifest

**Engine (pure, no Vue/Pinia):**
- `app/engine/types.ts` — add `'cascade'` to `MachineFamily`; add `CascadeMachineDef` (grid dims, `symbols`, integer `weights`, `minMatch`, count-tier paytable, `multiplierLadder`, `idolSymbol` + `grandTrigger`, `progressive: PercentProgressiveConfig | null`, `denominationCents`, `maxCoins`, `history`); add to the `MachineDef` union. No new `MachineSessionState` slot (cascade is non-interactive).
- `app/engine/cascade.ts` — `spinCascade(def, state, coins, rand): SpinOutcome`. Draws the grid, runs the tumble loop, reports each tumble step (grid snapshot + wins + chain multiplier) via `featureEvents` / an outcome field for UI animation. `totalPayout` = Σ all chain pays (× ladder); `gameKind: 'base'`; `coinsIn = coins`.
- `app/engine/cascadeRtp.ts` — `cascadeExactRtp` (§4).
- `app/engine/exactRtp.ts` — dispatch to `cascadeExactRtp`.
- `app/engine/index.ts` — `spin()` → `spinCascade`; `nextSpinCost` → `coins`; `initMachineState` (no cascade slot); `simulateMachine` generic path handles cascade, with a post-spin Grand feed branch mirroring video (`def.family === 'cascade'`).
- `app/engine/validate.ts` — `case 'cascade'`: grid dims, weights > 0, `minMatch` in range, paytable tiers, ladder non-empty/ascending, idol declared, percent-progressive coherence.
- `scripts/verify-floor.ts` — `coinsFor` → `case 'cascade': return def.maxCoins`.

**Machine + tests:**
- `app/machines/temple-of-gold.ts` — the `CascadeMachineDef`, tuned.
- `app/machines/index.ts` — add `TEMPLE_OF_GOLD` to `FLOOR` (→ 10).
- `tests/machines-cascade.test.ts` — validation + frozen exact RTP + a small convergence check.

**UI:**
- `app/composables/useCascade.ts` — free-play loop, honest ledger, exposer classification, reactive grid/tumble/Grand state. Never debits bankroll.
- `app/components/game/ReelCascade.vue` — the bespoke gaudy gold **cabinet**: tumbling 6×5 grid, the vertical cascade ladder, the climbing-Grand banner, chasing bulbs, the House Ledger, the trick-exposer panel, SPIN/STOP, the sound toggle. Decorative chrome is built in (full-cabinet pattern like lock-reel — no `chrome/registry.ts` entry). `aria` roles on the grid, `prefers-reduced-motion`-safe, CSP-clean.
- `app/pages/game.vue` — add a `family === 'cascade'` page branch (`tg-page`) rendering the cabinet + the X-ray/PAR sidebar; add cascade to the keyboard handler (Space = spin/stop).
- `app/components/game/XrayPanel.vue` + `ParSheetModal.vue` — cascade-aware: live EV, symbol weights, MIN, the multiplier ladder, hit-frequency, the Grand contribution; plain-English "what is a cascade / a progressive" explainer (the teaching payload).
- `app/utils/audio.ts` — greenfield CSP-clean Web Audio synth: `tone`, `noiseBurst`, `bell` + `whirr/click/win/shatter/drop/jackpot`; a module-level mute (default ON), unlocked on first user gesture; honors `prefers-reduced-motion`.

**Featured + floor:**
- `app/components/floor/FeaturedMachine.vue` — re-skin for Temple of Gold (gold idol, cascade motif; same `def` prop + `selectMachine`/navigate contract).
- `app/pages/index.vue` — mount the Featured card atop the playing floor; `'Nine'` → `'Ten'`. `'cascade'` stays out of `FAMILY_ORDER` so Temple shows only as the Featured card (not duplicated in the family grid).

**Docs:** README, `CHANGELOG.md` `[0.12.0]`, og-image (svg+png) + social meta → "ten machines", `package.json` version bump.

## 10. Testing + the gate (per task and final)

`pnpm lint` + `pnpm typecheck` + `pnpm test` + `pnpm verify` (10/10 within 3.5σ) + `pnpm build` served under the **production CSP** (the recurring lesson: `dev`/`preview` don't enforce `_headers`). Then **live browser smoke** of Temple (spin → tumble chain → ledger updates → exposer narrates → Grand spectacle → sound → X-ray → PAR), because green units miss render/data-shape bugs. **a11y 100** via lightcap on the game page. Fix every finding before claiming done.

## 11. Non-goals / deferred

- 4-tier progressive (mini/minor/major/grand) — single Grand ships first.
- Real CC0 audio samples — synth only for now (samples need `media-src 'self'` + CSP hashes later).
- A bet-mode toggle — engine is bet-capable (verify/Sim Lab use it), but the page is free-play only in v1.
- Sim Lab UI surfacing of cascade bankroll runs beyond what the generic path already gives.

## 12. Commit / push discipline

Build on branch `temple-of-gold`; ff-merge to `main` locally when green. **Commit timestamps off-hours** (outside M–F 7am–7pm). **No `Co-Authored-By`/AI trailer.** **Do not push until the owner's explicit thumbs-up.** Never touch the sibling `blackjack` project.
