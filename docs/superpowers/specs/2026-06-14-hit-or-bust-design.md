# Hit or Bust — Design Spec

**Date:** 2026-06-14
**Status:** Approved (brainstorm) — pending spec review
**Author:** cschweda + Claude

## Summary

**Hit or Bust** — press-your-luck blackjack reimagined as a five-card-reel slot. Ante one bet; the machine deals two cards (reels 1–2), then you **Hit** (reveal the next card) or **Stand** (lock your payout). Going over 21 **busts** and loses the ante — unless a rare **Bust-Save** fires; surviving all five cards is the **Five-Card Charlie** bonus. There's **no dealer**: you play against a paytable that scales with hand value, and **additive multiplier cards** tempt you to hit even a strong hand. It's a **new machine family** with strategy-aware (optimal-stopping) **exact RTP**, plus its own bespoke "card-room glam" cabinet chrome (via the v0.7.0 chrome system).

The signature tension is *greed against your own better judgment*: a 20 pays well, but one more card might bust it — or land a multiplier and juice the whole hand.

## Goal & Non-Goals

**Goal:** A distinct, shippable blackjack-reel machine in the ~90% RTP band, with exact RTP computed under optimal play, the Five-Card Charlie bonus, additive multipliers, a forgive-and-continue Bust-Save, a full Hit/Stand sequential-reveal UI, and bespoke chrome.

**Non-Goals:**
- **Not the standalone blackjack project** — no dealer, no second hand, no 52-card deck, no card counting. It's a *slot*: player vs. paytable, **weighted independent reel strips** (with replacement).
- No table-blackjack actions (no splits, doubles, insurance, surrender) — it's press-your-luck, not table play.
- No changes to the other four families' engine paths beyond *additively* extending the family-dispatch seams.
- The chrome **reuses** the shipped v0.7.0 system (a new chrome module + palette + registry line) — not a chrome-system change.

## Decisions Locked (from brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Title / bonus | **Hit or Bust**; bonus = **Five-Card Charlie** (survive all 5) |
| 2 | Win model | **Scaling paytable** by final hand value (bust = 0) |
| 3 | Multipliers | **Additive** (×2 + ×3 = ×5) on the final hand payout — same model as Ruby's Gargoyle's Eye |
| 4 | Bust-Save | Rare; **forgive & continue** (void the busting card, the run lives on) |
| 5 | Card model | **Weighted per-reel strips** (slot, with replacement; not a deck), standard blackjack values, **Ace 1/11** |
| 6 | Bet | **One ante per hand** (selectable coins 1..maxCoins, payouts scale linearly); hits are free reveals; bust loses the ante; stand wins payout × mult |
| 7 | RTP | **Exact backward-induction DP under optimal stopping**; ~90% band |
| 8 | Family | **New family** `blackjack-reel`; bespoke cabinet chrome |

## Core Loop

