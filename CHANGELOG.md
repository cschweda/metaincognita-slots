# Changelog

All notable changes to this project will be documented in this file.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
