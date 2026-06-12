# Slots Simulator — Design Spec

**Date:** 2026-06-12
**Status:** Approved design, pending user spec review
**Project:** `metaincognita-slots` — newest member of the Metaincognita Casino sim family (holdem, video-poker, craps, blackjack, flameout)

## Mission

A slot machine simulator that emphasizes gameplay, statistical accuracy, and learning. Several authentic machine types — "exactly what you might find in, say, the Venetian casino in Vegas" — plus the vintage and Japanese hardware documented in the user's `/docs` manuals. Playable and fun, but squarely based in statistical analysis, with a non-graphical component that runs thousands of simulation runs to verify accuracy, just like the sibling sims.

The unique pedagogical angle: **the simulator shows you what no casino ever will — the machine's guts.** Every machine's full PAR sheet (strips, weights, exact RTP derivation) is viewable in-app, and an X-ray mode explains each spin as it happens.

## Decisions (from brainstorming, 2026-06-11/12)

| Question | Decision |
|---|---|
| Machine families | **All four**: modern video slots, Telnaes reel steppers, vintage Bally Series-E replicas, pachislo skill-stop |
| Math sourcing | **Authentic archetypes**: original machines whose strips/weights are designed to hit documented real-world targets (RTP, hit frequency, volatility, jackpot odds). No trademarked names; no replicated proprietary PAR sheets. Vintage machines reference historical hardware factually ("modeled on the Bally Model E-1202"). |
| Learning UX | **X-ray toggle**: play looks casino-real by default; toggle reveals live RNG trace, near-miss engineering callouts, convergence stats. Plus a `/learn` page (flameout pattern). |
| Architecture | **One headless engine, four family evaluators** (Approach A). Machines are pure data; one `spin()` contract; UI, store, Web Worker, and Vitest all consume the same `SpinOutcome`. |

## The Floor (8 machines)

Names are working titles; rename freely. Each machine ships with prose history connecting it to its real-world archetype. RTP figures below are **design targets that guide strip/weight design**; the app never displays a target — every figure shown in-app comes from `exactRtp(def)`, and simulations confirm it.

### Video slots (3)

1. **Canal Royale** — 5×3, 25 selectable lines, wild substitutions, 3+ scatters trigger 10 free spins at 2× multiplier. Target RTP ≈ 92%, medium volatility. The bread-and-butter Venetian floor machine.
2. **Dragon's Hoard** — 5×3, 243 ways (any-adjacent left-to-right), stacked wilds on reels 2–4, free spins with retriggers. Target RTP ≈ 94% — the floor's deliberately "loose" machine, for teaching machine-choosing literacy.
3. **Thunder Vault** — 5×3 hold-and-spin (Lightning Link archetype). Base game plus orb symbols carrying credit values; 6+ orbs trigger hold-and-spin (3 respins, counter resets on each new orb); orbs can award Mini/Minor/Major fixed jackpots; filling all 15 positions awards the **Grand progressive** (percentage-of-coin-in fed). Target RTP ≈ 90%, high volatility.

### Reel steppers — Telnaes virtual reels (2)

4. **Diamond Doubler** — 3 reels, single payline, wild symbol doubles (one wild = 2×, two wilds = 4×). 22 physical stops per reel; virtual reel of 72 weighted entries per reel mapping to physical stops (Telnaes patent US 4,448,419). Target RTP ≈ 95% at max coin, hit frequency ≈ 14%.
5. **Sevens Ablaze** — 3 reels, single line, 2-coin multiplier, top award is a **progressive** fed by a percentage of coin-in (modern model), only hit at max coin. Target base RTP ≈ 94% plus progressive contribution; teaches "always max-coin on progressives" and break-even jackpot math.

### Vintage Bally Series-E replicas (2)

Outcomes from **uniform random physical stops** — no weighting, pre-Telnaes. RTP emerges purely from strip layout × paytable. This is historically accurate per the manuals: Series E reels spin mechanically and are read optically; the CPU only reads and pays.

6. **Series E 3-Line** (modeled on Bally Model E-1202) — 5 reels × 22 uniform stops, 3 paylines, dollar denomination. Crowned by the **1989 Double Progressive controller** (Bally FO-5140): two jackpot meters alternating per coin-in ("coins per toggle"), each with reset minimum, ceiling maximum, and **dual progression rates** (1st rate until a limit amount, then 2nd rate takes over). Target RTP ≈ 89% — the one real RTP datum in the manuals (Personality PROM, Series E service manual p.56).
7. **Series E Multiplier** (modeled on Bally Model E-1203) — 4 reels × 25 uniform stops, center line only, 1–3 coin multiplier, progressive at max coin. Target RTP ≈ 89%.

