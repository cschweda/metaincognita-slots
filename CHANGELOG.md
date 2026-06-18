# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.10.1] - 2026-06-18

### Changed
- **Flameout 21 parked — the floor is back to nine machines.** The
  blackjack-meets-crash game was a good exercise but isn't fun as a slot: a
  risk-free cashable launch at a real (sub-100%) RTP forces low payoff for high
  risk (surviving the whole gauntlet on a weak hand nets a few cents), which
  doesn't read as Vegas-y. It's removed from the selection screen, the Sim Lab
  list, and `verify`.
- **The code is kept, not deleted.** Flameout 21 stays in the repo and is still
  resolvable + covered by its tests (the store resolves a new `ALL_MACHINES` =
  `FLOOR` + `PARKED`); it's simply off the floor. A fuller rework (every launch
  ≥ ×1.0, cash-out gated to reel 3, reworked DP, rocket chrome, sidebar result
  card) is preserved on the `flameout-21-parked` branch for a possible revisit.
- og-image, social meta, and the README updated to nine machines.

### Lesson
- The stop-the-reels dynamic (constantly spinning reels you stop yourself) is
  fine and reusable — see pachislo (Stock Rush). What failed was pairing it with
  a crash economy: at a real RTP, "climb then lose it all" can't pay off the risk.
  A future stop-the-reels game should pair the dynamic with a *collecting* payoff
  (hold-and-spin lock, line wins, a real bonus), not a lose-it-all gamble.

## [0.10.0] - 2026-06-17

### Changed
- **Flameout 21 — a blackjack-meets-crash game — replaces Lucky 21** in the
  `blackjack-reel` family (the floor's tenth machine; the floor is still ten
  machines). The stop-the-reels chassis is reborn as an Aviator-style crash
  game:
  - The two-card deal (reels 1–2, which never crash) sets a **launch
    multiplier** and a climb **velocity** by hand value — closer to 21 launches
    higher and climbs steeper; a 2-card natural launches highest.
  - Reels 3–5 each **climb** (multiplier ×= velocity) or **crash** (lose it
    all), with the crash share escalating ~20% → 33% → 43%.
  - **Cash out any reel** to bank `bet × multiplier`, or ride a hot hand and
    top out by surviving all five.
- **Recalibration to ~97% RTP** (the Aviator standard) under optimal cash/climb
  play — exact `rtpPerCoin` 96.9591%. Because reels 1–2 never crash a player can
  always cash the launch risk-free, so RTP ≥ E[launch]; the launch table
  therefore averages below ×1.0 and the profit comes from the climb. The
  `blackjackReelExactRtp` DP enumerates the two-card deal distribution into a
  closed-form climb/crash policy; the seeded sim cross-check converges within the
  3.5σ band.
- **Dynamic rocket side-chrome + altitude marks** flank the cabinet, rising with
  the climb, and an **in-page result card** replaces the centered result modal
  (the side rockets stay visible at the payoff). The PAR sheet and X-ray now read
  in crash terms (launch/velocity, per-reel crash odds, live EV cash vs climb).
- **Flashy 3-across kitsch floor**: the slot picker is now a three-column neon
  grid with chase-light bulb trim, per-family accents, big glyphs, hover
  lift+glow, and paylines/ways badges; Flameout 21 is the featured machine.

### Fixed
- **Sim Lab now runs Flameout 21.** `simulateSession` implements the
  `blackjack-reel` (crash) family instead of throwing — one paid spin per hand,
  the ante charged once, and the closed-form optimal cash/climb policy driving
  the run (mirroring the convergence sim). Picking Flameout 21 in the Sim Lab
  produces full risk-of-ruin / survival / drawdown / sample-trajectory output;
  its empirical RTP tracks the exact 96.9591% DP behind the house-edge figure.

## [0.9.0] - 2026-06-16

### Added
- **Lucky 21 — Blackjack Bonus**: a true 2-card natural (A + ten-value) ends the
  hand into an optional double-or-nothing gamble on a spinning chromed reel:
  - **STOP** spins the reel for a fair 50/50 outcome: ×2 doubles the amount on
    the line, BUST forfeits it all.
  - **CASH OUT** locks the guaranteed natural payout without risking the gamble.
  - Capped at 3 consecutive doubles (×1 → ×2 → ×4 → ×8); a ladder rung lights
    at each successful double so the player always sees their position.
  - The bonus is RTP-neutral: the fair coin-flip EV equals the forfeited amount,
    so it neither raises nor lowers the machine's RTP.
  - A result-modal gamble chip confirms the final outcome (BUST or the doubled
    amount); X-ray labels the natural correctly throughout the sequence.

