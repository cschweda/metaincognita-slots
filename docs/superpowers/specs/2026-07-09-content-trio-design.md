# Content Trio — Design Spec (2026-07-09)

The agreed post-worker tranche: three teaching surfaces that the guidelines
mandate and the floor now has the machinery for. (1) A `/learn/myths` page —
gambler's fallacy, "due" jackpots, hot/cold machines — presented **as myths
with live refutation** (guidelines §1.4 "Honest fun", §2.2 "myths vs reality"),
running seeded experiments through the real engine in the `rtp.worker`.
(2) Sim Lab **live expected math** (§2.5 "see the math instantly"): closed-form
expectation/volatility numbers that update as the form changes, plus an
expected-vs-actual marker overlay on the ending-bankroll histogram after a run.
(3) History page **takeaway**: machine names instead of raw ids, awards in
plain English instead of paytable ids, and an "expected net at these edges vs
your actual net" line — §2.3's "expectation vs variance" analysis layer.

No engine math changes anywhere. Everything computes from existing exact
reports (`rtpPerCoin`, `variancePerCoin`, `hitFrequency`) and existing spin
functions; new code is presentation + one new seeded experiment util.

---

## 1. `/learn/myths` — "Due, hot, and cold"

### New: `app/utils/mythsExperiment.ts`
The ldwExperiment pattern, pointed at independence. **Sevens Ablaze** (Telnaes
stepper, $1, 3×Flaming-7 top award) — thematically the machine people believe
gets "due". Bet **1 coin** (fixed 1000-credit jackpot; no progressive meter to
explain away). Seeded `mulberry32(20260709)`, `MYTHS_SPINS = 200_000`
(single-payline stepper spins are cheap; runs in the worker anyway).

```ts
export interface MythsExperimentResult {
  spins: number
  overallHitRate: number            // any pay
  // hit rate conditioned on what just happened — the whole page in one table
  buckets: { label: string, samples: number, hitRate: number }[]
  // 'after 1 loss' | 'after 2' | 'after 3' | 'after 4' | 'after 5–9'
  // | 'after 10+ straight losses' | 'after a win' | 'after 2+ straight wins'
  longestDrought: number            // longest run of paying nothing
  jackpots: number                  // 3×F7 count ('3f7' entry)
  jackpotGaps: { min: number, max: number, mean: number } | null
  expectedGap: number               // 1/p from the exact report (worker-side)
}
```

Frozen-number tests like the LDW lab's 63.34%: the seed makes every figure a
constant; tests pin `overallHitRate`, each bucket, and the jackpot gap min/max,
and assert every bucket's `hitRate` sits within a small tolerance of the
overall rate (the actual refutation, stated as a test).

### Worker plumbing (same shape as `ldw`)
- `rtp-worker-protocol.ts`: `{ type: 'myths', reqId }` in;
  `{ type: 'mythsResult', reqId, result }` out.
- `rtp.worker.ts`: run + post, one new branch.
- `rtpClient.ts`: `mythsExperimentAsync()` — cached, pending-deduped, sync
  fallback when no `Worker` (SSR/vitest), catch→sync on worker crash.
  `expectedGap` computes worker-side from `exactRtp(SEVENS_ABLAZE)`'s `'3f7'`
  breakdown row so the page needs one round-trip.

### New: `app/pages/learn/myths.vue`
ldw-near-miss's structure (LearnSection + LearnDisclosure, breadcrumb,
`onMounted` async fill — SSG prerenders "measuring…"). Sections:

1. **"The machine has no memory"** — headline: overall hit rate vs hit rate
   after 10+ straight losses (identical, live). Intuition: every spin is one
   RNG draw; the reels are a display, not a state. Disclosure table: the
   buckets — after 1/2/3/4/5–9/10+ losses, after a win, after 2+ wins, all
   the same number, with sample counts so the reader sees it isn't thin data.
2. **"No jackpot is ever due"** — the 3×F7 gaps: it hit after as few as
   {min} spins and after as long as {max}; expected gap {1/p} — and the odds
   were 1-in-{1/p} on *every one* of the 200,000 spins. A drought isn't the
   machine "filling up"; the longest drought stat makes droughts ordinary.
   Cross-link `/learn/telnaes-reels` (where the odds live) and
   `/learn/house-edge`.
3. **"Hot and cold are stories you tell afterward"** — streaks exist in any
   random sequence (the buckets prove the next spin doesn't know about them);
   picking a machine "because it's hot" changes nothing but the story.
   Cross-link the X-ray (see the draw happen) and Stock Rush's flag lottery
   (the one floor machine where "stock" LOOKS like memory — and is disclosed).
4. Framing per §1.4: each section opens with the myth **in its own voice**
   ("it has to hit soon…") then refutes with the live number.

### Hub + nav + glossary
- `learn/index.vue`: 9th card — icon `i-lucide-flame`, title "Myths: due, hot
  & cold", blurb pointing at the live 200k-spin refutation.
- Whatever nav lists learn topics (added in the glossary quick-win) gains the
  entry.
- Glossary: add **gambler's fallacy** and **independence** terms (anchored,
  house style), linked from the page's jargon glosses.

---

## 2. Sim Lab — live expected math (§2.5)

### Change: `app/components/lab/LabForm.vue`
Emits `change: [SimRunParams]` (watch over its refs, immediate) alongside the
existing `run` emit. The form stays the owner of its inputs — no v-model
plumbing; the page just listens.