### Pachislo skill-stop (1)

8. **Stock Rush** — 3 reels, player-stopped (skill-stop). 1 token = center line, 2 = +upper/lower, 3 = +diagonals (5 lines max). 50-credit meter; wins beyond it hopper-paid. **Six operator odds levels** with target RTP bands straight from the manual: L1 65–67%, L2 72–74%, L3 79–81%, L4 88–95%, L5 105–107%, L6 115–125% (levels 5–6 intentionally over 100% — parlor loss-leaders). **Bonus stock system**: Bonus = 15 tokens + 8 guaranteed wins; Big Chance = 15 tokens + 24 guaranteed wins in 3 rounds of 8, ceiling ≈ 500 tokens. Skill-stop is honest but bounded: the engine draws the spin's flag (win type or loss) first; on each stop press the reel **slips up to 4 positions** from the player's stop point — pulling a flagged win onto a line if reachable, pushing unflagged wins off. If the player's timing makes a flagged win unreachable within the slip window, the flag is **not lost — it stays stocked** and re-asserts on subsequent spins, so player timing affects *when* wins land, never the long-run RTP band. That bounded slip is itself the machine's core lesson. Odds level selectable in-app via an "operator key" control.

**Pedagogical arc of the floor:** uniform physical stops (1906–1980) → weighted virtual reels (1984) → video lines/ways → hold-and-spin progressives (2017), plus the pachislo counterexample where the player touches the reels and the math still wins.

## Architecture

```
MachineDef (pure data)          headless engine (app/engine/)
┌──────────────────┐    ┌────────────────────────────────┐
│ app/machines/*.ts│    │ spin(def, state, bet, rng)     │
│  • reel strips   │───▶│   ├ evalStepper()   (Telnaes)  │
│  • weights       │    │   ├ evalVideo()  (lines/ways)  │
│  • paytable      │    │   ├ evalBallyEM()   (uniform)  │
│  • features      │    │   └ evalPachislo()  (stock)    │
└──────────────────┘    └───────────────┬────────────────┘
                                        │ SpinOutcome
         ┌──────────────┬───────────────┼───────────────┐
       Vue UI       Pinia store     Web Worker        Vitest +
      (reels,      (bankroll,      (batch sims     verify-floor.ts
       x-ray)       session)       → /analysis)    (convergence)
```

`app/engine/` is pure TypeScript with **no Vue/Nuxt imports** — consumed identically by UI, worker, tests, and CLI script.

### Core types

- **`MachineDef`** — discriminated union on `family: 'video' | 'stepper' | 'bally-em' | 'pachislo'`. Common fields: `id`, `name`, `denomination`, `maxBet`, `symbols`, `strips`, `paytable`, `history` (prose), `volatilityClass`. Family-specific: `virtualReelMap` (stepper); `lines | ways`, `features` (free spins, hold-and-spin) (video); `progressive` config — Bally dual-toggle (reset/max/coins-per-toggle/dual rates) or modern percentage-fed (video/stepper); `stock`, `oddsLevels`, `slipWindow` (pachislo).
- **`spin(def, machineState, bet, rng) → SpinOutcome`** — pure function, dispatches by family. `SpinOutcome`: physical stops, symbol grid, itemized `wins[]` (line/way/scatter, symbols, payout), `featureEvents[]` (free-spin trigger/decrement, hold-and-spin round results, stock push/pop, bonus state transitions), `progressiveDelta` (increments and any jackpot award), and **`rngTrace`** — every random draw with its virtual-stop index and physical-stop mapping, so the X-ray panel renders *why* this spin landed where it did without re-deriving anything.
- **`MachineSessionState`** — mutable per-machine state, separate from the def: progressive meter values, stock count, bonus/feature state, free spins remaining, credit meter. Persisted across sessions so progressives grow meaningfully.
- **`exactRtp(def) → RtpReport`** — per-family closed-form/enumeration calculator: stepper = weighted product over virtual reels; video = per-reel probability convolution including feature EV (free-spin EV computed analytically; hold-and-spin EV via absorbing Markov chain over orb counts); bally-em = full enumeration (22⁵ = 5,153,632 / 25⁴ = 390,625 cycles); pachislo = Markov chain over stock/bonus states per odds level. **Every RTP shown in the app is computed from the def, never hard-coded.** Simulations then confirm convergence to it.
- **RNG** — mulberry32 (flameout pattern). Live play: crypto-seeded stream. Sims/tests: fixed seeds for reproducibility.

