# Wonder Wheel — Design Spec (2026-07-10)

Owner-approved pitch → build: the **Wheel-of-Fortune archetype** (IGT 1996, the
most profitable slot in history), rebuilt as this floor's 11th machine and its
new **Featured** headliner. Owner's three calls (asked, answered): name
**Wonder Wheel**; **wheel arms at MAX COINS only** (the authentic gating — and
its lesson); Featured slot becomes **curated data** (`FEATURED_ID` + per-machine
copy), rotating by a one-line change per release.

Design brief from the owner: "super visual, super gaudy, modern — something
you'd see flashing and bleeping and blooping on the Venetian floor." And the
project's own hard-won law: authentic archetypes only (two from-scratch
inventions were built, verified, and parked).

## The machine

`wonder-wheel`, new family **`wheel`** (8th). A modern cabinet dressed over the
classic architecture: a 3-reel Telnaes stepper base (22 physical stops, 72
virtual per reel, single payline) with a **WHEEL symbol on reel 3 only**.
Denomination **25¢**, maxCoins **3**.

- **Base pays** (per coin, stepper entry kinds): Neon Seven ×3 = 500 (line
  top), Shooting Star ×3 = 150, Triple/Double/Single Neon Bar = 60/40/25,
  any-bar mix = 10, Cherry Bomb count pays (1 → 2, 2 → 5, 3 → 15). Exact
  values calibrated (below).
- **The wheel**: WHEEL on the reel-3 payline **at max coins** arms the topper.
  The next "spin" is FREE and resolves the wheel: one weighted draw over **24
  wedges, drawn equal-sized, weighted unequally** — fixed credit values from
  20 up to the **2,500-credit MEGA** wedge. WHEEL landing at 1–2 coins fires a
  `wheel-wasted` event: the machine shows you the wheel you didn't get (real
  cabinets stay silent about it; the X-ray and result line do not).
- **Math targets** (calibrated to exact, then frozen): total RTP at max coins
  **≈ 92.4%/coin** with the wheel contributing **≈ 20%** (authentic split —
  published WoF PARs put the wheel near a quarter of total return); at 1–2
  coins the RTP is the base game alone, **≈ 72%** — the per-coin cliff IS the
  lesson, printed in the PAR ladder and X-ray. Hit frequency ≈ 15% (line) +
  ~1.4% wheel arms. Top award = the MEGA wedge (`topAwardEntryId:
  'wedge-2500'`), with true odds on the floor card.

## Engine architecture (non-interactive core, theatrical shell)

The wheel is modeled EXACTLY like video free spins: a pending free game.

- `MachineSessionState.wheel: WheelSessionState | null` where
  `WheelSessionState = { pending: boolean }`.
- `engine/wheelGame.ts`: `spinWheel(def, state, coins, rand)` routed through
  the barrel's `spin()`. Not pending → base stepper spin (reusing
  `bestStepperAward` from `engine/awards.ts`, so gameplay and exact math share
  one evaluator); reel-3 WHEEL + max coins → `pending = true`, event
  `wheel-armed`; under max → event `wheel-wasted`. Pending → the spin is the
  wheel resolve: one labeled RNG draw over wedge weights, `coinsIn = 0`,
  `gameKind: 'bonus'`, payout = the wedge's fixed credits, event
  `wheel-landed { wedgeIndex, credits }`, pending cleared.
- `nextSpinCost` = 0 while pending. The UI's giant SPIN-THE-WHEEL button calls
  the store's ORDINARY spin action — every existing driver (store,
  simulateMachine, sessions, verify) plays the wheel with zero special-casing
  beyond draining `wheel.pending` in the feature-drain loops.
