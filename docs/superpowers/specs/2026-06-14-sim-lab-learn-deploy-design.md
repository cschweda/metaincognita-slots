# Plan 4 — Sim Lab, /learn pages & Netlify deploy — Design Spec

**Date:** 2026-06-14
**Status:** Approved (brainstorm) — ready for implementation plan
**Author:** cschweda + Claude

## Summary

The final roadmap milestone. Three workstreams plus a deploy:

1. **Sim Lab** — a *risk/bankroll lab* that runs a Monte-Carlo over many sessions
   (each a bankroll played to bust-or-cap) in a **Web Worker**, and shows what
   variance actually does to a player's money: risk of ruin, the distribution of
   outcomes, and how the field of bankrolls thins out over time.
2. **/learn** — an educational section (index + one page per topic) teaching the
   math the casino never shows: house edge, Telnaes virtual reels, hold-and-spin
   Markov math, and the Gargoyle's Eye additive multiplier. Each page is
   *layered*: plain-language intuition + one live number on top, a collapsible
   rigorous derivation with live tables underneath.
3. **Netlify deploy prep + verify** — the build is already Netlify-configured
   (`netlify.toml`, `scripts/csp-hashes.mjs`, `nitro: netlify_static`). This
   milestone makes the new routes prerender and the Web Worker run under the
   strict CSP, then verifies a production build. The actual publish stays with
   the user.

## Goal & Non-Goals

**Goal:** Ship a responsive, cancellable bankroll-risk simulator; a layered
educational `/learn` section driven by live machine data; and a production build
that is verified deploy-ready with the worker and new routes intact under the
existing CSP.

**Non-goals:**
- No changes to `simulateMachine` or the per-spin engine primitives
  (`spin`, `nextSpinCost`, `exactRtp`) — the session layer is *additive* and
  reuses them, so the convergence/RTP test suite stays stable.
- No new dependency (no Comlink, no chart library) — native module worker +
  hand-built inline SVG, matching existing patterns.
- No SharedArrayBuffer / cross-origin isolation (would complicate the CSP).
- No cross-session persistence or multi-worker sharding of a single run (YAGNI).
- No new machine, no gameplay changes, no blackjack.
- We do **not** trigger the live Netlify publish (user goes live).

## Decisions Locked (from brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Sim Lab purpose | **Risk / bankroll lab** (gambler reality), not a convergence/math lab |
| 2 | Session model | **Bust or spin cap** — bankroll + fixed bet, until it can't afford the next paid spin or hits a max-spins cap |
| 3 | Visualizations | **All four** — survival curve, ending-bankroll histogram, sample session curves, max-drawdown histogram (plus a headline stats table) |
| 4 | /learn structure | **Index + page per topic** (`/learn`, `/learn/house-edge`, `/learn/telnaes-reels`, `/learn/hold-and-spin`, `/learn/gargoyles-eye`) |
| 5 | /learn depth | **Layered** — intuition + one live headline number, then a collapsible rigorous derivation with live tables |
| 6 | Deploy scope | **Prep + verify; user goes live** |

## Architecture & Rationale

### Engine seam: a sibling layer, not a `simulateMachine` change

The original brief proposed adding progress/cancel/initial-state params to
`simulateMachine` for chunking. We **reject** that:

- **A1 (chosen):** New `app/engine/sessions.ts` with pure functions —
  `simulateSession(def, opts, rand) → SessionResult` (one bankroll to
  bust-or-cap) and a streaming aggregator that rolls many `SessionResult`s into
  the lab's stats and chart data. These reuse the stable per-spin primitives
  `spin()` and `nextSpinCost()`. Fully unit-testable in Node, no worker needed
  to test the math.
- A2 (rejected): put the loop inside the worker file — worker code is hard to
  unit-test and couples math to the transport.
- A3 (rejected): overload `simulateMachine` with a session mode + callbacks —
  risks regressing the convergence/RTP tests that pin its current behavior.

**The meters-reset / drawdown-merging problem the brief flagged disappears**
under the session model: each session is self-contained with its own clean
drawdown, and we aggregate *distributions* rather than merging one cumulative
curve. There is no serializable mid-stream RNG state. Reproducibility comes from
deriving each session's seed deterministically from `masterSeed + sessionIndex`.

### Worker transport: native Vite module worker, no dependency