### New: `app/components/lab/LabExpectedMath.vue`
Sits between the form and the results. Props: `params: SimRunParams | null`,
`result: SimLabResult | null`. Gets the exact report reactively via
`useExactRtp(() => def)` (cache-warm after first machine; worker otherwise).
All figures labeled **model** (vs the run's **measured**). Rows:

- **Per spin**: cost `bet × denominationCents`; expected give-back
  `cost × rtp`; expected loss `cost × edge` ("the edge's quiet toll").
- **Your run, if every spin plays** (no-bust model): coin-in
  `spinCap × cost`; expected loss `coin-in × edge`; expected end
  `start − loss` (if < 0: "expectation alone busts you after ~N spins",
  N = start / perSpinLoss).
- **Luck's size**: one-session σ ≈ `bet × √(spinCap × variancePerCoin)`
  (in $) — "±1σ of luck vs the edge's pull" side by side; and
  **N₀ = variancePerCoin / edge²** spins — "how long before the edge
  reliably outweighs one σ of luck" (the §2.5 hands-to-overcome-variance
  number). Pachislo caveat footnote (attribution variance, descriptive).
- After a run: "model expected end $X vs measured mean end $Y — busted
  sessions stop losing early, so the measured mean sits above the no-bust
  model." (The honest reconciliation, not hand-waving.)

### Change: `app/components/lab/EndHistogram.vue`
Optional prop `expectedEndCredits?: number | null`. Draws a dashed amber
vertical marker at the model expected end and a solid neutral marker at the
measured `meanEnd`, tiny in-chart legend, both included in the a11y summary
sentence. Mapping is linear over the histogram's `[0, maxEnd]` range (clamped).

### Change: `app/pages/sim-lab.vue`
Holds `params` from `@change`, renders `LabExpectedMath`, passes the model
expected end (computed once from params + exact report at run time) into
`EndHistogram`.

### New util (pure, tested): `app/utils/labMath.ts`
`labExpectedMath(def, report, params)` → all the numbers above as cents/counts
(no formatting), so vitest pins them against hand-computed values for a
stepper and a video machine, and the component stays presentation-only.

---

## 3. History — names, plain-English awards, the takeaway line

### New: `app/utils/entryLabel.ts`
`machineName(id)`: `ALL_MACHINES` lookup → `def.name`, fallback raw id (old
histories may hold retired ids).
`entryLabel(def | null, entryId)`: family-aware humanizer, **raw id fallback,
never throws**:

- video: paytable id → "{length}× {symbol label}"; `sc{n}` → "{n}× {scatter
  label}"; `hold-and-spin`; `grand` → "Grand".
- stepper / bally-em: paytable entry via its `kind` (allSame → "3× {label}",
  anyOf → "Any {labels}", bar-style kinds per the actual union — exhaustive
  switch with fallback).
- pachislo: `cherry`/flag ids/`jac`/`interlude-bell` → the flag names the PAR
  sheet already uses in prose.
- cascade: symbol id → "{label} pays", `grand` → "Grand".
- blackjack-reel + lock-reel: small literal maps (stand-N/charlie/bust-save…,
  collect/base-cash/…) mirroring ParSheetModal's existing label helpers.

Tests: for EVERY `FLOOR` def, every paytable/breakdown-producible id gets a
label ≠ its raw id; unknown id + null def fall back untouched.

### Change: `HistoryTable.vue`
Machine cell → `machineName`; Awards cell → humanized labels joined with
" · "; gameKind cell → small humanize map (base/free-spin/bonus…, raw
fallback). Raw ids remain in the export log (unchanged — it's the machine-
readable surface).

### Change: `app/pages/history.vue` — the takeaway
Under the stats bar, once ≥1 game exists: group history by machineId, fetch
each resolvable def's exact report via `exactRtpAsync` (cached; Promise.all),
then one sentence, real dollars:

> "At these machines' exact edges, expected result on your $W wagered:
> **−$X**. Your actual: **−$Y** — luck has been $Z kind/unkind. Play on and
> the gap per dollar shrinks toward zero."

- Expected net = −Σ per-machine `wageredCents × (1 − rtpPerCoin)`.
- Rows on unresolvable (retired/parked) machines: excluded, with "(excludes
  N games on retired machines)" suffix when N > 0.
- Footnote when Stock Rush is present: edge taken at its current default
  operator setting (history doesn't record the setting) — labeled estimate.
- Pure helper `expectedNetCents(rows, reportsById)` in `entryLabel.ts`'s
  sibling `app/utils/historyTakeaway.ts`, unit-tested; the page only formats.

---

## Gates & verification

- Per-task: `pnpm lint` + targeted vitest (capture exit codes; no `| tail`).
- Frozen-number tests for the myths experiment (determinism = the page's
  promise: "reload and the numbers repeat exactly").
- Full `pnpm check` once at the end; no `pnpm dev` while it runs.
- Live browser smoke on the CSP-enforcing static server: myths page numbers
  fill (worker path), Sim Lab panel updates as sliders move + overlay draws,
  History shows names/labels/takeaway after real spins.
- CHANGELOG + learn-hub count updates; README pass stays a SEPARATE
  pre-push item (per handoff) but this tranche's features join it.

## Out of scope

Volatility page, psychology page (future, per handoff "behind that" list);
per-row oddsLevel recording; any engine/RTP change; touching the export-log
format.
