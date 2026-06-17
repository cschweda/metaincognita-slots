# Flameout 21 — blackjack-meets-crash (Lucky 21 rebuild)

**Status:** Approved (playable demo crash-v2) — planning
**Date:** 2026-06-17
**Supersedes:** the Lucky 21 blackjack press-your-luck economy (`2026-06-15-lucky-21-design.md`, `2026-06-16-lucky-21-blackjack-bonus.md`). Keeps the stop-the-reels chassis + the cabinet/chrome. Renames the machine **Lucky 21 → Flameout 21** (id `lucky-21` → `flameout-21`).
**Locked demo:** `.superpowers/brainstorm/16348-1781696554/content/lucky21-crash-v2.html`

## Context

The shipped Lucky 21 (a blackjack press-your-luck) wasn't fun. The 2-card total was *both* the reward and the bust-risk, and the 21 ceiling made a good hand fragile — "totals too low to cash, risk too high to continue." The DP proved three ways that a survivable/fun machine and the ×5/×10 + ×3 Five-Card-Charlie jackpot are mathematically incompatible at ~90% RTP (survivable reels push RTP to 175–625%). The owner chose to **rebuild it as a crash game** — decouple the reward (a climbing multiplier) from any bustable total. Validated by playing the crash demo; the owner confirmed "this one's fun."

## The game — a crash game on the stop-the-reels chassis

Five reels, stopped left-to-right (the kept mechanic). A big **multiplier** climbs from the very first reel; you bank it (bet × multiplier) or lose it all to a **CRASH**.

- **Reels 1–2 (deal + launch).** Each STOP lands a card (honest 52-card shuffle, dealt without replacement) and **sets the multiplier by your hand** — a better running total launches higher (≈ ×1.4 for a stiff up to ≈ ×3.2 for a 20). A **natural 21** (Ace + ten-value across the two cards) is special: the multiplier jumps to a big launch (≈ ×5) and the top climb velocity. The 2-card total also fixes your **climb velocity** for the rest of the run (closer to 21 = steeper). Reels 1–2 never crash — you always get your hand and a launch multiplier.
- **Reels 3–5 (crash climb).** Each STOP is a uniform draw over that reel's strip: a **CLIMB** (multiplier ×= velocity) or a **CRASH** (you lose everything). The crash share **escalates** reel 3 → 4 → 5 (illustratively ~20% → ~33% → ~43%).
- **Cash out** any reel after the deal to lock **bet × current multiplier**. A CRASH → $0. Survive all five → the top multiplier (auto-collect).
- **The hand is the blackjack soul:** it sets both the launch and the velocity, so a hot hand makes every climb steeper — and "cash now or push the crash reel?" is hardest exactly when you're hottest.
- **Decoupled (the fix):** the multiplier is the reward and is **not** a bustable total. Going over 21 does **not** bust — velocity saturates at the 21 level. The only thing that ends a run is a CRASH symbol.

## Bet selector (new)

A bet-size control on the Flameout 21 page: a row of quick-pick chips **$1 · $5 · $10 · $15 · $20** plus a **"Same Bet"** button (re-bet the last amount and deal). Modeled in the existing coin system as denomination **$1** (100¢) with bet **1–20 coins**; the chips select 1/5/10/15/20 coins. Cash-out = **bet × multiplier**, so larger bets put a bigger number on the line. The bet locks when the round starts (first STOP) and is changeable between rounds. A minimal bankroll/credit readout stays visible (the felt page already carries the slim session sidebar).

## Reel-status labels (new)

The per-reel tags under each reel ("+climb", "sets velocity", "climb · ~20% crash", …) are enlarged for legibility so a player can see at a glance what each reel does and how dangerous it is.

## Economy / RTP

Calibrated to **~90% RTP** with an exact DP. A crash game is clean to balance: RTP = E over the 2-card-hand distribution (which fixes the launch + velocity) of the optimal cash/push value, with the per-reel crash probabilities from the strips. The knobs are the **launch-by-total table**, the **velocity-by-total table**, the **natural-launch multiplier**, and the **per-reel crash counts**. The illustrative demo values (launch ×1.4–×3.2, natural ×5, velocity ×1.6–×2.6, crash ~20/33/43%) are tuned at build. The DP also yields the optimal cash/push policy that the X-ray surfaces.