### Near-miss & X-ray semantics

Near-miss detection (e.g., jackpot symbol landed within ±1 of the payline; 2-of-3 jackpot symbols on-line) is **derived from the rngTrace and strip layout after the fact — purely presentational**. The engine never biases stops toward near-misses; the callout teaches that on weighted machines, near-misses are an emergent statistical property of strip design (jackpot symbols flanked by blanks on the virtual reel). On the uniform Bally machines the X-ray shows the contrast: every stop is genuinely 1/22.

## UI

Family shell (flameout/craps pattern): `app/layouts/default.vue` — top bar (back button, "Slots Simulator", session-active indicator); bottom nav (History, Analysis, Learn, GitHub). Dark theme, gold accents, @nuxt/ui + Tailwind 4. `prefers-reduced-motion` honored (spin animations collapse to instant results); `aria-live` result announcements; spin lockout during animation.

### Pages

- **`/` (floor)** — machine cards grouped by family. Casino-visible facts up front (name, denom, current jackpot); X-ray-styled reveal adds RTP, hit frequency, volatility, exact jackpot odds. Set bankroll here (or resume saved session).
- **`/game`** — the selected machine.
  - Reel window themed per family: video = 5×3 grid with line/ways win overlays; stepper = 3 reels behind payline glass; bally-em = vintage chrome bezel with **two alternating progressive meters** (E-1202) and coin-handling flavor (hopper pay vs. attendant lockup for jackpots); pachislo = STOP buttons (clickable + keys 1/2/3, active only when lit), stock lamp, bonus-round display, operator-key odds selector.
  - Bet controls per machine (lines × per-line for video; coins for steppers/Bally; tokens for pachislo). Credit meter. Win presentation with appropriate fanfare.
  - **Paytable button** → PAR-sheet modal: full strips, per-symbol weights, paytable, and the exact-RTP derivation rendered from `exactRtp(def)`.
  - **X-ray toggle** → live side panel: last spin's rngTrace visualized (virtual→physical stop mapping with weight bars), near-miss callouts, session actual-vs-theoretical RTP convergence sparkline, feature/progressive state internals.
  - Sidebar tabs: Session (bankroll curve, spins, W/L) and Machine intel.
