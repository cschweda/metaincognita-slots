# Lucky 21 — Design Spec

**Date:** 2026-06-15
**Status:** Approved — planning
**Author:** cschweda + Claude
**Replaces:** Hit or Bust (the 10th machine / `blackjack-reel` family)

## Summary

**Lucky 21** — a press-your-luck card-reel slot. **Five reels spin at once**; you press **STOP** to lock them one at a time (the symbol on the gold payline is *exactly* what you get — no slip), or **CASH OUT** at any moment. Reels 1–2 are pure cards (your starting blackjack-style total); reels 3–5 introduce **multipliers**, **minus cards**, and **BUST** symbols at escalating risk. Get as close to **21** as you dare without going over; you can also bust by landing a **BUST** symbol. Your **cash-out value climbs toward 21 and never drops** (a high-water "best total" drives it) — so every stop is a genuine *bank it or push it* dilemma. Survive all five reels for the **Five-Card Charlie ×3**.

It replaces Hit or Bust as the card machine: same "card-reel slot, no dealer" spirit, but a **stop-the-reels** loop instead of hit/stand, an **honest shuffled 52-card deck** (no duplicate card in a hand), and a **qualify-at-15 economy**. The whole game was designed and validated through a playable browser prototype (see *Reference Prototype* below).

The signature tension: a strong early total is *trapped* by cards (any card busts a 20), so reel 3 lets you **lock in a multiplier with no card risk** — then reels 4–5 are the real gauntlet.

## Goal & Non-Goals

**Goal:** A distinct, shippable card-reel machine in the **~90% RTP band**, with exact RTP under optimal stopping (deck-depletion model), the honest stop-the-reel mechanic, the five reel *roles*, the qualify-at-15 dollar economy, Five-Card Charlie, additive multipliers, and bespoke "card-room glam" chrome — replacing Hit or Bust.

**Non-Goals:**
- **Not table blackjack** — no dealer, no splits/doubles/insurance, no second hand. Player vs. paytable.
- **No skill-stop exploit** — the reel is fast enough that the honest payline read is effectively uniform-random; outcomes are not reliably timeable. No reel-control / slip either way.
- **No hit/stand** — the Hit-or-Bust hit/stand engine, Bust-Save, and its independent-strip DP are **removed**, not extended.
- Chrome **reuses** the shipped v0.7.0 system (new/reworked module + palette + registry line), not a chrome-system change.

## Decisions Locked (from brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Title | **Lucky 21** (replaces Hit or Bust; takes the 10th machine slot) |
| 2 | Core loop | **5 reels spin at once; STOP locks the next reel; CASH OUT anytime.** No hit/stand, no deal step |
| 3 | Honest stop | The symbol on the **payline at STOP is the result** — no slip, no re-draw; reel settles to center on it |
| 4 | Honest deck | **One 52-card deck, Fisher–Yates shuffled each game, dealt without replacement** — a physical card can land on at most one reel per hand |
| 5 | Reel roles | 1–2 **pure cards**; 3 **lock-in bonus (no cards)**; 4 **mix (cards return)**; 5 **the big one** |
| 6 | Two bust conditions | **Total > 21**, *or* land a **BUST** symbol |
| 7 | Minus cards | **−2 / −3** subtract from the total (floored at 0) — buys "safe room"; on reels 3–4 only |
| 8 | Multipliers | **Additive** (×2 + ×3 = ×5); big **×5/×10** specials on reel 5 |
| 9 | Aces | **1 or 11** (soft); dual display "**7 or 17**", collapsing to one number once 11 would bust |
| 10 | Cash-out value | **Always shown in dollars** from the first card; tracks closeness to 21 and **only ratchets up** (driven by best total reached) |
| 11 | Qualify-at-15 economy | **Under 15 pays nothing**; **15 returns the bet**; climbs to 21; **natural** (2-card 21) premium |
| 12 | Five-Card Charlie | **Survive all five reels → ×3** on the payout, *and* **guarantees qualification** (floors the base at the 15-rung) so an earned multiplier/survival never resolves to $0 |
| 13 | RTP | **Exact backward-induction DP under optimal stopping, with deck depletion**; ~90% band; MC cross-check |
| 14 | Family | **Reuse the `blackjack-reel` family id**, replacing its engine/def/UI/chrome with Lucky 21 (confirmed) |

