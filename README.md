# Metaincognita Slots

An educational slot machine simulator — part of the Metaincognita Casino
family (hold'em, video poker, craps, blackjack, flameout). Play authentic
machine archetypes, then see exactly what the casino never shows you: the
reel strips, the Telnaes virtual-reel weights, the engineered near-misses,
and the precise mathematics of the house edge.

**Status: engine milestone.** The headless engine, eight calibrated machines,
and the statistical verification harness are complete. The playable UI,
X-ray mode, Sim Lab, and learn pages land in subsequent milestones.

## The floor

| Machine | Family | Format | Exact RTP |
|---|---|---|---|
| Diamond Doubler | Telnaes stepper | 3 reels, wild 2x/4x multiplier | 94.7442% |
| Sevens Ablaze | Telnaes stepper | 3 reels, 2-coin, percent-fed progressive | 94.4881% @ reset + 1%/coin-in feed |
| Series E 3-Line | Vintage Bally (E-1202 replica) | 5 reels x 22 uniform stops, 3 lines, dual toggling progressive | 89.0351% per line |
| Series E Multiplier | Vintage Bally (E-1203 replica) | 4 reels x 25 uniform stops, 1-3 coin multiplier | 89.1264% @ 3 coins / 85.0304% @ 1 |
| Canal Royale | Video (lines) | 5 reels x 24 stops, 25-line, free spins | 92.4559% |
| Dragon's Hoard | Video (ways) | 5 reels x 24 stops, 243-ways, free spins w/ retriggers | 93.9950% |
| Thunder Vault | Video (lines) | 5 reels x 24 stops, 25-line, Grand progressive | 90.2948% @ Grand reset |
| Stock Rush | Pachislo (skill-stop) | 3 reels x 21 stops, flag lottery, stock queue | 66.0012%–120.0028% by operator level (L4 default 91.5013%) |

Every RTP shown is **computed** from the machine definition by exact
enumeration (`exactRtp`) — never asserted — and verified by seeded
multi-million-spin simulation.

## Stepper (Telnaes virtual-reel)

Classic 3-reel cabinets with Telnaes virtual reels: each physical stop maps
to one or more virtual stops, giving the designer precise RTP control without
increasing the physical reel size. Diamond Doubler uses a wild symbol that
multiplies 2x/4x. Sevens Ablaze adds a percent-fed progressive whose meter
grows with every coin wagered.

## Bally E-series (electromechanical)

Uniform-stop mechanical reels with no virtual layer — the math is pure
combinatorics. The E-1202 pays three independent lines; the E-1203 uses a
1-3 coin multiplier. Both use the FO-5140 dual-toggling progressive
controller documented in the Bally service manuals.

## Video (lines / ways / hold-and-spin)

24-cell strips so the full 24⁵ cycle is exactly enumerable; line and ways
evaluation anchored on reel 1; free-spin EV via Wald/branching identities;
hold-and-spin via an absorbing Markov chain; Thunder Vault's Grand is a
percentage-fed progressive.

## Pachislo (skill-stop)

The lottery decides, the reels obey: flags stock and are never lost, control
slips ≤ 4 stops, and an exhaustive 21³ check proves no win can land without a
flag — so your timing changes *when*, never *how much*. Six operator odds
levels straight from the manual's bands (65–67% up to 115–125%).

## Verification

```bash
pnpm install
pnpm test          # unit + frozen-calibration + convergence suites
pnpm verify        # headless floor verification report (5M cycles/machine)
```

`pnpm verify` now covers 8 machines and prints a jackpot-column footnote
distinguishing progressive meter hits (Bally, Thunder Vault Grand) from
pachislo bonus flags. Convergence tests include video cycle-SE cases and
pachislo block-SE at levels 1/4/6.

Full-run table (5M cycles/machine, seed 20260612):

```
machine               coins   exact RTP    sim RTP      Δ           HF exact     HF sim      jackpots  σ-band
canal-royale           25     92.4559%    92.3114%     0.1446%    55.5343%    55.5288%         0  PASS
dragons-hoard          25     93.9950%    93.8912%     0.1038%    53.5534%    53.5202%         0  PASS
thunder-vault          25     90.2948%    90.2476%     0.0471%    41.2899%    41.3153%       947  PASS
diamond-doubler         3     94.7442%    94.3475%     0.3967%    14.6675%    14.6593%         0  PASS
sevens-ablaze           2     94.4881%    94.8581%     0.3700%    15.7193%    15.7259%       369  PASS
series-e-3line          1     89.0351%    89.0187%     0.0164%    11.8144%    11.8206%         0  PASS
series-e-multiplier     3     89.1264%    89.7747%     0.6483%    14.2559%    14.2505%       214  PASS
stock-rush              3     91.5013%    91.1733%     0.3280%    21.2341%    21.2506%         0  PASS
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