- **`/history`** — spin-by-spin log: machine, bet, result grid, payout, feature events; session financials; text export.
- **`/analysis` (Sim Lab)** — pick machines (or whole floor), spins-per-run × runs; Web Worker batch execution with progress and cancel; results: exact vs simulated RTP with deviation, hit frequency, volatility (SD per spin), max drawdown, jackpot/feature hit counts, convergence chart. Plus **bet-sizing system comparison** (Flat / Martingale / Paroli / D'Alembert) on the identical seeded spin sequence (flameout Strategy Lab pattern) — demonstrating systems reshape variance, never EV.
- **`/learn`** — the mathematics: Telnaes virtual reels (interactive weight-slider widget showing RTP/hit-freq response), near-miss engineering, RTP vs hit frequency vs volatility, progressive math (break-even jackpot size; when a progressive is +EV), the pachislo stock system, betting-system futility, house-edge comparison across the floor and vs blackjack/craps/video poker, slot history 1899→2026 (Fey → EM Bally → Series E → Telnaes → video → hold-and-spin), and the regulatory reality (PAR sheets, GLI-11, MGC oversight). Cites the user's actual manuals.

### State & persistence

Single Pinia store `app/stores/slots.ts`: bankroll, current machine, per-machine `MachineSessionState`, spin history (trimmed to 1,000), settings. localStorage key **`slots-simulator-session`**, versioned (`v: 1`) with sanitize-and-default on load (flameout lesson — never crash on corrupt storage). Progressive meters persist across sessions.

## Verification (the non-graphical component)

1. **Vitest suites** (`tests/` + co-located `*.test.ts`):
   - Exact-RTP calculators cross-checked against independent brute-force enumeration (small configs enumerated both ways).
   - **Convergence tests**: ≥1M seeded spins per machine; simulated RTP within the statistical confidence interval of `exactRtp(def)`; hit frequency likewise.
   - **Chi-squared tests** on RNG output and on physical-stop distributions (uniform for Bally; matching declared weights for stepper/video).
   - **Progressive controller tests** replaying the 1989 FO-5140 manual's worked coin-by-coin examples (toggle alternation, dual-rate switchover at the limit amount, meter clipping at maximum, reset behavior after a hit).
   - **Pachislo invariants**: guaranteed-win counts honored exactly (8 / 3×8); per-level long-run RTP inside the manual's bands for all six levels; slip window never exceeds 4 positions; stock state machine never strands.
   - **Paytable integrity**: every advertised award reachable; near-miss analysis provably non-payout-affecting (same seeds with detection on/off produce identical financial results).
   - Store tests: persistence versioning/sanitization, bet clamping, lockout.
2. **`scripts/verify-floor.ts`** (run via `npx tsx`, holdem pattern) — headless full-floor verification: configurable spins/runs, prints per-machine report (exact RTP, simulated RTP, deviation, hit freq, volatility, jackpot counts). Wired into CI.
3. **In-browser Sim Lab** uses the same engine and worker — users can reproduce the verification themselves.

## Error handling

- `validateMachineDef(def)` at load — dev-time assertion + dedicated tests (strip/weight lengths consistent, paytable symbols exist, probabilities sum correctly).
- Spin lockout during animation; bet clamped to available credits; feature states resume correctly after navigation/reload (wall-clock-independent — slots are turn-based, no flameout-style timing exploit surface, but mid-feature reload must restore exactly).
- Worker errors surface in Sim Lab UI with retry; localStorage corruption → sanitize and default.

## Tooling & deployment

- pnpm (≈10.x), Nuxt 4.4.x SPA (`ssr: false`), TypeScript strict, Pinia 3, @nuxt/ui 4.6, Tailwind 4, Vitest 4 + @vitest/coverage-v8, ESLint with craps' stylistic config (`commaDangle: 'never'`, `braceStyle: '1tbs'`), `pnpm typecheck`.
- GitHub Actions CI: lint + typecheck + test (+ verify-floor smoke run).
- Netlify static deploy (`pnpm generate` → `dist`), strict CSP, **icons bundled into the client build** (flameout 0.4.1 lesson — no runtime api.iconify.design fetches).
- `CHANGELOG.md` (Keep a Changelog), `package.json` version starting 0.1.0.
- README: educational philosophy, the floor, the math, slot history deep-dive, tech stack, verification instructions (video poker README pattern).
- **First implementation step: `git init`** — the directory is not yet a repository. `/docs` PDFs stay untracked (45 MB of scanned manuals).

## Out of scope (v0.1)

- Sound design (hook points left in result presentation; no audio assets).
- Additional machines beyond the eight (the data-driven model makes adding them cheap later).
- Multi-denomination switching on one machine; bonus-wheel/pick-em second-screen features; linked wide-area progressives across "casinos".
- Persona/bot players (slots have no decisions to compare against; the Sim Lab's bet-sizing comparison covers the strategy-myth lesson).

## References

- Bally Series E service manual (Marshall Fey, 1995) — `docs/499007862-slot-set-up.pdf`: 20/22/25 physical stops; Personality PROM with 89% payout example (p.56); paylines/odds architecture; tilt and meter models.
- Bally FO-5140 Double Progressive instructions (1989) — `docs/Bally Double Progressive Inst.pdf`: full progressive parameter table and worked examples (pp.5–10).
- Bally Manual 7050 parts catalog (1981) — `docs/bally 7050 - slot models e1202 e1203.pdf`: E-1202 = 5×22 stops, 3-line progressive; E-1203 = 4×25 stops, 3-coin multiplier (pp.19/21).
- Bally Manual 6000 EM training manual (1979, 5 parts) — EM mechanics, payout counter, odds/step-up units.
- MGC Slot Machine Activity Manual v8.0 (2022) — `docs/726344067-...pdf`: modern progressive data model (base/reset/limit, increment + secondary + hidden rates, overflow, up to 3 levels, per-machine RTP%), regulatory framing.
- Pachislo How-To Manual v1.0 (2006) — `docs/Pachislot-manual_text.pdf`: six odds levels with RTP bands (p.11), bonus stock structure (p.9), bet/payline and credit rules, skill-stop behavior.
- Telnaes patent US 4,448,419 (1984) — weighted virtual reel mapping (external reference).
- Sibling conventions: metaincognita-flameout 0.4.1 (engine/test/persistence patterns), -craps (layout, CI, chi² testing), -holdem (headless scripts), -video-poker (worker sims, README philosophy).
