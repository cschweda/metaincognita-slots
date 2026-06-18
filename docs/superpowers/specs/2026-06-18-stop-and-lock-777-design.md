# Stop & Lock 777 — player-stopped hold-and-spin (the Featured "big daddy")

**Status:** Approved (visual direction + core mechanic, via the visual companion) — spec for review
**Date:** 2026-06-18
**Supersedes / relates:** fills the Featured floor slot vacated when **Flameout 21** was parked (see `memory/flameout-21-state.md`). New engine family `lock-reel`.
**Approved mockups:** `.superpowers/brainstorm/4865-1781794331/content/vault-v4-bigdaddy.html` (Triple-7 Vault, big-daddy chrome).

## Context

The parked Flameout 21 taught the lesson cleanly: the **stop-the-reels dynamic** (constantly-spinning reels the player stops) is great and reusable — what failed was pairing it with a **crash / lose-it-all** economy, which at a real (sub-100%) RTP can't pay off the risk. Stop & Lock 777 keeps the dynamic the owner liked and pairs it with a **collecting** payoff: every stop *banks* money, nothing gets wiped out. It is built as the floor's **Featured "big daddy"** — the most lavish, bespoke cabinet on the floor, in the prominent featured slot — the "turn the corner in the Venetian and see a machine you've never seen, beckoning a big payout for a small bet" pull.

The genre is **hold-and-spin / cash-collect** (Lightning Link, Dragon Link, Buffalo Gold) — hugely popular and well-understood, so it is *known* to be fun and is straightforward to balance. The twist that makes it ours: the reels are **player-stopped** (the skill-stop interaction), and the project's honesty layer (X-ray / PAR / exact-computed RTP) shows the math the casino hides.

## The game — player-stopped cash collect

- **Five reels, a 5 × 4 grid (20 cells).** The reels spin **nonstop**; the player presses **STOP** to lock each reel, left-to-right (five STOP keys). A stopped reel locks its whole 4-cell column at once.
- **Symbols:** **cash-value** symbols (e.g. `$25`–`$500`), **fixed prizes** (`MINI` / `MAJOR` / `GRAND`, which pay a multiple of bet), **7** symbols, and **blanks**.
- **Collect.** When all five reels are stopped, the round resolves: you **collect the bet-scaled sum of every cash symbol + prize you locked**. Pure addition — there is no bust, no crash; a round can be small but is never negative beyond the ante.
- **One bet scales everything.** Denomination + a bet selector (e.g. 1–10 coins, like the others); a higher bet multiplies every cash value and every fixed prize proportionally. **No paylines** — this is a collection mechanic, not a matching one.

This base loop *is* the "Stop & Lock": stop the reels, lock the cash, collect.

## The 777 bonus (the tiered 7-chase)

- The **three giant vault-7s** above the grid are a live **bonus meter**: each **7** you lock lights one.
- **Three 7s locked in one stop-through → the BONUS fires immediately** (a scatter-style trigger — "like a slot," resolves the moment the third 7 locks).
- **Two 7s → the tease:** one free re-stop of a reel ("one more 7…") — a small, frequent consolation that keeps near-misses exciting. (Decision: skip a 666/555/multi-digit paytable — one clean cash system only.)
- **The bonus = free Stop-&-Lock spins (a hold-and-spin respin feature):**
  - Everything already locked is **held**.
  - You get **N free respins** (illustratively 3); each respin, the un-locked cells spin and you stop them; **any new cash/prize/7 that locks resets the respins** to N (the classic hold-and-spin tension).
  - **7s turn sticky** in the bonus and **upgrade** (e.g. each adds a rising multiplier or its own prize).
  - **Re-trigger:** locking three more 7s extends the feature; **filling the whole grid** awards the **GRAND**.
  - The feature ends at 0 respins (or a full grid); you collect the full grid.

This is the dopamine engine, and as a free-spin feature its EV folds cleanly into the RTP.

## Honest stop (consistent with the whole floor)

A **STOP is an honest uniform draw** from that reel's strip — the player's *timing feels skillful but does not change the odds*, exactly how real skill-stop / pachislo machines work (which Stock Rush already models and teaches). The agency is real; the math is honest. The **X-ray** shows each reel's strip composition, the per-cell lock/cash odds, the chance of the 3-seven bonus, and the bonus EV — *see the strips, know the edge*. (This is the same stance as Flameout 21's stop and pachislo's skill-stop; no skill-pays.)

## Symbols, strips, economy / RTP

