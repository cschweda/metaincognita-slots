<p align="center">
  <img src="public/og-image.png" alt="Slots Simulator — eleven machines, Monte-Carlo Sim Lab, /learn explainers, and the math the floor never shows" width="800">
</p>

# Metaincognita Slots

An educational slot machine simulator — part of the Metaincognita Casino
family (hold'em, video poker, craps, blackjack, flameout). Play authentic
machine archetypes, then see exactly what the casino never shows you: the
reel strips, the Telnaes virtual-reel weights, the engineered near-misses,
and the precise mathematics of the house edge.

**Status: v0.14.0.** The floor is open: eleven machines, full game surfaces,
per-machine cabinet chrome, X-ray mode, PAR sheets (each machine's internal
math card — pays, odds, reel maps), session history, a Monte-Carlo Sim Lab,
and eleven /learn explainers on the math the floor never shows. 0.14.0
closed the engineering backlog: CI now **boots the generated site under the
production CSP** on every push (the new guard immediately caught and fixed a
real header-generation bug), the **volatility** page completed the learn
wing, the parked machines' engines left the boot bundle, and the steppers
and Ballys fit-scale on phones. Behind it, 0.13.0 gave the floor its voice
(four period-authentic synthesized cabinet voices, mute in the nav), moved
all exact math off the main thread (a long-lived `rtp.worker`), added the
**myths** (250,000-spin live experiment) and **psychology** learn pages, grew
the glossary to 39 terms, gave the Sim Lab live closed-form expected math
with a model-vs-measured overlay, and made History speak plain English with
an expected-vs-actual takeaway at the machines' exact edges.

> **★ Featured (revolving): Wonder Wheel** — the Wheel-of-Fortune 1996
> archetype: a 3-reel Telnaes stepper whose reel-3 WHEEL symbol, at MAX COINS
> only, arms a giant 24-wedge topper. The wedges are **drawn equal-sized and
> weighted unequal** — the visual share is 1-in-24 each, the true odds are the
> published integer weights (MEGA 2,500 credits at 1-in-55,872 spins) — and
> unlike any real cabinet, the X-ray prints the whole weight table. RTP
> 92.4880% at max coins; 70.5271% below it (the authentic gating, with the
> per-coin cliff on the PAR sheet). The Featured slot is now CURATED data
> (`FEATURED_ID` + per-machine copy): rotating the spotlight is a one-line
> change, and past headliners keep their copy for a return.
>
> **The free-play trainer: Temple of Gold** — the gaudy Aztec cascade still
> anchors the first-run screen: it runs the real exact math but never debits a
> balance, with an honest House Ledger and a per-spin trick-exposer. The
> spectacle and the lesson, loss-free.

> **Parked (two from-scratch experiments):** *Flameout 21* (a blackjack-meets-crash
> game) and *Stop & Lock 777* (a stop-the-reels hold-and-spin cash-collect) were each
> built, exact-RTP-verified, and then pulled from the floor — neither felt *fun* enough
> as a slot at a real house edge. That's the honest, recurring lesson: inventing a
> genuinely fun *new* slot is hard when the math must favor the house (a cashable crash
> can't pay off its risk; a sound stop-and-collect still didn't feel sticky). Both are
> kept — resolvable, tested, off the floor — with their code and specs preserved (a Stop
> & Lock spins-economy redesign on `lock-reel-kitsch`, a Flameout crash rework on
> `flameout-21-parked`).

## Playing it

```bash
pnpm install
pnpm dev        # open http://localhost:3000
```

1. **Floor** — set a bankroll, then pick a machine from the family-grouped
   card grid. Each card shows the exact RTP and a one-line description.
2. **Machine** — spin, adjust your bet, watch the reels inside each
   machine's bespoke decorative cabinet chrome (ten themed `GameMachineChrome`
   frames: gothic stone, pachinko neon, baroque gold, emerald scales, riveted
   steel, ice facets, rising flames, warm brass, cool turquoise, carnival neon — while the
   Featured Temple of Gold runs its own full bespoke gold cabinet instead) —
   and hear it: every cabinet has a period-authentic synthesized voice
   (steppers thunk and rattle coins, the 1979 Ballys ring a struck bell, the
   video slots chime digital arpeggios, Stock Rush beeps like a parlor), with
   a global mute in the nav. Hit **X-ray** to
   open the side panel: labeled RNG trace, near-miss callouts, a live
   session-vs-exact RTP convergence sparkline, and machine internals.
