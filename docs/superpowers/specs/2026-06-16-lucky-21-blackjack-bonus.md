# Lucky 21 — Blackjack Bonus (double-or-nothing) + reel escalation

**Status:** Approved — planning
**Date:** 2026-06-16
**Supersedes/extends:** `2026-06-15-lucky-21-design.md` (the base stop-the-reels machine)

## Context

Lucky 21 is the `blackjack-reel` machine: five reels spin from load; STOP locks
the next reel left-to-right; CASH OUT banks the best total any time. Reels 1–2
are pure cards (a 2-card hand); reel 3 is a no-cards lock-in bonus; reels 4–5
mix returning cards with multipliers and BUST. Payout = best-total paytable ×
additive multipliers × Five-Card-Charlie, calibrated to ~90% RTP under an exact
optimal-stopping DP (`blackjackReelExactRtp`). The live game now matches the
approved playable-v7 demo (felt cabinet, spinning reels, in-cabinet controls,
result modal with Play Again).

This revision adds two things the owner asked for, and they are calibrated
together because both touch RTP:

1. **Blackjack Bonus** — a *true* 2-card 21 (natural) becomes a special terminal
   event with a guaranteed strong payout, then an optional **double-or-nothing**
   gamble on a chromed bonus reel.
2. **Reel escalation rebalance** — reel 3 gets friendlier (fewer, scattered
   BUST + modest bonuses); reels 4–5 get progressively more dangerous with
   progressively bigger bonuses. All reels' tokens are interleaved so BUSTs are
   never clumped.

## Goals

- A natural blackjack feels like the best moment in the game: it ends the hand,
  pays well, and offers an authentic, tempting gamble.
- The gamble is provably fair (a true 50/50) and **RTP-neutral** — it adds
  variance, not house edge — and the X-ray proves it.
- Reel danger escalates 3 → 4 → 5; bonuses escalate ×2/×3 → ×3/×5 → ×5/×10.
- BUSTs are visually scattered on every reel (no walls).
- Overall machine RTP stays **~90%** under the exact DP; `pnpm verify` green.

## Non-goals

- No gamble feature on non-natural wins (built-up 21, Charlie, or ordinary
  cash-outs do **not** trigger it — keeps "blackjack" special). YAGNI.
- No change to the cash/continue core loop, the Charlie floor, minus cards, or
  the additive-multiplier model.
- No real-money/regulatory framing — this is an educational simulator; the
  gamble is modeled honestly and the X-ray exposes its fairness.

---

## Feature 1 — Blackjack Bonus (double-or-nothing)

### Trigger
A natural: reels 1 and 2 land a 2-card total of 21 (Ace + a ten-value card).
Detected exactly where `natural` is already set today (reel index 1, total 21).
A built-up 21 or a Five-Card Charlie never triggers the bonus.

### Flow
1. Reel 2 locks a natural → the hand **ends immediately** (reels 3–5 are never
   reached; shown dark/not-reached in the recap). Banner: "BLACKJACK!".
2. The guaranteed payout is computed: `base = naturalPay`, then × ante (no
   multipliers — a natural ends before any multiplier reel). This is the
   **strong premium**: `naturalPay` is raised to a clear premium over a regular
   21 (target 5–6; exact value fixed by the calibration in Feature 2 to hold
   ~90% RTP).
3. The player is offered the gamble. A **chromed bonus reel** appears (placement
   + look finalized in the visual companion): half its faces are **×2 (DOUBLE)**,
   half are **BUST**. Two controls:
   - **Collect** → resolve the hand at the current amount.
   - **Gamble** → spin the chromed reel. 50/50:
     - **Win** → amount doubles; `gambleCount += 1`. If `gambleCount` reaches the
       cap (**3**), auto-collect; else offer Collect/Gamble again.
     - **Lose** → amount becomes 0; resolve (lost). The "nothing" half.
4. Resolution books the final amount (which is always a whole number of credits:
   `naturalPay × ante × 2^k`, all integers — the integer-credit invariant holds).

### State (`BlackjackReelSessionState`)
Add a fourth phase and gamble fields:
- `phase: 'idle' | 'spinning' | 'resolved' | 'gamble'` — `'gamble'` is the
  natural-bonus decision state (modal/chromed reel shown, Collect/Gamble live).
- `gambleAmount: number` — credits currently at stake (starts at the guaranteed
  blackjack payout; doubles on each win).
- `gambleCount: number` — doubles taken so far (0..3).
- (existing `natural` flag identifies how we got here.)

### Actions (store + composable)
- `stopReel` change: when reel 2 forms a natural, set `phase = 'gamble'`,
  `gambleAmount = naturalPay × ante`, `gambleCount = 0`, and DO NOT advance into
  reels 3–5. (This is the only new branch in the existing left-to-right stop.)
- `collect()` — only valid in `'gamble'`: books `gambleAmount`, sets
  `phase = 'resolved'` (a win resolution).
- `gamble()` — only valid in `'gamble'` and `gambleCount < 3`: draw a fair bit
  from the live RNG; win → `gambleAmount *= 2`, `gambleCount += 1`, auto-collect
  if at cap; lose → `gambleAmount = 0`, resolve (busted-by-gamble).
- Composable exposes `phase === 'gamble'`, `gambleAmount`, `gambleCount`,
  `canGamble`, `collect()`, `gamble()`.

