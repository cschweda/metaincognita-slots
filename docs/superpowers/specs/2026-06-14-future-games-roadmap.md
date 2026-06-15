# Future Games Roadmap (idea capture)

**Date:** 2026-06-14
**Status:** Parked ideas — each needs its own brainstorm → spec → plan before build.

Captured during the Ruby of Gargoyle brainstorm so they aren't lost. Ruby of
Gargoyle (hold-and-spin jewel game) is being built first; see its design spec.

## 1. Blackjack-reel — LEAD candidate for the "reels + cards" game

A press-your-luck blackjack reimagined as a sequential reel game. Folds **two**
parked ideas into one: it *is* the reels-and-cards hybrid AND the crash/stop-or-
bust game.

**Working title (shortlist — final pick during this game's own brainstorm):**
*Hit Me* (leads with the core greed hook — front-runner), *One More Card*,
*Reel 21*, *Press Your 21*. "Five-Card Charlie" is retained as the
**bonus-feature** name (survive all five reels), whatever the game is titled.

**Core loop:** Five reels. Spin reel 1 → first card, reel 2 → second card, then
choose **stand or spin again**. Each additional reel adds a card; going over 21
busts. Multiplier/bonus symbols on the reels mean any spin can juice the payout —
so the player is tempted to hit *even on a strong hand*. The tension (against your
own better judgment) is the whole point.

**Design decisions / suggestions:**
- **No dealer. Pay by final hand value** (paytable: 21 best, then 20, 19…; bust =
  nothing). Keeps it a *slot* (player vs. paytable), avoids a second RNG, and
  makes reel multipliers coherent. Keeps it cleanly separate from the standalone
  blackjack *project*.
- **Five-card Charlie:** survive all five reels without busting → bonus payout.
  The reel count caps the hand at five, so this is the natural pinnacle; rewards
  the keep-hitting line and gives reel 5 a purpose.
- **Aces (1/11)** are the built-in tension; **multiplier cards** scale the hand
  payout; a rare **"Bust Save"** symbol forgives one bust (a volatility lever —
  use sparingly).
- **Math = the hard, interesting core.** Weighted strips let you engineer exact
  RTP and bust-frequency. But RTP depends on *when the player stands*, so it's
  computed under **optimal stopping strategy** — the same way video-poker par
  sheets assume optimal play. Tractable, with precedent.
- **New family.** Sequential reveal + player stop-decisions + hand evaluation +
  strategy-aware RTP is unlike all four current families. The most ambitious
  build on the floor; plugs into the same three seams (`def` type, `spin()`
  dispatch, `Reel<Family>.vue`) as the others.

## 2. Crash / cash-out machine ("stop or bust")

Player stops the reels; each stop banks money; a bad stop busts and loses it all;
cash out anytime. A new family. NOTE: distinct from the existing pachislo
skill-stop, whose wins are protected and never lost. **Largely subsumed by the
blackjack-reel idea above** if that gets built — revisit only if a pure,
card-less crash variant is still wanted. **(2026-06-14: now wanted — see Galactic Flameout below.)**

### 2a. Galactic Crash — pure crash variant (working title; was "Galactic Flameout"; user-requested + refined 2026-06-14; needs its own brainstorm → spec → plan)

Space theme. **Two buttons: Spin and Cash Out.** Structure: **four "climb" reels + a separate fifth multiplier reel.** Each spin either survives ("still flying") and grows the running payout, or **crashes** and ends the run with **nothing** — and your winnings stay **fully at risk until you cash out** (cash out anytime to bank what you've climbed and end the run). Push through all four climb reels and you can go for the **fifth = multiplier reel**, the big score (it multiplies the haul) — but reel 5 still carries crash risk. So **cashing out before reel 5 banks a smaller, safer amount**; the deep multiplier payouts are bigger but the odds of reaching them are slim. A **bounded crash** (max 5 steps).

Open design notes for its brainstorm:
- **Flameout must be RANDOM per spin** (you never know which reel flames out) — not a fixed flameout reel, or it's deterministic.
- **RTP** = per-spin flameout odds + the multiplier ladder under **optimal cash-out timing** — the same optimal-stopping / exact-EV machinery as Hit or Bust (tractable).
- **Distinct from pachislo skill-stop**, whose banked wins are never lost — here *everything* is at risk until you cash out.
- **Naming:** the metaincognita family already has a sibling game called *flameout* — decide whether "Galactic Flameout" is a deliberate slots-floor homage/tie-in or needs a distinct name.
- **Differentiate from Hit or Bust** (both are press-your-luck): this one is card-less / pure multiplier-ladder, simpler and faster — make sure they don't feel like two skins of one idea.
- Gets bespoke cabinet chrome via the v0.7.0 chrome system (space/neon — a natural for gaudy flair).

## 3. Authentic 4-tier progressives (Mini / Minor / Major / Grand)

Generalize the single-progressive system to multiple scaling jackpot pools — the
fully authentic Dragon Link feel. A meatier engine generalization; a natural
*next* evolution of the hold-and-spin line after Ruby of Gargoyle ships.