## Core Loop

1. **Ante** a bet (1..maxCoins; payouts scale linearly). All **five reels spin** immediately.
2. **STOP** locks the next spinning reel (reel 1, then 2, …, 5) onto whatever is on the payline. A short settle animation centers the landed symbol; that symbol is applied.
3. After each stop, the **Score** (toward 21) and **Cash Out value** (dollars) update. **CASH OUT** at any time ends the hand and pays the current value.
4. **Bust** ends the hand at $0 if the landed card pushes the total **> 21**, or if the landed symbol is a **BUST**.
5. Stopping all **five reels** without busting is the **Five-Card Charlie** (auto-resolve, ×3, qualification guaranteed).

So decisions are continuous: after every stop, *cash the current value or risk the next reel*.

## Reel Roles & Composition

Each reel has a **role**, expressed as its symbol mix (illustrative counts from the prototype; final counts are RTP-calibration knobs):

| Reel | Role | Mix (illustrative) |
|------|------|--------------------|
| 1 | **Deal** | Pure cards (deck draw) |
| 2 | **Deal** | Pure cards (deck draw) → guaranteed 2-card starting total (can't bust on ≤2 cards) |
| 3 | **Lock-in bonus — no cards** | mostly **×2/×3**, some **−2/−3**, a little **BUST** — boost a strong total with **no card-bust risk** |
| 4 | **Mix — risk returns** | **cards** + ×2/×3 + one −3 + **BUST** — high totals can card-bust again |
| 5 | **The big one** | big **×5/×10** + lots of **BUST** + a few cards, **no minus** — survive = Charlie |

Emergent strategy this creates: **high totals love reel 3** (lock a multiplier safely) but **fear reel 4** (cards bust them); **low totals need reel 4's cards** to reach the qualifying 15. Risk and reward both climb left→right.

## Card & Hand Model

- **52-card deck**, shuffled fresh per hand; each reel's card slots are filled from the deck **without replacement**, so the landed hand never contains a duplicate physical card.
- **Ranks & values:** `2–9` face value, `10/J/Q/K` = 10, **Ace = 1 or 11** (best total ≤ 21; "soft" while an ace is 11).
- **Special symbols** (reel-3+): **multiplier** (`×2/×3/×5/×10`, additive, contributes 0 to total), **minus** (`−2/−3`, subtracts from the hard total, floored at 0, contributes 0 otherwise), **BUST** (instant loss).
- **Best total (high-water):** the cash-out value is driven by the **highest total reached**, not the current total. A minus lowers your *current* total (safe room to keep stopping) but never the **banked value** — "money only goes down on a bust."
- Hand state = `(hardTotal, aceCount, multiplierSum, bestTotal, reelIndex)`.

## Economy — Qualify-at-15, dollars, ratcheting

The cash-out value is a **paytable on the best total**, shown live in dollars (the prototype used a $5 bet; the real machine uses the project's coins/credits × denomination, scaling linearly with the bet):

- **Under 15 → $0** (Jacks-or-Better-style qualifier — you can't cash a junk 2-card hand for your money back).
- **15 → bet back** (even money); payouts **climb to 21** (illustrative $5-bet curve: 15→$5, 16→$8, 17→$12, 18→$17, 19→$23, 20→$30, 21→$40, **natural→$55**).
- **Payout** = `paytable(bestTotal) × max(1, multiplierSum)`, **ratcheted** (never decreases) until cash-out or bust.
- **Cash-out value is always displayed** (in dollars) from the moment reel 1 stops; a "**reach 15 to win**" hint shows while sub-15 ($0).
- **Five-Card Charlie:** surviving all five reels applies **×3** to the payout **and floors the base at the 15-rung**, so a survived-but-sub-15 hand with earned multipliers still pays (never $0). (Confirmed acceptable that a survived sub-15 hand can win via the floor × multipliers; a *qualifying* total still pays multiples more.)

All exact curve values, the natural premium, and the Charlie multiplier are **RTP-calibration knobs**.

## Math — Exact RTP under Optimal Stopping (deck depletion)

RTP is computed under **optimal play** (like a video-poker par sheet), but with **deck depletion** because cards are dealt without replacement.

- **Outcome model.** The honest stop = uniform over a reel's strip positions. By symmetry of the uniform shuffle + uniform landing, the **landed cards across reels are equivalent to dealing one card per card-reel from a shuffled 52-deck without replacement** (the unlanded "flavor" cards don't change the landed joint distribution). Special reels contribute specials at their fixed per-reel strip probabilities.
- **Approach (chosen): exact backward-induction DP.** State = `(reelIndex, hardTotal, aceCount, multiplierSum, bestTotal, remaining-deck-by-value)`. Collapse the deck to **counts by blackjack value** (aces; 2–9; and the aggregated 10-group) — only ≤5 cards are ever drawn, so the reachable deck compositions are bounded and the enumeration is exact. At each reel:
  - `EV(cash) = paytable(bestTotal) × max(1, multiplierSum)` (0 if sub-15 and not a completed Charlie).
  - `EV(continue) = Σ outcomes ( P(outcome | reel, remaining deck) × EV(next state) )`, where BUST/over-21 → 0, a card depletes the deck, a multiplier raises the sum, a minus lowers the total.
  - Node value = `max(EV(cash), EV(continue))`; boundary = reel 5 resolve (Charlie ×3 + floor) and bust.
  - **RTP = EV(start) ÷ bet.**
- **Cross-check:** `simulateMachine` plays the DP-optimal strategy; empirical RTP converges to the exact value (built-in honesty check).
- **Knobs:** per-reel symbol counts (cards/mult/minus/bust), the paytable curve, natural premium, Charlie ×, multiplier faces/frequencies, the 15 floor. Freeze calibrated values into tests (the project's "design → freeze exact values" pattern).
- **Educational payoff:** the **PAR sheet** can render the optimal cash/continue strategy by `(reel, total, multiplier)` and the exact **bust / Charlie / qualify** probabilities; the **X-ray** shows live `EV(continue)` vs `EV(cash)` at each reel.
- **Fallback (only if depletion proves intractable):** independent per-reel strips *with replacement* (clean, but a card could repeat in a hand). Recorded as a deliberate tradeoff; primary plan is the honest deck.

## Engine Architecture

**Decision (confirmed): reuse the `blackjack-reel` family id and replace its internals** (the family is still a card-reel game, so the name fits, and it avoids threading a brand-new family through every dispatch seam / floor count / test). The family id, `spin()`/`exactRtp`/`simulateMachine`/`verify-floor` dispatch seams, and the floor slot are **kept**; the hit/stand engine, Bust-Save, the independent-strip DP, and the Hit-or-Bust machine def are **replaced in place**.

- **Reuse:** soft-ace hand evaluation primitives (`applyCard`/`bestTotal`/`evaluateHand` from `blackjackReel.ts`) — Lucky 21 needs the same soft-ace math and dual display.
- **Remove:** hit/stand step (`hitCard`/`standHand`), Bust-Save, the independent-strip optimal-stopping DP in `blackjackReelRtp.ts`, and the Hit-or-Bust machine def.
- **Add (pure, unit-testable):** deck build + shuffle; per-reel composition → dealt strips; the **stop-reel step** engine (`dealReels`/`stopReel`/`cashOut`/`resolveCharlie`); minus + BUST-symbol handling; best-total ratchet + qualify-at-15 payout + Charlie floor; the **deck-depletion exact-RTP DP** and its `exactRtp` integration.
- **`def` type:** extend/replace `BlackjackReelMachineDef` for Lucky 21 — reel *compositions* (card-slot counts + special weights per reel), the value paytable, qualify threshold, natural premium, Charlie multiplier, multiplier faces, bet range.
- **Store / dispatch:** like Hit or Bust, this family is **interactive** (multi-step), so the store orchestrates `deal → stop ×N → cash/charlie/bust` over the seedable PRNG (mirrors pachislo's multi-step flow).
- **`simulateMachine` / `exactRtp` / `verify-floor.ts`:** extend to the new mechanics; **verify-floor must cover this family** (a prior gap on the old blackjack-reel family — don't repeat it).
- **Floor:** Lucky 21 replaces Hit or Bust in `FLOOR` (still 10 machines); update family groupings + any asserted counts.

## UI / Interaction

- **Five spinning reels** with a center **payline**; STOP settles the landed symbol to center; un-stopped reels keep spinning; on bust/end, remaining reels **go dark** (clearly over).
- Controls: **STOP** (locks next reel) and **CASH OUT** (always available); keyboard defaults distinct from pachislo.
- **Hero displays:** **Score** with soft/hard dual readout ("7 or 17"), and **Cash Out value in dollars** with a "from your $5 bet" / "reach 15 to win" subline.
- **Cards as a unified deck look:** real playing-card tiles for numbers/faces; specials (`×`, `−`, **BUST**) as same-shaped colored cards; **BUST is an SVG explosion** starburst.
- **Result modal** (win / Charlie / lose): a **five-reel recap row** (every reel's landed symbol, un-reached reels dashed) + the breakdown chips (`base × multiplier (× Charlie) → $`) + the **dollar payout as the hero**; bust shows the over-21 total or BUST card and the lost bet.
- Reuses the result bar + session sidebar + PAR/X-ray surfaces. Reduced-motion safe.

## Chrome (bespoke, via the v0.7.0 system)

Rework `BlackjackReelChrome.vue` (or a new `Lucky21Chrome.vue`) + `chrome/theme.ts` palette + `chrome/registry.ts` entry: gaudy **"weird-Vegas" card-room glam** — green-felt + heavy gold trim, a glowing **"LUCKY 21"** marquee with bulb lights, suit ornaments, chip flourishes; `aria-hidden` + `pointer-events:none`, subtle + reduced-motion-safe. Reuses the shipped chrome system entirely.

## Testing & Gates

- **Pure-engine tests:** soft-ace evaluation (multi-ace, soft/hard transitions, dual display), minus flooring, additive multipliers, two bust conditions (over-21 and BUST symbol), best-total ratchet (minus never lowers the bank), qualify-at-15 ($0 under 15; 15 = bet; natural premium), Charlie ×3 + qualification floor (the "survived + multipliers must never pay $0" case from playtesting).
- **Honest-deck tests:** shuffle is a permutation; no duplicate card across a dealt hand; landed-card distribution matches without-replacement expectation.
- **RTP:** exact deck-depletion DP tests (small known cases) + **simulate-under-optimal convergence** cross-check; **frozen** calibrated ~90% RTP, bust rate, Charlie rate.
- **Component tests:** reel surface + stop/cash flow (stop ×5, cash, bust by over-21, bust by symbol, Charlie); result-modal recap.
- **Mandatory browser smoke:** a full hand each way (cash, over-21 bust, BUST-symbol bust, Charlie, multiplier stack, minus), chrome renders, console clean under the production CSP, **a11y 100/100**.
- **Per-task gates:** `pnpm lint` + `pnpm typecheck` + `pnpm test`. **verify-floor** must include this family.

## Risks & Mitigations

- **Deck-depletion strategy-aware RTP** is the hard part → value-collapsed deck state + ≤5 draws keeps it exact and bounded; simulate-under-optimal cross-check catches solver bugs; documented independent-strip fallback if needed.
- **Calibrating ~90%** with multipliers + Charlie floor + qualify threshold → many knobs; freeze in a calibration script; keep big multipliers and Charlie rare; the **reel-3 BUST count** is a key dial (it's currently player-friendly).
- **Replacing a shipped, tested machine** (Hit or Bust) → remove its modules/tests cleanly; reuse the soft-ace primitives; ensure verify-floor + floor counts updated (and the prior verify-floor gap not repeated).
- **Honest-stop must not be timeable** → tuned reel speed; the RTP model assumes uniform landing (document the assumption; the production stop reads the live payline with no slip).
- **Floor/qualify edge cases** (sub-15 Charlie, minus to 0, all-minus run) → explicit tests (these surfaced in playtesting).

## Reference Prototype

The full, playable reference built during brainstorming:
`.superpowers/brainstorm/77250-1781533452/content/lucky21-playable-v7.html` (honest deck, stop-the-reels, qualify-at-15 economy, Charlie floor, result recap, explosion BUST). It is the behavioral source of truth for the rules above.

## Open / Future (out of scope now)

- Final calibrated curve, reel compositions, natural premium, and Charlie multiplier (the RTP pass).
- "Total carries more weight in a Charlie" variant (scale the survival base by actual total) — deferred; flat 15-floor for now.
- Selectable-bet UI specifics — payouts scale linearly, RTP is bet-independent.
