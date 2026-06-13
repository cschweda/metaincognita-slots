# Metaincognita Slots

An educational slot machine simulator — part of the Metaincognita Casino
family (hold'em, video poker, craps, blackjack, flameout). Play authentic
machine archetypes, then see exactly what the casino never shows you: the
reel strips, the Telnaes virtual-reel weights, the engineered near-misses,
and the precise mathematics of the house edge.

**Status: engine milestone.** The headless engine, four calibrated machines,
and the statistical verification harness are complete. The playable UI,
X-ray mode, Sim Lab, and learn pages land in subsequent milestones.

## The floor (so far)

| Machine | Family | Format | Exact RTP |
|---|---|---|---|
| Diamond Doubler | Telnaes stepper | 3 reels, wild 2x/4x multiplier | 94.7442% |
| Sevens Ablaze | Telnaes stepper | 3 reels, 2-coin, percent-fed progressive | 94.4881% @ reset + 1%/coin-in feed |
| Series E 3-Line | Vintage Bally (E-1202 replica) | 5 reels x 22 uniform stops, 3 lines, dual toggling progressive | 89.0351% per line |
| Series E Multiplier | Vintage Bally (E-1203 replica) | 4 reels x 25 uniform stops, 1-3 coin multiplier | 89.1264% @ 3 coins / 85.0304% @ 1 |

Every RTP shown is **computed** from the machine definition by exact
enumeration (`exactRtp`) — never asserted — and verified by seeded
multi-million-spin simulation.

## Verification

```bash
pnpm install
pnpm test          # unit + frozen-calibration + convergence suites
pnpm verify        # headless floor verification report (5M spins/machine)
```

## Tech

Nuxt 4 SPA (ssr:false) - TypeScript strict - @nuxt/ui + Tailwind 4 -
Pinia - Vitest - pnpm. The engine (`app/engine/`) is pure TypeScript with
no framework imports; machines (`app/machines/`) are pure data.

## Sources

Machine behavior is grounded in period documentation (see `docs/`): the
Bally Series E service manual (Fey, 1995), Bally Manual 7050 parts catalog
(1981, models E-1202/E-1203), the Bally FO-5140 Double Progressive
instructions (1989), Bally Manual 6000 (1979, electromechanical), the
Massachusetts Gaming Commission Slot Machine Activity Manual v8 (2022),
and a pachislo owner's manual (2006). Weighted virtual reels follow the
Telnaes patent (US 4,448,419, 1984). Reel strips and weights are original
designs calibrated to documented real-world targets.