- **B1 (chosen):** `new Worker(new URL('./sim.worker.ts', import.meta.url),
  { type: 'module' })`, sending only `{ machineId, opts, sessions, seed }`. The
  worker imports `~/machines` and `~/engine` itself, so we never structured-clone
  a `MachineDef`. A small typed message protocol (`run / progress / done /
  cancel / cancelled / error`) is wrapped in a `useSimWorker()` composable.
- B2 (rejected): add Comlink — YAGNI for one streaming request; more CSP surface.

### Cancellation: cooperative between batches

- **C1 (chosen):** the worker aggregates in batches (e.g. 200 sessions),
  `await`s a macrotask between batches so an incoming `cancel` message is
  processed, checks the flag, and on cancel posts the **partial** aggregate so
  the user keeps what ran. No special headers.
- C2 (rejected): SharedArrayBuffer + Atomics — needs COOP/COEP isolation that
  fights the CSP for no real benefit here.

## Engine Seam Detail (`app/engine/sessions.ts`)

### Types

```ts
interface SessionOptions {
  startCredits: number          // bankroll in CREDITS (UI converts $ via denominationCents)
  bet: number                   // coins/lines per paid spin (machine-native, passed to spin())
  spinCap: number               // max PAID spins before a forced stop (survive)
  progressiveMode: 'static' | 'live'
  oddsLevel?: number            // pachislo operator level 1..6
}

interface SessionResult {
  busted: boolean               // stopped because it could not afford the next paid spin
  spinsPlayed: number           // PAID spins taken (free spins/respins/bonus excluded)
  endBalance: number            // final credits
  peak: number                  // highest credits reached
  maxDrawdown: number           // deepest credits-below-peak (matches SimResult semantics)
  trajectory: number[]          // balance after each paid spin, downsampled (≤ ~80 pts)
}
```

### Session loop

Mirrors the live store's spin routing. Internally in **credits**; balance can
never go negative (a spin only happens when `balance >= cost`):

```
state = fresh session state (progressive at reset; static or live feeding)
balance = startCredits; peak = balance; maxDrawdown = 0; paidSpins = 0; busted = false
loop:
  if paidSpins >= spinCap: break            // survived to cap
  cost = nextSpinCost(def, state, bet)
  if cost > 0 and balance < cost: busted = true; break   // can't afford next paid spin
  out = spin(def, state, bet, rand)         // mutates state
  balance += out.totalPayout - out.coinsIn
  update peak, maxDrawdown
  if out.coinsIn > 0: paidSpins++; record trajectory point
drain any in-flight free feature (spin() until no free feature / no pachislo bonus),
  collecting pending free payouts into balance/peak/maxDrawdown   // mirrors simulateMachine drain
```

- **Bust vs survive:** `busted` is set only when the loop breaks on
  affordability; reaching `spinCap` is a survive even if balance is low.
- **Free games never bust:** `nextSpinCost` returns 0 during a video feature or
  pachislo replay/bonus, so the affordability check is skipped while playing for
  free.
- **Per-session seed:** `rand = mulberry32(deriveSeed(masterSeed, i))`;
  `deriveSeed` is a deterministic combiner (e.g. a splitmix/golden-ratio step) so
  the whole run reproduces and any batch is independent.

### Aggregator → `SimLabResult`

Single-pass / streaming so it runs incrementally in the worker:

```ts
interface SimLabResult {
  machineId: string
  sessions: number
  startCredits: number
  bet: number
  spinCap: number
  // headline
  riskOfRuin: number            // fraction busted
  medianEnd: number
  meanEnd: number
  pctAhead: number              // fraction with endBalance > startCredits
  avgSpins: number              // mean paid spins survived
  avgMaxDrawdown: number
  empiricalRtp: number          // totalOut/totalIn across all sessions (context)
  houseEdge: number             // 1 − exactRtp(def).rtp, for the comparison callout
  // viz data
  survival: number[]            // survival[k] = fraction still solvent at binned spin k
  endHistogram: { binEdges: number[]; counts: number[]; bustCount: number }
  drawdownHistogram: { binEdges: number[]; counts: number[] }
  sampleTrajectories: { busted: boolean; points: number[] }[]   // mix of bust + survive
}
```

Aggregation notes:
- The worker streams sessions in **batches**, appending a compact per-session
  record `{ endBalance, maxDrawdown, spinsPlayed, busted }` to in-memory arrays
  (≈4 numbers/session — trivial even at 100k+), and **finalizes** the result from
  those arrays on `done` or on `cancel` (so partial results are exact too).