**Payout is cent-denominated.** The multiplier is fractional, so the whole-credit-integer invariant of the prior machines does not apply here: `payoutCents = round(anteCents × multiplier)`. (Flagged for the plan — this is the one structural departure from the existing engine's integer-credit model.)

## Kept / dropped

**Kept:** the bespoke cabinet/chrome (felt/gold/Bungee), stop-the-reels one-by-one, the honest stop (a uniform strip draw *is* the result), the per-reel spin-speed gradient, the Featured card on the floor, the floor-card chrome, Play Again, and the X-ray (now showing the climb EV / the optimal cash-vs-push call — "the casino never shows you this").

**Dropped / replaced:** the blackjack press-your-luck economy (base-by-total paytable, additive multipliers, the ×3 Five-Card Charlie, the qualify-at-15 floor), the over-21 bust, the Blackjack-Bonus double-or-nothing (the crash loop *is* the gamble now; a natural gets the launch multiplier instead), and the result **modal** (replaced by an in-page result card — see below).

## Engine (simpler than the current blackjack-reel)

Only two cards are ever drawn (the deal); reels 3–5 are climb/crash, no cards — so the DP is a clean 2-card-deal distribution feeding a fixed crash/climb tree, not a 5-card deck-depletion enumeration.

- **State:** `phase` (`idle` | `deal` | `climb` | `resolved` | `crashed`), `idx`, `hand` (≤2 cards), `velocity` (number), `multiplier` (float), `crashed` (bool), `anteCents`.
- **Step fns:** `stopReel` — reels 0–1 push a card, set `multiplier = launch(total)` (or the natural launch) and, on reel 1, `velocity = velocityOf(total)`; reels 2–4 draw the strip → CLIMB (`multiplier *= velocity`) or CRASH (`phase = 'crashed'`, payout 0). `cashOut` — resolve at `round(anteCents × multiplier)`.
- **Reels:** reels 1–2 are `CARD` strips; reels 3–5 are `CLIMB`/`CRASH` strips with escalating crash counts.
- **DP / RTP:** backward induction over `(idx, multiplier, velocity)` given the 2-card-hand (launch + velocity) distribution and the per-reel crash probabilities; `rtp = E[optimal-policy payout]`. Yields the cash/push policy + per-state EV for the X-ray.
- **Family decision (for the plan):** either rework the `blackjack-reel` family in place for the crash model or introduce a `crash-reel` family. Given the model is fundamentally different (climb/crash vs. hand-total payout), lean toward a clearly-scoped rework with a renamed id; the plan settles this.

## UI

The crash displays — **Velocity** (from the hand), **Multiplier** (big, climbing), **Cash Out value** (bet × multiplier). Reels 1–2 show dealt cards; reels 3–5 show CLIMB/CRASH tiles. The multiplier climbs from reel 1; the natural launch pops; a crash blows it; cash out any reel. The bet-selector chip row + "Same Bet". Enlarged reel-status labels. An **in-page result card** (not a modal — see below) shows the outcome (Cashed Out / CRASH / Topped Out) with Play Again. Flameout 21 marquee + rebranded chrome. The X-ray shows the optimal cash/push EV and the projected altitude for each remaining reel (the same ladder the side-rail marks visualize).

## Chrome — dynamic rocket sides (new)

Flameout 21's bespoke cabinet chrome (the per-machine `<GameMachineChrome>` frame) gets a **rocket ship climbing each side rail** that visualizes the run's altitude — because the whole game is about going vertical:

- The rockets **rise with the multiplier** — each reel you survive lifts them a notch up a tall side gauge, so the cabinet itself shows how high you've flown (altitude ∝ multiplier). A natural's big launch sends them up immediately.
- On a **CRASH**, the rockets **explode** — an SVG flameout burst at their current height.
- On **cash out / topped out**, they hold at the banked height (a satisfying "you got out here" mark).
- The side gauge carries a **rung for each climb reel — 3, 4, and 5** — at its projected altitude: where a successful climb on that reel would land the rocket (`launch × velocity`, `× velocity²`, `× velocity³`, labelled with the cash value `bet × that multiplier`). The deal reels (1–2) set the base and get no rung. As the player stops each climb reel the rocket rises to that reel's rung, and the rungs still above show the unclaimed height — so deciding whether to cash after reel 3, they *see* the reel 4 and reel 5 marks waiting overhead. The rungs **escalate in danger styling** (reel 3 → 4 → 5, amber → red) so the rising reward visibly carries rising crash risk. The marks are a glanceable echo of the X-ray's exact cash-vs-push EV.

This is the project's first **state-driven** chrome (prior per-machine chrome was static-decorative); it reads the live multiplier/phase via the composable. It stays **decorative + `aria-hidden`** (the projected-altitude ladder it draws is also stated as text in the X-ray, so hiding the chrome from assistive tech withholds no information), **CSP-clean** (inline SVG/CSS, no external assets, no inline scripts), and **reduced-motion-safe** (rockets jump to their height with no animated ascent, and the crash shows a static burst, under `prefers-reduced-motion`). It reinforces the vertical-climb-then-flameout theme without touching the game logic.

## Result card — rocket payoff, not a modal (new)

The run's outcome is shown **in-page on a result card** docked directly **below the cabinet** — no modal overlay to dismiss. The slot is **reserved during play** (neutral/empty, so there's no layout shift) and fills when a run ends:

