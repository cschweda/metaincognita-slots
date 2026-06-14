# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