3. **PAR sheet** — click the spreadsheet icon for the full pay-table with
   the exact-math derivation: enumerated cycle counts, hit frequency (how
   often *any* win lands), and variance.
4. **Pachislo keys** — on Stock Rush press **1/2/3** to stop reels manually;
   the slip (≤ 4 stops) is visible in X-ray.
5. **Sim Lab** — see the math *before* you spin: a live model panel (per-spin
   EV, expected loss at the spin cap, ±1σ of luck, and N₀ — the spins it takes
   the edge to outgrow luck) recomputes as you move the inputs. Then run
   thousands of bankroll sessions against any machine in a
   Web Worker (live progress, cancel mid-run). Outputs risk of ruin, median/mean
   ending bankroll, survival curve, drawdown histogram, sample trajectories, and
   empirical RTP — with the model's expected end overlaid on the measured
   histogram, and the gap explained honestly (bust truncation, not luck).
6. **History** — every game logged in plain English: machine names, awards
   like "5× Winged Lion" instead of paytable ids, and a takeaway line
   comparing what your wagering *should* have cost at the machines' exact
   edges against what it actually did (the export log keeps raw ids).
7. **Learn** — eleven explainer pages: house edge (live floor-wide table),
   Telnaes virtual-reel mechanics, hold-and-spin as an absorbing Markov chain,
   the Gargoyle's Eye additive multiplier, cascade/tumble math (the Featured
   machine's branching process), the pachislo flag lottery + operator key
   (exact RTP at all six settings), losses-disguised-as-wins and engineered
   near misses (a 10,000-spin experiment run live in your browser), slot
   **myths** — due jackpots, hot and cold streaks — refuted by a 250,000-spin
   seeded experiment with streak-conditioned hit rates, the **psychology of
   the floor** (LDW parties, variable-ratio reinforcement, credits-not-dollars,
   the illusion of control — each demonstrated on this app's own machinery),
   **volatility** (same edge, different ride: live sd/coin and N₀ for the whole
   floor, ranked by wildness), and a 39-term plain-English glossary with
   deep-link anchors. Each page
   layers intuition first, then a collapsible rigorous derivation with live
   numbers, and every cabinet links to its own explainer.
8. Everything persists in **localStorage** — reload mid-feature and your
   free spins are still waiting exactly where you left them.

This is an educational simulator. No real money is involved.

## The floor

| Machine | Family | Format | Exact RTP |
|---|---|---|---|
| **Wonder Wheel** ★ *Featured* | Wheel (1996 topper lineage) | 3-reel Telnaes base + 24-wedge weighted topper at max coins, fixed-credit wedges, MEGA 2,500 | 92.4880% @ max coins / 70.5271% under |
| Temple of Gold — *free-play trainer* | Cascade (tumble) | 5×4 pay-anywhere (8+), ×1/2/3/5/8 cascade ladder, percent Grand — **free play** | 90.8961% |
| Diamond Doubler | Telnaes stepper | 3 reels, wild 2x/4x multiplier | 94.7442% |
| Sevens Ablaze | Telnaes stepper | 3 reels, 2-coin, percent-fed progressive | 94.4881% @ reset + 1%/coin-in feed |
| Series E 3-Line | Vintage Bally (E-1202 replica) | 5 reels x 22 uniform stops, 3 lines, dual toggling progressive | 89.0351% per line |
| Series E Multiplier | Vintage Bally (E-1203 replica) | 4 reels x 25 uniform stops, 1-3 coin multiplier | 89.1264% @ 3 coins / 85.0304% @ 1 |
| Canal Royale | Video (lines) | 5 reels x 24 stops, 25-line, free spins | 92.4559% |
| Dragon's Hoard | Video (ways) | 5 reels x 24 stops, 243-ways, free spins w/ retriggers | 93.9950% |
| Thunder Vault | Video (lines) | 5 reels x 24 stops, 25-line, Grand progressive | 90.2948% @ Grand reset |
| Ruby of Gargoyle | Video (lines) | 5 reels x 24 stops, 25-line, hold & spin, Gargoyle's Eye ×N multiplier, Grand progressive | 90.0802% @ Grand reset |
| Stock Rush | Pachislo (skill-stop) | 3 reels x 21 stops, flag lottery, stock queue | 66.0012%–120.0028% by operator level (L4 default 91.5013%) |

*Reading the table:* **RTP** (return to player) is the long-run share of
wagers paid back — 90% RTP means a 10% house edge. **Lines** are fixed paths a
win must land along; **ways** pay any left-to-right run of adjacent reels
(243 = 3⁵). A *"1%/coin-in feed"* means 1% of every wager tops up the
progressive jackpot meter.

Every RTP shown is **computed** from the machine definition by exact
enumeration (`exactRtp`) — never asserted — and verified by seeded
multi-million-spin simulation.

## Future variants

Planned machines (see `docs/superpowers/specs/2026-06-14-future-games-roadmap.md`):

- **Galactic Crash** — a pure crash / cash-out machine: four "climb" reels plus
  a separate fifth multiplier reel and two buttons (Spin / Cash Out). Each spin
  either survives and grows the running payout or crashes and forfeits the lot;
  your winnings stay fully at risk until you cash out, and the multiplier reel is
  the big-but-riskiest score. RTP computed under optimal cash-out timing.
  **Caveat from the parked Flameout 21:** a freely cashable climb at a real
  (sub-100%) RTP forces low payoff for high risk — a crash machine only feels
  Vegas-y if it runs player-favorable or leans on a high-variance jackpot chase.
  The stop-the-reels dynamic itself is fine (pachislo proves it), but pairing it
  with a *collecting* payoff — the now-parked **Stop & Lock 777** — still didn't feel
  fun enough at a real RTP. Inventing a genuinely fun *new* slot is the hard part;
  revisit Galactic Crash with that in mind.
- **Authentic 4-tier progressives** — Mini/Minor/Major/Grand as scaling pools,
  generalizing the single-meter progressive system.

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

## Wheel (the 1996 topper)

Wonder Wheel is the Wheel-of-Fortune architecture: an ordinary weighted
stepper carrying the floor's biggest lie-by-geometry. The topper's 24 wedges
render as equal 15° slices while an integer weight table (2/1164 for the MEGA,
112/1164 for the 25) decides the draw — the exact enumeration folds
P(WHEEL on reel 3) × E[wedge] into the max-coins RTP and prints every wedge as
its own PAR row. The wheel arms at max coins only (the original's quietest
trick): bet under it and the WHEEL symbol fires a `wheel-wasted` event the
result line announces out loud. The engine models the topper as a pending FREE
spin consumed through the ordinary `spin()` path, so the simulator, session
drivers, and verify all play it with no special cases.

## Cascade (tumble) — and the first free-play trainer

Temple of Gold is a **scatter / pay-anywhere tumble**: a symbol landing 8+ times
anywhere on the 5×4 grid pays, shatters, and the survivors fall while fresh
symbols drop in — chaining up a ×1/×2/×3/×5/×8 ladder, all inside one bet. The
exact RTP is the hard part (a tumble is a branching process), so the engine
models the grid as a multinomial count vector and solves an **absorbing-Markov
DP** over states — exact per-spin mean *and* variance, the percent Grand folded
at the meter, an admissible probability-bound prune and a `maxTumbles` cap for
tractability, **no Monte-Carlo in the exact path**. `pnpm verify` confirms it
against 5M spins within 3.5σ.

It is also the floor's first **free-play** machine: the cabinet runs that real
engine but never debits a balance. An honest **House Ledger** shows, in real
dollars, what a $1/spin player *would* have fed, won, and lost (settling toward
the true RTP), and a per-spin **trick-exposer** names the result —
loss-disguised-as-a-win, engineered near-miss, clean loss, genuine win, and the
Grand as the carrot funded by everyone's losses. The house edge is shown as a
fact, inflicted on no one; Temple is walk-up (no session needed). Sound is a
zero-file, CSP-clean Web Audio synth.

## Per-machine cabinet chrome

Each machine's reel window sits inside a bespoke, gaudy, "weird-Vegas"
decorative frame built entirely from hand-crafted CSS and inline SVG
(no external images → CSP-clean, zero bundle weight). A `<GameMachineChrome>`
wrapper injects per-machine palette CSS variables and a radial stage backdrop,
then resolves the active machine's frame module from a registry. Unknown or
future machines fall back automatically to a clean accent-framed default, so
new games get chrome by adding one `.vue` file and one registry line.

The chrome layer is `aria-hidden` + `pointer-events:none` throughout — the
reels, controls, and engine are unaffected, and the a11y audit remains
100/100. All ambient animation (breathing glows, slow bobs, shimmer sweeps)
is suppressed by a single global `prefers-reduced-motion` media query guard.

## The floor has a voice

Every machine is scored by a zero-file, CSP-clean Web Audio synth (no audio
assets, everything generated). Four period-authentic voices: steppers thunk
mechanically and rattle coins into the tray, the 1979 Bally EMs hum and ring
a true struck bell, the video slots chime digital arpeggios, and Stock Rush
beeps like a Japanese parlor. Reveals scale with the **payout** — which means
a loss disguised as a win throws the same party a real machine would, while
the result bar and History keep telling the net truth beside it; that
deliberate contrast is a teaching device (see `/learn/psychology`). Clean
losses stay silent, a stocked pachislo flag stays *deliberately* silent (real
machines hide it — the X-ray shows it), and a global mute lives in the nav.

## Verification

```bash
pnpm install
pnpm test          # unit + frozen-calibration + convergence suites
pnpm verify        # headless floor verification report (5M cycles/machine)
pnpm generate && pnpm smoke:csp   # boot dist/ under the REAL production CSP
```

`smoke:csp` is the deploy guard for the silent failure class: it serves the
generated site with the real `dist/_headers`, boots it in a headless Chrome,
and fails on any CSP violation, page error, or a page that never renders —
including proof that the `rtp.worker` loads and answers under `worker-src`.
CI runs it on every push (`CSP_SMOKE_REQUIRE=1`); locally it skips loudly if
no Chrome is found.

`pnpm verify` now covers 10 machines and prints a jackpot-column footnote
distinguishing progressive meter hits (Bally, Thunder Vault Grand) from
pachislo bonus flags. Convergence tests include video cycle-SE cases and
pachislo block-SE at levels 1/4/6.

CI also enforces engine purity: a grep over `app/engine/` confirms no UI
framework imports (`vue`, `nuxt`, `pinia`) have leaked into the headless
engine layer.

Full-run table (5M cycles/machine, seed 20260612; **HF** = hit frequency,
the share of spins that pay anything):

```
machine               coins   exact RTP    sim RTP      Δ           HF exact     HF sim      jackpots  σ-band
temple-of-gold        100     90.8961%    90.9518%     0.0557%    35.5257%    35.5251%        97  PASS
canal-royale           25     92.4559%    92.3251%     0.1309%    55.5343%    55.5200%         0  PASS
dragons-hoard          25     93.9950%    94.2613%     0.2663%    53.5534%    53.5694%         0  PASS
thunder-vault          25     90.2948%    90.3789%     0.0841%    41.2899%    41.2930%      1007  PASS
ruby-of-gargoyle       25     90.0802%    89.5856%     0.4946%    41.2899%    41.2619%       961  PASS
diamond-doubler         3     94.7442%    95.1375%     0.3933%    14.6675%    14.6742%         0  PASS
sevens-ablaze           2     94.4881%    94.9118%     0.4237%    15.7193%    15.7222%       379  PASS
series-e-3line          1     89.0351%    88.5838%     0.4513%    11.8144%    11.8052%         1  PASS
series-e-multiplier     3     89.1264%    89.0240%     0.1024%    14.2559%    14.2648%       197  PASS
stock-rush              3     91.5013%    91.5360%     0.0347%    21.2341%    21.2481%         0  PASS
```

## Tech

Nuxt 4 SPA (ssr:false) - Vue 3 - TypeScript strict - @nuxt/ui 4 + Tailwind 4 -
Pinia 3 - Vitest 4 - two Web Workers (`sim.worker` for the Sim Lab's
Monte-Carlo runs; a long-lived `rtp.worker` for exact math and the seeded
learn-page experiments, so the UI thread never runs a 24⁵ enumeration) -
pnpm. The engine (`app/engine/`) is
pure TypeScript with no framework imports; machines (`app/machines/`) are
pure data.

## Sources

Machine behavior is grounded in period documentation: the Bally Series E
service manual (Fey, 1995), Bally Manual 7050 parts catalog (1981, models
E-1202/E-1203), the Bally FO-5140 Double Progressive instructions (1989),
Bally Manual 6000 (1979, electromechanical), the Massachusetts Gaming
Commission Slot Machine Activity Manual v8 (2022), and a pachislo owner's
manual (2006). The scanned manuals are kept local-only under `docs/` and are
deliberately **not** committed or redistributed (they remain their publishers'
copyright); only original specs and plans are tracked. Weighted virtual reels
follow the Telnaes patent (US 4,448,419, 1984). Reel strips and weights are
original designs calibrated to documented real-world targets.

## License

MIT — see [LICENSE](LICENSE). The historical manuals referenced above are not
part of this repository or its license.