- **Survival curve** from a deaths-per-spin tally: a busted session "dies" at
  `spinsPlayed`; `survival[k] = (N − cumulativeDeaths≤k) / N`. Bin spin index to
  ≤ ~200 buckets when `spinCap` is large.
- **Median & histograms** are computed exactly at finalize with **data-driven
  ranges** (real min/max of the scalar arrays), so nothing is clipped; the
  end-balance bust spike sits in bin 0.
- **Sample trajectories** are the one thing too large to keep wholesale (≈80
  points × N), so they use two small reservoirs (a few busted + a few survived)
  filled during the stream, ensuring the chart always shows both fates.

## Sim Lab Page (`/sim-lab`)

New top-level nav item. Components live in `app/components/lab/`.

**Inputs (`LabForm`):** machine dropdown (the 9 from `FLOOR`); starting bankroll
in $ (converted to credits via `denominationCents`); bet in machine-native terms
(reusing the same bet model as `BetControls`); spin cap (default **500**);
session count (default **10,000**, soft warning approaching **100,000**).
**Run** → progress bar + **Cancel** (`LabProgress`).

**Outputs:**
- `LabStatCards` — risk of ruin, median & mean ending bankroll, % ahead, avg
  session length, avg max drawdown, plus an empirical-RTP vs house-edge callout.
- `SurvivalCurve` — % solvent vs spins elapsed (the centerpiece).
- `EndHistogram` — ending-bankroll distribution with the bust spike at 0.
- `SampleCurves` — overlaid individual trajectories (bust vs survive), reusing
  the existing sparkline polyline pattern.
- `DrawdownHistogram` — distribution of worst dips.

Reuses `utils/format.ts`, the existing dark/amber/emerald/rose palette, and
`exactRtp()` for the house-edge context. A `ChartFrame` helper standardizes axes,
labels, and the accessible text alternative each chart needs.

## /learn Section

Index + four topic routes; shared building blocks in `app/components/learn/`
(`LearnSection`, `LearnTopicCard`, and a styled native-`<details>` disclosure).
Every page: intuition + one **live** headline number, then a collapsible
"show the math" with live tables pulled from the machine defs / `exactRtp()`.

- **`/learn` (index)** — frames "the math the casino never shows," topic cards,
  and a "see it in action" link to `/sim-lab`.
- **`/learn/house-edge`** — house edge = 1 − RTP. Headline: a representative
  machine's real house edge. Math: a floor-wide live table (machine, RTP, house
  edge, expected loss per $100 wagered) from `exactRtp()`; links to the lab.