### Changed
- **Lucky 21 reel escalation rebalance**: danger and bonuses now scale correctly
  3→4→5, with BUST symbols scattered for drama rather than front-loaded:
  - Reel 3 (lock-in bonus, no cards): 6 BUST + ×2/×3 multipliers + −3 safe room.
  - Reel 4 (mix): 13 BUST + ×3/×5 multipliers + −3 safe room + cards.
  - Reel 5 (big): 20 BUST + ×5/×10 multipliers + cards; surviving reel 5 qualifies
    for Five-Card Charlie.
- **Recalibration**: RTP 90.0255% (was 89.9977%), `naturalPay` 5, Five-Card
  Charlie ≈ 0.77%, house edge ≈ 9.97%. The `blackjackReelExactRtp` DP covers the
  gamble branch; seeded sim cross-check converges within the 3.5σ band.

## [0.8.0] - 2026-06-15

### Added
- **Hit or Bust** — a new machine and a new engine family, `blackjack-reel`
  (the floor's tenth machine). Press-your-luck blackjack reimagined as a
  five-card reel game:
  - Ante a bet; the machine deals two cards, then you **Hit** (reveal the next
    card) or **Stand** (lock the payout) across up to five reels. No dealer —
    you play a scaling paytable by final hand value (21 best, then 20/19/18;
    bust pays nothing).
  - **Additive multiplier cards** (×2 + ×3 = ×5) that contribute nothing to the
    total but scale the payout — tempting you to hit even a strong hand.
  - **Five-Card Charlie** bonus for surviving all five cards, and a rare
    **Bust-Save** that voids one busting card in place so the run continues.
  - **Exact RTP under optimal stopping**: a backward-induction DP over the
    state `(cards drawn, hard total, aces, multiplier sum, save held)`
    enumerates the whole decision tree. Calibrated to 89.9977%; a
    simulate-under-optimal cross-check converges (89.9858% sim, Δ 0.0120%).
  - **PAR sheet** renders the DP-derived hit/stand strategy table and the exact
    bust / Five-Card-Charlie odds; **X-ray** shows the live EV(hit) vs
    EV(stand) at each decision.
  - Bespoke **green-felt card-room chrome** (gold table trim, ♠♥♦♣ corner
    ornaments, chip stacks, neon "HIT OR BUST · 21" sign) — the tenth chrome
    module, via the v0.7.0 chrome system.

### Fixed
- PAR strategy table is now card-count-aware and derived entirely from the DP,
  so it can never contradict the live X-ray (it previously queried the DP with
  card arrays that didn't sum to the stated total). The Bust-Save note now
  correctly reads a null stand-threshold as "HIT on all hard totals" instead of
  "no change".
- Hit or Bust multiplier badge overstated the multiplier by one (showed ×3 while
  the hand paid ×2); it now matches the payout's `max(1, multSum)`.
- Accessibility on the Hit or Bust game screen → 100/100: empty card slots
  carried `aria-label` with no role (now `role="img"` in a `role="group"`
  row), and the X-ray EV footnote met contrast (neutral-400).
- Bet + Deal/Hit/Stand controls wrap on narrow viewports instead of clipping
  the Hit/Stand buttons off-screen.
- `pnpm verify` (and `simulateMachine`/`exactRtp` plumbing) now covers the
  `blackjack-reel` family — the floor verification reports all ten machines.

### Changed
- og-image alt, README, social meta, and the floor intro now read "ten
  machines"; `pnpm verify` covers 10.

## [0.7.0] - 2026-06-14

### Added
- Per-machine decorative cabinet chrome: every machine's reel window is now
  wrapped in a bespoke, gaudy, themed frame. Nine hand-crafted chrome modules:
  - **Ruby of Gargoyle** — gothic stone ring, cathedral arches, bobbing
    gargoyles, Gargoyle's Eye, crimson breathing glow.
  - **Stock Rush** — triple-neon tube frame, kanji big-win sign, chasing
    bulbs, torii ⛩️ and lucky cat 🐱.
  - **Canal Royale** — baroque carnival gold scrollwork, masquerade masks 🎭,
    fluted gold rails, shimmer sweep.
  - **Dragon's Hoard** — fire-breathing dragon 🐉 with soft flame flicker,
    emerald scale-arc border, coin row 🪙.
  - **Thunder Vault** — riveted brushed-steel frame, SVG lightning bolts,
    vault-dial motif, violet/electric-blue glow.
  - **Diamond Doubler** — frosted ice facets, silver rails, prismatic gleam
    sweep, cool restrained sparkle.
  - **Sevens Ablaze** — layered flame shapes licking up from the base, ember
    dots, charred dark frame, hot red/orange glow.
  - **Series E 3-Line** — warm brass gradient, bell finial 🔔, cream bakelite
    corner inlays, tungsten glow; the least animated (period-correct calm).
  - **Series E Multiplier** — same Bally era, cool turquoise + chrome,
    red ×2/×3 multiplier numerals as side ornaments; deliberately distinct
    from the 3-Line so the two Ballys no longer look identical.
- `<GameMachineChrome>` wrapper component: injects per-machine palette as CSS
  variables (`--chrome-accent/secondary/glow/backdrop`) + a radial stage
  backdrop; resolves the active machine's chrome module via a registry.
- `chromeFor()` registry + `DefaultChrome` fallback: future games get per-
  machine chrome by dropping in one `.vue` module and one registry line;
  unknown machines fall back automatically to the accent-framed default.
- Global `prefers-reduced-motion` guard in `main.css`: all chrome ambient
  animation is suppressed with a single `@media` rule so the guard applies to
  every present and future module automatically.

### Notes
- Reels, controls, bet logic, and the engine are **completely unchanged**.
- All chrome is `aria-hidden` + `pointer-events:none` — no accessibility
  regressions; a11y audit remains 100/100.
- CSS/SVG-only hand-built art: no external images, no CSP violations.
- Ambient keyframe motion is subtle throughout (brightness ≈1↔1.1,
  translateY ≤2–3px, opacity glows, durations 3–6s ease-in-out); no
  strobing or rapid blinking anywhere.

### Changed
- Test suite: 363 tests (was 357 at v0.6.0).

## [0.6.0] - 2026-06-14

### Added
- Sim Lab (`/sim-lab`, top-level nav): risk/bankroll Monte-Carlo lab. Runs
  thousands of sessions against any of the nine machines in a Web Worker (UI
  stays responsive; live progress bar + cancel returning partial results). Each
  session plays from a starting bankroll at a fixed bet until bust or a spin
  cap. Headline stats: risk of ruin, median/mean ending bankroll, % ended
  ahead, avg session length, avg max drawdown, empirical RTP, house edge. Four
  inline-SVG charts: survival curve, ending-bankroll histogram, sample session
  trajectories, max-drawdown histogram.
- Learn section (`/learn` index + four topic pages, top-level nav): layered
  "intuition + one live number, then a collapsible rigorous derivation with
  live tables" explainers, all driven by live machine data.
  - **House edge** — floor-wide RTP/house-edge table via `exactRtp()`.
  - **Telnaes virtual reels** — virtual vs physical reel weight mechanics; the
    combined 3-reel jackpot squeeze (~1 in 31,104 virtual vs 1 in 10,648
    physical on Diamond Doubler).
  - **Hold-and-spin** — Ruby of Gargoyle respin-reset as an absorbing Markov
    chain (P(fill)=2.35%, E[final]=10.19 cells).
  - **Gargoyle's Eye** — the additive ×N multiplier gem: ×2.5 expected added
    multiplier; additive ×5 vs multiplicative ×6.
- Engine: `app/engine/sessions.ts` — `simulateSession`, `aggregateSessions`,
  `createSimLabRun` reuse the existing per-spin primitives (`spin`,
  `nextSpinCost`, `initMachineState`); `simulateMachine` is untouched.
- Deploy: CSP extended with `worker-src 'self'`; `/sim-lab` and all `/learn/*`
  routes added to `nitro.prerender.routes`; worker verified loading under the
  production CSP (no blob URL, no CSP violation).

### Changed
- Nav is now **Sim Lab / Learn / History** (was History only).
- Test suite: 357 tests (was 325 at v0.5.0).
- Social meta descriptions updated to reflect Sim Lab and /learn capabilities.

## [0.5.0] - 2026-06-14

### Added
- Ruby of Gargoyle: a gothic hold-and-spin jewel machine (video family, ninth on
  the floor) with the Gargoyle's Eye multiplier gem — ×2/×3 faces that ADD and
  scale the collected ruby credits at collect; the Grand pays clean.
- Engine: orb values may be credit gems or multiplier gems; the exact-RTP feature
  moments condition on the multiplier-cell count and provably reduce to the
  credit-only closed form (Thunder Vault's frozen math is unchanged).
- Docs: future-games roadmap (blackjack-reel "Five Card Charlie", crash/cash-out,
  4-tier progressives) and a README "Future variants" section.

### Changed
- og-image, README, and social meta now read "nine machines"; `pnpm verify`
  covers 9 machines.
- Content-security policy hardened: inline scripts hash-pinned, no
  `unsafe-inline`, `object-src 'none'`.
- Restore is explicitly prototype-pollution-guarded; stepper virtual maps must
  cover every physical stop; reel count is tracked reactively.
- Reel surfaces share a `GameReelColumn` component + `useReelSymbols`
  composable (deduplication, no behaviour change).

### Fixed
- Win display: stepper "count" wins (e.g. cherries) no longer count a wild on
  the line as the paying symbol — a wild neither inflates the chip count nor
  lights a non-winning cell (the engine pays the literal symbol only).
- Bally multi-line hit frequency is computed over the joint reel-stop
  distribution; treating paylines as independent had under-reported it.
- Held result, payline drawing, and winning-cell glow reflect the actual
  matched run rather than the full payline; feature wins no longer emit a
  stray "0" chip and scatter wins glow their real grid cells.
- Dual progressive payouts are floored, preserving the integer-cents wallet
  invariant even for a corrupt restored meter.

## [0.4.0] - 2026-06-13

### Added
- Slot-machine reel presentation: filled-duotone symbol icons, vertically
  spinning reels with staggered ease-out (reduced-motion snap), drawn paylines
  with winning-cell glow and gutter line numbers, a held result bar (gross win,
  bankroll, literal per-line chips, bankroll sparkline), a per-machine marquee,
  and a denomination tag. Presentation only — the engine, RTP, and money model
  are unchanged (a display `icon?` field was added to symbol metadata).

## [0.3.0] - 2026-06-12

### Added
- Playable UI: casino floor with family-grouped machine cards and X-ray intel,
  per-family game surfaces (video lines/ways/hold-and-spin board, stepper
  payline glass, Bally dual alternating progressive meters, pachislo with
  HUMAN stop presses and visible slip), PAR-sheet modal with the exact-math
  derivation, X-ray side panel (labeled RNG trace, near-miss callouts,
  session-vs-exact convergence sparkline, machine internals), history page
  with text export.
- Session store: single-wallet cents model, atomic spins, versioned
  localStorage persistence with sanitize-on-load, EXACT mid-feature restore,
  per-machine progressive meters that persist across sessions, pachislo
  operator key (six computed odds levels).
- Engine seams: optional player presses on spinPachislo, nextSpinCost,
  pure nearMisses module (provably non-payout-affecting).

### Changed
- verify-floor: pachislo sub-runs 10 → 20; hit frequency now banded too.
- CI enforces engine purity (no UI imports under app/engine).

## [0.2.0] - 2026-06-12

### Added
- Video family: anchored line evaluation (25-line geometry), 243-ways evaluation,
  scatter pays, free spins (multipliers + retriggers), hold-and-spin with orb
  values and a percentage-fed Grand progressive.
- Pachislo family: /16384 flag lottery, stock queues that never lose a flag,
  deterministic skill-stop control (slip ≤ 4) exhaustively verified win-free
  without a flag, REG/BIG bonus rounds with increased-odds interludes, six
  operator odds levels.
- Machines: Canal Royale (92.4559%), Dragon's Hoard (93.9950%), Thunder Vault
  (90.2948% @ Grand reset), Stock Rush (66.0012%–120.0028% by level) — floor
  complete at 8.
- Exact math: full 24⁵ video cycle enumeration with analytic feature moments
  (Wald, branching second moments, absorbing Markov chain); pachislo renewal
  closed form; all frozen values reproduced from the plan calibration.
- `SpinOutcome.gameKind`/`coinsIn`/`featureEvents`; simulator v2 counts cycles,
  drains in-flight features, and takes a pachislo `oddsLevel`.

### Changed
- Family dispatch uses exhaustive switches with never-checks.
- `SimResult.hitRate` renamed to `hitFrequency`.
- Vitest engine suites run in the node environment.
- `verify-floor`: 8 machines, NaN-guarded args, pachislo block-empirical sigma,
  jackpot-column footnote.

### Fixed
- `exactRtp` rejects out-of-range coin levels.

## [0.1.0] - 2026-06-12

### Added
- Project scaffold: Nuxt 4 SPA with family conventions (pnpm, @nuxt/ui,
  Tailwind 4, Pinia, Vitest, Netlify static preset, strict CSP).
- Headless engine (`app/engine/`): seeded mulberry32 RNG, award matching,
  uniform-stop Bally-EM evaluator, Telnaes virtual-reel stepper evaluator,
  FO-5140 progressive controllers (dual toggle / single / percent feed),
  exact-RTP enumeration with variance and per-entry breakdown, machine
  validation, seeded batch simulation.
- Four calibrated machines with frozen exact math: Diamond Doubler
  (94.7442%), Sevens Ablaze (94.4881% @ reset), Series E 3-Line (89.0351%),
  Series E Multiplier (89.1264% @ 3 coins).
- Verification: frozen-calibration tests, chi-squared RNG/distribution
  tests, 3.5-sigma convergence suite, `pnpm verify` floor report CLI.