- **Cashed out / topped out:** the rockets are shown **glowing and triumphant at altitude** with the banked amount (`bet × multiplier`) and the final multiplier — echoing the side-rail rockets at their final height.
- **Crash:** the card shows the **flamed-out rocket** (wreckage + smoke) with "flamed out — $0" — echoing the side-rail explosion.
- The card carries the **Play Again** button; the X-ray stays reachable.

Replacing the modal **keeps the side-rail rockets visible at the payoff** — a centered modal would obscure the vertical rocket chrome exactly when it matters most (the rockets holding at their banked altitude, or the flameout burst). It also lands the rocket theme at the climax and is friendlier for a11y: the card is an **`aria-live` region** that announces the outcome + amount as text (no focus-trap), while the rocket art itself is decorative (`aria-hidden`). It shares the rocket art language with the side-rail chrome.

## Testing

- **Eval/step units:** launch reflects the hand (a higher total launches higher); natural 21 → the special launch; velocity from the 2-card total; climb multiplies by velocity; crash → payout 0; cash → `round(anteCents × multiplier)`; cent-rounding is exact; bet selector sets the ante; over-21 does not bust.
- **DP:** RTP ≈ 90% (frozen figure) under the optimal policy; the policy + per-state EV match the live X-ray.
- **Convergence:** `pnpm verify` — the sim tracks the exact DP inside the 3.5σ band.
- **Browser smoke:** multiplier climbs from reel 1; hand-driven launch (a 19 launches higher than a 12); natural ×5; crash → $0; cash mid-climb; topped out; bet chips + Same Bet; the in-page result card shows the triumphant rockets on a cash/top-out and the flamed-out rocket on a crash (no modal); Play Again.
- **a11y** 100/100; **production-CSP** clean.

## Rename

`lucky-21` → `flameout-21` (id + display name "Flameout 21"). Update the marquee art, chrome registry/theme key, the Featured card, the floor listing, the machine tests, README, CHANGELOG, and og-image copy.

## Open / confirm at review

- Exact calibration values (produced by the DP at build).
- The cent-payout model (vs. the prior integer-credit invariant).
- Family rework-in-place vs. new `crash-reel` family.

## Constraints (standing)

`@stylistic` lint (one statement/line, no trailing commas). Commits off-hours (outside M–F 7am–7pm); no AI co-author trailer; do not push until the owner says so. Never touch the sibling `blackjack` project.