- **`/learn/telnaes-reels`** — virtual vs physical reels using Diamond Doubler's
  real `physicalStrips` + `virtualMaps`. Headline: the jackpot symbol's virtual
  vs physical odds. Math: a live position→virtual-weight table; how weighting
  manufactures near-misses (ties to the X-ray's existing virtual→physical view).
- **`/learn/hold-and-spin`** — Ruby of Gargoyle's respin-reset as an absorbing
  Markov chain (state = locked count × respins left). Headline: probability of
  filling the board / expected locks. Math: per-respin lock probability derived
  from the `holdAndSpin` config + the transition intuition and a small matrix.
- **`/learn/gargoyles-eye`** — the additive ×N multiplier gem. Headline: its EV /
  RTP-share contribution. Math: the gem's values & probability from the def;
  additive (linear) vs multiplicative (compounding) behavior.

Trade-off accepted: with `ssr: false`, prerendered `/learn` pages are SPA shells
(content client-rendered), so the prose isn't in the static HTML for SEO. This is
consistent with the rest of the app and not worth changing here.

## Deploy Prep + Verify

- **CSP:** add `worker-src 'self'` to `scripts/csp-hashes.mjs`'s emitted policy.
  The module worker is bundled to a same-origin file under `/_nuxt` (`'self'`),
  but the directive is made explicit. Verify no CSP console violation under a
  production preview (dev may use a blob URL; production emits a real file).
- **Prerender:** add `/sim-lab`, `/learn`, and the four `/learn/*` routes to
  `nitro.prerender.routes` (belt-and-suspenders; nav/index links also make them
  crawlable).
- **Verify steps:** `pnpm lint` + `pnpm typecheck` + `pnpm test`; `pnpm generate`;
  `pnpm preview`; browser smoke of the built output (run a sim, watch progress,
  cancel, see all four charts, walk every `/learn` page, toggle disclosures,
  console + CSP clean); a11y audit to hold 100/100; viewcap screenshots. User
  triggers the publish.

## Testing & Gates

**Per-task gates (all three): `pnpm lint` + `pnpm typecheck` + `pnpm test`.**
Mandatory **browser smoke** before any task is "done" (green unit tests have
historically missed render + data-shape bugs). **viewcap** for screenshots.
**a11y audit** on new pages.

New tests:
- `tests/sessions.test.ts` — `simulateSession` determinism (same seed → same
  result), bust vs cap, drawdown correctness, free-feature drain, paid-spin
  counting, balance never negative, free games don't bust.
- `tests/simLabAggregate.test.ts` — survival-curve math, data-driven
  histogram binning, risk-of-ruin = busted fraction, exact median, sample-mix
  (always some bust + some survive), property checks (more bankroll → lower
  ruin; huge-bankroll empirical RTP ≈ `exactRtp`).
- `tests/simLabForm.test.ts`, `tests/simLabCharts.test.ts` — form behavior and
  chart components render with fixture data (assert key SVG elements + text
  alternatives).
- `tests/learnPages.test.ts` — each page's live headline number renders and the
  disclosure toggles.

The worker stays a thin shell; the pure run/aggregate function it calls is tested
directly (integration without a real worker).

## Execution Plan (subagent-driven, phased)

Each task gated by lint + typecheck + test, with a browser smoke before "done".
Never touch blackjack; push only when asked; commit timestamps off-hours.

- **Phase 0 — Engine.** `sessions.ts` (`simulateSession`, `deriveSeed`,
  streaming aggregator, types) + `sessions.test.ts` + `simLabAggregate.test.ts`.
- **Phase 1 — Worker wiring.** `sim.worker.ts` shell, `useSimWorker.ts`
  composable, minimal `/sim-lab` page proving run/progress/cancel with raw
  numbers.
- **Phase 2 — Lab UI.** `LabForm`, `LabProgress`, `LabStatCards`, the four chart
  components + `ChartFrame`; component tests; browser smoke.
- **Phase 3 — /learn.** `learn/` components + index + four topic pages with live
  data and disclosures; `learnPages.test.ts`; browser smoke.
- **Phase 4 — Nav + deploy prep.** nav items (Learn, Sim Lab); `worker-src` in
  csp-hashes; `nitro.prerender.routes`; `pnpm generate` + `preview` + smoke +
  a11y; confirm CSP clean.
- **Phase 5 — Docs & release.** Version bump **0.6.0**; README + CHANGELOG +
  branding (og-image svg/png, social meta) per the maintenance habit; final
  full browser smoke + a11y; reread README end-to-end.

## File Manifest

**New**
- `app/engine/sessions.ts`
- `app/workers/sim.worker.ts`
- `app/composables/useSimWorker.ts`
- `app/pages/sim-lab.vue`
- `app/components/lab/{LabForm,LabProgress,LabStatCards,ChartFrame,SurvivalCurve,EndHistogram,SampleCurves,DrawdownHistogram}.vue`
- `app/pages/learn/{index,house-edge,telnaes-reels,hold-and-spin,gargoyles-eye}.vue`
- `app/components/learn/{LearnSection,LearnTopicCard,LearnDisclosure}.vue`
- `tests/{sessions,simLabAggregate,simLabForm,simLabCharts,learnPages}.test.ts`

**Changed**
- `app/layouts/default.vue` — nav items for Learn + Sim Lab
- `scripts/csp-hashes.mjs` — add `worker-src 'self'`
- `nuxt.config.ts` — `nitro.prerender.routes`
- `package.json` — version 0.6.0
- `README.md`, `CHANGELOG.md`, branding assets/meta

## Risks & Mitigations

- **Large-run performance** (10k×500 ≈ up to 5M spins; video features heavier):
  worker keeps the UI responsive; progress bar manages perception; soft cap +
  warning; cancel returns partial results. Default 10k sessions / 500 cap.
- **Module worker in production build / CSP:** verify under `pnpm preview` that
  the worker loads from `/_nuxt` (file, not blob) with no CSP violation.
- **Worker memory:** per-session scalar arrays are bounded and trivial (≈4
  numbers/session); only sample trajectories are reservoir-limited, so memory
  stays flat regardless of session count.
- **SEO of /learn under `ssr: false`:** accepted; consistent with the app.
```