1. **Ante** a bet (1..maxCoins) and start the hand.
2. Reels 1 & 2 spin → the first two cards (auto-dealt, no decision).
3. **Decision point** (after 2, 3, and 4 cards): **Stand** → lock payout = `paytable(handTotal) × multiplier × bet`, hand ends. **Hit** → reel for the next card.
4. If a card pushes the minimum total **> 21** → **bust** (payout 0) — unless a Bust-Save is held, which **voids that card** and the run continues.
5. Reaching **card 5** without busting ends the hand as a **Five-Card Charlie** (bonus payout). (Reel 5 has no further hit decision — it's the cap.)

So there are exactly **three** hit/stand decisions (take card 3? 4? 5?).

## Card & Hand Model

- **Five weighted strips**, one per reel (slot-style sampling *with replacement* — independent reels, no deck, no counting). Per-reel strips (not a shared distribution) so the bust curve and Charlie rate are tunable reel-by-reel (e.g. reel 5's weights set the Charlie frequency).
- **Ranks & values:** `2–9` = face value, `10/J/Q/K` = 10, **Ace = 1 or 11** (the hand evaluates to the best total ≤ 21; "soft" while an ace counts as 11).
- **Special symbols on the strips** (at tuned weights), drawn like any card:
  - **Multiplier card** (`×2`, `×3`, …) — contributes 0 to the hand total, adds its face to a running **additive** multiplier on the final payout.
  - **Bust-Save** (rare) — grants/holds one save (see above). Contributes 0 to the total.
- Hand state = `(hardTotal, isSoft, multiplierSum, saveHeld, cardsDrawn)`.

## Math — Exact RTP under Optimal Stopping

RTP is computed under **optimal play**, exactly as a video-poker par sheet assumes the optimal strategy.

- **Approach (chosen): exact backward-induction DP.** Enumerate the decision tree over the state `(cardsDrawn, hardTotal, isSoft, multiplierSum, saveHeld)`. At each decision node:
  `EV(stand) = paytable(bestTotal) × max(1, multiplierSum)` (a hand with no multiplier cards pays ×1) ; `EV(hit) = Σ_over_next_reel ( weight(symbol) × EV(resulting state) )`, where a busting draw yields 0 (or the save branch). The node's value is `max(EV(stand), EV(hit))`, and the boundary is card 5 (forced stand → Charlie payout) and bust.
  Whole-game **RTP = EV(at the two-card deal) ÷ ante**. The state space is small and bounded (≤ 5 cards; totals ≤ ~30; bounded multiplier sums; one save flag), so it enumerates exactly — **no second RNG, no Monte-Carlo**.
- **Rejected:** Monte-Carlo of optimal play (approximate; we want an exact par sheet); a fixed/heuristic strategy (not truly optimal → weaker, less honest RTP).
- **Tuning:** the per-reel strip weights are the knobs to hit the **~90% band**; the additive-multiplier and Charlie/Save weights are volatility levers. Freeze the calibrated values into tests (the project's "design strips → freeze exact values" pattern).
- **Educational payoff:** the **PAR sheet** renders the derived **optimal hit/stand strategy table** (e.g. "stand on hard 17+, hit soft 17 with a live multiplier…") and the exact **bust** and **Five-Card Charlie** probabilities; the **X-ray** can show the live EV(hit) vs EV(stand) at the current decision — a genuinely new "the math the casino never shows" surface.

## Engine Architecture

Plugs into the same three seams as every existing family, plus new pure modules:

- **`def` type:** `BlackjackReelMachineDef` (family `'blackjack-reel'`): the 5 weighted strips, rank→value map, special-symbol configs (multiplier faces + weights, bust-save weight), the value paytable, the Five-Card Charlie bonus, bet range.
- **`spin()` dispatch:** `spinBlackjackReel()` in the `spin()` exhaustive switch — but because this family is **interactive** (hit/stand mid-hand), the store drives it as a sequence: a "deal" produces cards 1–2 + the decision state; each "hit" reveals the next card; "stand"/bust/Charlie resolves the payout. Model this as small engine steps (`dealHand`, `hitCard`, `resolveHand`) the store orchestrates, mirroring how pachislo's multi-step flow is handled. The per-step RNG uses the existing seedable PRNG.
- **Reel surface:** `ReelBlackjackReel.vue` (auto-imported `<GameReelBlackjackReel>`), wired into `game.vue`'s family switch (and inside `<GameMachineChrome>` like the others).
- **New pure modules** (fully unit-testable, no Vue): hand evaluation (soft-ace best total, bust), the **optimal-strategy solver** + **exact-RTP enumerator** (the DP above), and the family's `exactRtp` integration.
- **`simulateMachine` / `exactRtp`** extend to the new family (simulate plays the optimal strategy so its empirical RTP converges to the exact value — a built-in cross-check).
- **Floor:** add the machine to `FLOOR` (10th machine); update the family groupings on the floor + the counts that tests assert.

## UI / Interaction

- Sequential card reveal across the five reel positions (reuse `useReelSpin`/reveal patterns; cards flip/land one at a time).
- **Hit** and **Stand** controls (Hit disabled after card 5 / on resolve; keyboard: Space/Enter sensible defaults, distinct from pachislo).
- Live **hand-total** readout showing soft/hard (e.g. "7 / 17"), the running **additive multiplier**, a **Bust-Save held** indicator, and a **Five-Card Charlie** celebration on the result bar.
- Reuses the existing result bar + session sidebar + PAR/X-ray surfaces.

## Chrome (bespoke, via the v0.7.0 system)

A `BlackjackReelChrome.vue` module + `chrome/theme.ts` palette + `chrome/registry.ts` entry: **green-felt card-table** backdrop, **gold table trim**, a neon **"HIT OR BUST · 21"** sign, **playing-card suit** ornaments (♠♥♦♣) at the corners, a **chip-stack** flourish — gaudy card-room glam, subtle motion, `aria-hidden` + `pointer-events:none` like the others. Reuses the shipped chrome system entirely (no system changes).

## Testing & Gates

- **Pure-engine tests:** hand evaluation (soft aces, multiple aces, bust boundary), additive multiplier, Bust-Save forgive-and-continue, Charlie at 5.
- **Optimal-strategy solver** tests (known small cases) and **exact-RTP enumeration** tests, with a **convergence cross-check**: `simulateMachine` playing the optimal strategy converges to the exact RTP (within SE) — the family's built-in honesty check.
- **Frozen values:** the calibrated ~90% RTP, bust frequency, and Charlie rate frozen into tests.
- **Component tests:** the reel surface + Hit/Stand flow (deal → hit → stand/bust/Charlie).
- **Mandatory browser smoke:** play a hand end-to-end (hit, stand, bust, Charlie, multiplier, save), the chrome renders, console clean; **a11y 100/100**; chrome smoke.
- **Per-task gates:** `pnpm lint` + `pnpm typecheck` + `pnpm test`.

## Risks & Mitigations

- **Strategy-aware RTP is the hard part** → small bounded state space + exact DP + the video-poker precedent; the simulate-under-optimal cross-check catches solver bugs.
- **Calibrating ~90% with multipliers + Charlie + Save** → per-reel strip weights as knobs; design/freeze in a calibration script (the established pattern); Save and high multipliers kept rare.
- **New family touches floor count + family-dispatch + tests** → exhaustive `switch` with `never` check (existing convention) surfaces every dispatch site at compile time.
- **Soft-ace evaluation correctness** → dedicated tests for multi-ace and soft/hard transitions.

## Open / Future (out of scope now)

- Selectable-bet UI specifics (1..maxCoins) — payouts scale linearly so RTP is bet-independent.
- Table-blackjack extras (splits/doubles) — deliberately excluded; would change the genre.
- The other parked roadmap items (pure crash/cash-out; authentic 4-tier progressives) remain parked.