### RTP-neutrality (why the gamble does not enter the calibration)
A fair 50/50 double-or-nothing has EV equal to the amount staked
(`0.5·2x + 0.5·0 = x`) at every rung, so the player's expected return is exactly
the guaranteed blackjack payout regardless of how far they ladder. Therefore:
- The exact DP (`blackjackReelExactRtp`) and the simulation treat a natural as a
  **terminal** node valued at the guaranteed `naturalPay × ante` (collect). The
  gamble is layered on top of live play only; it changes variance, not RTP.
- The DP must be updated so a natural is terminal (no continue past a natural) to
  match the new "blackjack ends the hand" rule. (Today the DP lets a natural
  continue; under optimal play it almost always cashes, so the RTP change is
  small but must be modeled exactly for verify to stay green.)

### X-ray (honesty surface)
While in `'gamble'`, the X-ray shows: the guaranteed value, and the gamble EV =
exactly the current `gambleAmount` (proving the 50/50 has zero edge — it is a
fair coin-flip, not a trap). This is the teaching payoff.

---

## Feature 2 — Reel escalation rebalance

### Intent (counts set by calibration, not asserted)
- **Reel 3 (no cards, lock-in):** fewer BUST than today, a couple more *modest*
  bonuses (×2/×3) + a minus. The "safer, lock in a small bonus" reel.
- **Reel 4 (mix):** more BUST than reel 3; a *bigger* bonus enters (×3 and ×5).
- **Reel 5 (the big one):** the most BUST; the *biggest* bonuses (×5/×10).
- Danger escalates 3 → 4 → 5; bonuses escalate ×2/×3 → ×3/×5 → ×5/×10.

### Interleaving (visual only)
Every reel's token array is reordered so BUSTs are scattered among cards/bonuses
(no walls). This has **zero** effect on RTP or fairness: the DP counts tokens
(`count/len`) and `stopReel` draws a uniform index — order is irrelevant to the
math, only to the spinning strip's appearance. A unit test asserts the token
*multiset* per reel is unchanged by any future reorder where that matters.

### Calibration
Re-solve to **~90% RTP** with `blackjackReelExactRtp`, accounting for:
- naturals now terminal (Feature 1),
- the raised `naturalPay`,
- the new reel-3/4/5 BUST counts and bonus sets.
Reel-3 BUST is the primary dial; reels 4–5 BUST absorb the rest. The exact
compositions, `naturalPay`, frozen RTP / hit-frequency / variance / bust /
charlie figures are produced by a calibration pass and written into
`app/machines/lucky-21.ts` (header + def) and the frozen-figure test. Sim vs
exact DP must agree inside the 3.5σ band (`pnpm verify`).

---

## Components touched

- `app/engine/types.ts` — `BlackjackReelSessionState` gains `'gamble'` phase +
  `gambleAmount`, `gambleCount`; a `FeatureEvent` for the gamble result.
- `app/engine/blackjackReel.ts` — `stopReel` natural→`'gamble'` branch; new
  `collect()` and `gamble(rand)` step fns; `freshBlackjackState` defaults.
- `app/engine/blackjackReelRtp.ts` — natural is terminal (DP); RTP unaffected by
  the gamble.
- `app/engine/index.ts` — simulation treats a natural as terminal (collect).
- `app/machines/lucky-21.ts` — recalibrated reels (interleaved), `naturalPay`,
  frozen figures + header.
- `app/stores/slots.ts` — `collect()` / `gamble()` actions; restore handles the
  `'gamble'` phase.
- `app/composables/useBlackjackReel.ts` — gamble state + actions + X-ray EV.
- `app/components/game/ReelBlackjackReel.vue` — chromed bonus reel + Collect/
  Gamble UI in the `'gamble'` phase; "BLACKJACK!" banner; scattered reels.
- `app/components/game/XrayPanel.vue` (or PAR) — show the gamble's fair EV.

## Testing

- Eval/step unit tests: natural → `'gamble'` (not continue); `gamble()` win
  doubles + increments + caps at 3 (auto-collect); `gamble()` lose zeroes +
  resolves; `collect()` books the staked amount; integer-credit invariant
  (`naturalPay × ante × 2^k` whole) across antes and rungs.
- DP test: natural terminal; frozen RTP/hit/variance/bust/charlie match; gamble
  not in the RTP path.
- Determinism: a seeded gamble sequence is reproducible via the injected RNG.
- `pnpm verify`: sim RTP inside the DP's 3.5σ band.
- Browser smoke: natural → BLACKJACK → Collect; natural → Gamble win → ladder →
  Collect; natural → Gamble lose → $0; Play Again from each.
- a11y 100/100 (chromed reel decorative/aria, Collect/Gamble reachable + labeled,
  reduced-motion safe); production-CSP clean.

## Open detail (visual companion)

The chromed bonus reel's exact look and placement (offset above the cabinet;
chrome to match the gold/felt frame; ×2 vs BUST face art; the Collect/Gamble
button treatment) is finalized in the visual companion before build.

## Constraints (standing)

Reuse the `blackjack-reel` family in place. Integer-credit payouts only.
`@stylistic` lint (1 statement/line, no trailing commas). Commits off-hours
(outside M–F 7am–7pm); no AI co-author trailer; do not push until the owner
approves. Never touch the sibling `blackjack` project.