- **Reel strips** carry a tuned mix of cash symbols, prizes, 7s, and blanks; the cash-value distribution + blank frequency set the base RTP, and the 7 frequency sets the bonus rate. **Exact figures are calibrated at build** (a small search, as with the other machines) — the spec fixes the *structure*, the plan fixes the *numbers*.
- **RTP is exact-computed, never asserted:** the base collect EV is an enumeration / closed-form over the five independent strips (each stop is a uniform window draw, so the per-reel cash expectation is exact and the grid total is their sum); the **bonus EV** is the hold-and-spin respin feature's expectation (an absorbing-Markov / branching computation — the same machinery `ruby-of-gargoyle`'s hold-and-spin already uses). `rtp = base + P(bonus)·bonusEV`, cross-checked by a seeded multi-million-round sim inside the 3.5σ band (`pnpm verify`).
- **Target ~94–95%** (a sound, slightly-generous-for-a-headline figure, in the floor's range), **high variance** — the base pays frequent small collects, the bonus is the rare big hit. "Large payout for a small bet" comes from the bonus + GRAND, reachable at the minimum bet.
- **Cents:** the collect total is `round(bet × sum × denominationCents)` — fixed prizes are integer credits; cash symbols are integer credit values, so the collect stays whole-credit (no fractional-payout departure like the crash game needed).

## Engine — new `lock-reel` family

Modeled on how `blackjack-reel` (Flameout 21) was added — a clearly-scoped new family, pure-data def, exact-RTP, sim convergence, X-ray + PAR.

- **`LockReelMachineDef`:** `reels` (five strips of symbol ids), `symbols`, a `cashValues` map (symbol → credit value), `prizes` (MINI/MAJOR/GRAND → credit multiple), `sevenSymbol`, `bonus` config (respins, sticky/upgrade rule, grand-on-fill), grid `rows` (4), `denominationCents`, `maxCoins`.
- **`LockReelSessionState`:** `phase` (`idle` | `spinning` | `bonus` | `resolved`), `grid` (5×4 of locked symbol|null), `idx` (reels stopped), `sevenCount`, `collectCredits`, `bonus` sub-state (respins left, sticky cells), `ante`.
- **Step fns:** `dealStart` (charge ante, begin spinning); `stopReel` (uniform-draw a 4-cell window from `reels[idx]`, lock the column, tally cash + 7s, advance idx; on the 5th stop resolve); `resolve` (sum the collect; if `sevenCount ≥ 3` enter `bonus`, else pay the collect); `bonusStop` (the respin feature). `FeatureEvent`s: `reels-spun`, `reel-stopped`, `cash-locked`, `seven-locked`, `bonus-triggered`, `respin`, `re-trigger`, `grand`, `collect`.
- **Exact-RTP** module (`lockReelRtp.ts`): base enumeration + bonus-feature EV; plus the live X-ray surface (per-reel cash EV, P(bonus), bonus EV) and PAR rows.
- **Exhaustive `never`-switches** (engine dispatch, validate, sessions/Sim-Lab, exactRtp, verify-floor) get the `lock-reel` case — including the Sim-Lab `simulateSession` (so the Featured machine is fully Sim-Lab-able from day one, unlike the gap Flameout 21 shipped with).

## UI — the bespoke "big daddy" cabinet

Deliberately **shares nothing** with the nine standard cabinets. A bespoke surface component (precedent: Flameout 21 had its own full-page cabinet), per the approved `vault-v4` mockup:

- **Brushed-steel cabinet** with a **gold inner bezel**, corner **rivets**, a **marquee-bulb** row, and a **★ FEATURED ★ / STOP & LOCK 777** gold crown.
- The **three giant vault-7s** (the bonus meter) flanked by **vault wheels**; below, the **5 × 4 grid** of beveled chrome cells; then five **chunky 3-D metal STOP keys** (the live reel's key pulses gold); a metal **deck plate** with Bet / Min / Collect.
- **Reels spin constantly** (per-reel scrolling), each STOP locks a column with a satisfying snap; the **bonus** plays as the vault "cracking open" into the free-spin feature.
- Decorative chrome is `aria-hidden`, **CSP-clean** (inline SVG/CSS, no external assets), **reduced-motion-safe** (spins/bulbs/pulses freeze under `prefers-reduced-motion`); the grid/controls expose proper roles + live regions, targeting **a11y 100**.

## Floor integration — the Featured machine

- Stop & Lock 777 becomes the **Featured** machine: the floor's **featured card returns** (the slot freed when Flameout 21 was parked), now a bespoke Stop & Lock 777 preview. The **floor goes 9 → 10**.
- Update: `FLOOR` (+ the machine def), the featured card + `FEATURED_ID`, marquee art, chrome registry/theme, `payTag` (a `lock-reel` label, e.g. "STOP & LOCK"), the floor family grouping, **og-image** ("Nine" → "Ten machines" + regenerate the PNG), README, CHANGELOG, social meta, and the machine/floor tests (count 9 → 10).

## Testing

- **Eval/step units:** a stop locks a uniform-drawn column; cash tally = sum of locked cash; 7s increment the count; 3 sevens → bonus; 2 sevens → one tease re-stop; bonus respins reset on a new lock; grid-fill → GRAND; collect = `round(bet × sum × denom)`; bet scales values; honest stop is skill-neutral (uniform).
- **DP / RTP:** exact `rtp` (base + bonus) at a frozen calibrated figure; the policy-free enumeration matches the live X-ray numbers.
- **Convergence:** `pnpm verify` — the seeded sim tracks the exact RTP inside the 3.5σ band; the floor report covers ten machines again.
- **Browser smoke** (the standing lesson — green units miss render/data-shape bugs): stop all five reels and collect; lock 3 sevens → bonus fires immediately; sticky 7s + respin-reset + re-trigger + GRAND-on-fill; the two-7s tease; bet chips scale the values; the bespoke cabinet renders with a silent console.
- **a11y 100/100; production-CSP clean** (built `dist/` served through a CSP-applying static server, since `pnpm dev`/`preview` don't enforce `_headers`).

## Open / confirm at review

- Exact **cash ladder + strip composition** and the **bonus numbers** (respin count, the 7-upgrade rule, GRAND-on-fill) — produced by the calibration at build.
- **RTP target** (~94–95%?) and the **bet range** (e.g. 1–10 coins; denomination).
- Grid **5 × 4** confirmed; reels stopped **left-to-right** (vs. any order).

## Constraints (standing)

`@stylistic` lint (one statement/line, no trailing commas; Vue one attribute per line on multi-attribute elements). Commits **off-hours** (outside M–F 7am–7pm). **No AI co-author trailer.** **Do not push until the owner says so.** Never touch the sibling `blackjack` project.