- `engine/wheelRtp.ts`: exact solver — 72³ enumeration for line pays (the
  stepper path's math), plus the wheel term at max coins: P(WHEEL on reel 3)
  × E[wedge]/coins per coin, variance exact (wheel wedge is disjoint from
  3-symbol line wins by construction: WHEEL occupies the reel-3 cell).
  Breakdown rows: each paytable entry + one row per distinct wedge value
  (`wedge-20` … `wedge-2500`) so the PAR sheet prints the whole wheel and the
  floor card reads true MEGA odds. Registered as a FLOOR family (static import
  in `exactRtp.ts` — the parked registry is for parked families).
- `validate.ts`: WHEEL appears on reel 3 only; 24 wedges; positive weights;
  wedge credit values whole; def constants consistent.

## The spectacle (the point)

- **Cabinet**: marquee with a slowly-idling **mini wheel** (ambient,
  aria-hidden), chasing-bulb arch chrome (`WonderWheelChrome`, registry line),
  neon carnival palette — magenta/gold/cyan piping, deep purple stage.
- **Armed moment**: reels dim under a full-cabinet **WheelOverlay** — a giant
  SVG wheel: 24 equal 15° wedges in cycling neon gradients, gold rim with 24
  chasing bulbs (CSS steps animation), center hub crest, top flapper. A
  pulsing "SPIN THE WHEEL" button (it calls the normal spin action).
- **The spin**: the engine draws FIRST; the animation lands on the drawn wedge
  (5 full revolutions + target angle, ~4.2s `cubic-bezier(.12,.8,.14,1)`), a
  decelerating ticker click-track from the sound bank, flapper wiggle at each
  wedge crossing, landing → soft wedge glow pulse (**≤3 flashes/sec — the
  WCAG strobe lesson stands**), payout banner, fanfare scaled by credits;
  MEGA gets the full bell cascade. `prefers-reduced-motion`: wheel snaps to
  the wedge, no chase, single glow.
- **Honesty in the gaud**: the wedges are DRAWN equal but WEIGHTED unequal —
  the X-ray shows the wedge table (visual share 4.17% each vs true weight%,
  MEGA at its real 1-in-N), the PAR sheet prints the full wedge math and the
  1/2/3-coin RTP ladder, and `wheel-wasted` gets an honest result line. The
  wheel is the near-miss lesson in its most visual form.
- **Sound** (`soundBank` gains a `wheel` voice, `voiceFor('wheel')`): modern
  digital cabinet bed for base spins, rising arp sting on ARM, the ticker
  click (bandpass burst) driven on a decelerating schedule during the wheel
  animation, payout-scaled landing fanfare. Same rules as the floor: LDW gets
  the party, the result line tells the net truth; nav mute governs all.

## Featured slot goes curated (the "revolving" ask)

- `app/machines/index.ts` exports `FEATURED_ID = 'wonder-wheel'`.
- `FeaturedMachine.vue` drops its hardcoded Temple content: reads
  `FEATURED_ID`'s def + a `FEATURED_COPY` record (per-machine tagline,
  bullets, badge, footer line). Temple's copy stays in the record, ready for
  its return; Wonder Wheel's copy sells the wheel and states the honest terms
  ("$0.25/credit · wheel arms at max bet · every wedge weight is public").
- The floor grid excludes the featured machine (as today) — so the grid's
  family groups gain **Cascade** and **Wheel** sections, data-driven, for
  whichever headliner is resting.
- Rotation = changing `FEATURED_ID` (+ a copy entry for first-time features).
  Deliberately NOT date-automatic: deterministic for SSG and tests, curated
  like a real floor.

## Ripples

Copy sweep "Ten machines"→"Eleven" (index header, og:description/twitter
meta, og-image alt, README status/floor-table/counts, CHANGELOG); symbol
icons for the 7 new symbols in the symbols registry; `entryLabel` (wheel arm +
wedges), `describeOutcome` lines (armed / landed / wasted), learn-link →
`/learn/telnaes-reels` (the weighting lesson; a dedicated wheel learn page is
a future candidate); floor verify runs 11 machines (wheel drains through the
generic path); experiment state literals gain `wheel: null`.

## Testing

Frozen exact numbers (RTP/HF/variance at 1/2/3 coins, wedge breakdown sums to
the wheel share, MEGA odds); engine behavior (arms only at max, wasted event
under max, pending consumes free, deterministic wedge for a seeded rand,
wedge draw distribution sanity); def validation; verify 11/11 at 3.5σ; store
restore of a pending wheel; UI (overlay appears when armed, button fires the
ordinary spin, the animation's target wedge equals the drawn wedge, WCAG
pulse budget, reduced-motion snap); floor featured swap + grid groups; sound
voice mapping; icon coverage; copy sweep assertions.

## Out of scope

Auto-rotating featured (curated by design); a `/learn/wheel` page (future);
any second machine (the 88-Fortunes pitch stays parked in memory); real
progressive on the MEGA wedge (fixed credits this version — a 4-tier
progressive belongs to the 88-Fortunes build if it happens).
