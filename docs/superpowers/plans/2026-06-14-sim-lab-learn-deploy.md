# Plan 4 — Sim Lab, /learn pages & Netlify deploy — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a risk/bankroll Sim Lab (Web-Worker Monte-Carlo over bust-or-cap sessions with four charts), a layered `/learn` educational section (index + four topic pages driven by live machine data), and make the production build deploy-verified under the strict CSP.

**Architecture:** A new additive engine layer `app/engine/sessions.ts` reuses the stable per-spin primitives `spin()` / `nextSpinCost()` / `initMachineState()` (no change to `simulateMachine`). A pure stateful driver `createSimLabRun()` advances sessions in synchronous batches; a thin module Web Worker drives it, posting progress and honoring cooperative cancel; a `useSimWorker()` composable wraps the worker for the page. UI is hand-built inline SVG matching existing patterns (`ParSheetModal`, sparklines). `/learn` pages compute live numbers from the machine defs + `exactRtp()`.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>` + TypeScript, Pinia, Tailwind v4 + Nuxt UI, Vitest + @vue/test-utils + happy-dom, native Vite module Web Worker, inline SVG.

**Spec:** `docs/superpowers/specs/2026-06-14-sim-lab-learn-deploy-design.md`

---

## Conventions (apply to every task)

- **Per-task gates (all must pass before a task is "done"):** `pnpm lint` && `pnpm typecheck` && `pnpm test`.
- **Browser smoke** is mandatory before any UI task (Phase 1–3) and the deploy task (Phase 4) is "done": run the app, exercise the feature, check the browser console is clean (no errors, no CSP violations). Use **viewcap** for screenshots.
- **Test placement:** pure engine tests at `tests/*.test.ts` (node env, the vitest default); component tests at `tests/components/*.test.ts` with a `// @vitest-environment happy-dom` first line.
- **Never touch blackjack. Push only when asked. Commit timestamps off-hours** (the user rewrites timestamps before any push; just commit normally).
- **Commit messages:** no `Co-Authored-By` / AI-attribution trailer (user global rule).
- TDD: write the failing test first, see it fail, implement minimally, see it pass, commit.

## File Structure

**Create**
- `app/engine/sessions.ts` — session sim + aggregation + driver (one responsibility: bankroll-risk Monte-Carlo over the per-spin engine).
- `app/workers/sim.worker.ts` — thin worker: message protocol, batch loop, cancel.
- `app/composables/useSimWorker.ts` — Vue lifecycle wrapper around the worker.
- `app/pages/sim-lab.vue` — the lab page (form + progress + results).
- `app/components/lab/ChartFrame.vue` — shared SVG frame (viewBox, axes, a11y summary).
- `app/components/lab/SurvivalCurve.vue`, `EndHistogram.vue`, `DrawdownHistogram.vue`, `SampleCurves.vue` — the four charts.
- `app/components/lab/LabStatCards.vue` — headline stats grid.
- `app/components/lab/LabForm.vue` — inputs (machine, bankroll, bet, cap, sessions).
- `app/components/lab/LabProgress.vue` — progress bar + cancel.
- `app/pages/learn/index.vue`, `house-edge.vue`, `telnaes-reels.vue`, `hold-and-spin.vue`, `gargoyles-eye.vue`.
- `app/components/learn/LearnSection.vue`, `LearnTopicCard.vue`, `LearnDisclosure.vue`.
- `tests/sessions.test.ts`, `tests/simLabAggregate.test.ts`.
- `tests/components/labCharts.test.ts`, `tests/components/labForm.test.ts`, `tests/components/learnPages.test.ts`.

**Modify**
- `app/layouts/default.vue:20-22` — add `Sim Lab` + `Learn` nav items.
- `scripts/csp-hashes.mjs` — add `worker-src 'self'` to the emitted policy.
- `nuxt.config.ts` — `nitro.prerender.routes` for the new routes.
- `package.json` — version → `0.6.0`.
- `README.md`, `CHANGELOG.md`, branding assets/meta.

---

## Phase 0 — Engine (`app/engine/sessions.ts`)

### Task 0.1: Types, `deriveSeed`, and `simulateSession`

**Files:**
- Create: `app/engine/sessions.ts`
- Test: `tests/sessions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/sessions.test.ts
import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../app/engine'
import { FLOOR } from '../app/machines'
import { deriveSeed, simulateSession } from '../app/engine/sessions'
import type { SessionOptions } from '../app/engine/sessions'

const byId = (id: string) => FLOOR.find(m => m.id === id)!

function opts(over: Partial<SessionOptions> = {}): SessionOptions {
  return { startCredits: 200, bet: 1, spinCap: 200, progressiveMode: 'static', ...over }
}

describe('deriveSeed', () => {
  it('is deterministic and decorrelates adjacent indices', () => {
    expect(deriveSeed(123, 5)).toBe(deriveSeed(123, 5))
    expect(deriveSeed(123, 5)).not.toBe(deriveSeed(123, 6))
    expect(deriveSeed(123, 5)).not.toBe(deriveSeed(124, 5))
  })
})

describe('simulateSession', () => {
  it('is reproducible for the same seed', () => {
    const def = byId('diamond-doubler')
    const a = simulateSession(def, opts(), mulberry32(deriveSeed(1, 0)))
    const b = simulateSession(def, opts(), mulberry32(deriveSeed(1, 0)))
    expect(a).toEqual(b)
  })

  it('never lets the balance go negative and reports a non-negative drawdown', () => {
    const def = byId('diamond-doubler')
    for (let i = 0; i < 50; i++) {
      const r = simulateSession(def, opts({ startCredits: 50 }), mulberry32(deriveSeed(7, i)))
      expect(r.endBalance).toBeGreaterThanOrEqual(0)
      expect(r.maxDrawdown).toBeGreaterThanOrEqual(0)
      expect(r.peak).toBeGreaterThanOrEqual(r.endBalance - r.totalOut) // sanity
    }
  })

  it('busts (not survives) when it runs out before the cap', () => {
    // Tiny bankroll, huge cap: on a negative-EV game it must bust.
    const def = byId('diamond-doubler')
    const r = simulateSession(def, opts({ startCredits: 5, spinCap: 100000 }), mulberry32(deriveSeed(2, 0)))
    expect(r.busted).toBe(true)
    expect(r.spinsPlayed).toBeLessThan(100000)
    expect(r.endBalance).toBeLessThan(def.maxCoins) // can't afford another max-ish bet... at bet=1, < 1
  })

  it('survives (not busts) when the cap is reached', () => {
    // Huge bankroll, small cap: cannot bust in so few spins.
    const def = byId('diamond-doubler')
    const r = simulateSession(def, opts({ startCredits: 1_000_000, spinCap: 10 }), mulberry32(deriveSeed(3, 0)))
    expect(r.busted).toBe(false)
    expect(r.spinsPlayed).toBe(10)
  })

  it('counts only paid spins toward the cap (free video features are free)', () => {
    // Canal Royale has free spins; a survived session plays exactly spinCap PAID spins.
    const def = byId('canal-royale')
    const r = simulateSession(def, opts({ startCredits: 1_000_000, bet: 25, spinCap: 40 }), mulberry32(deriveSeed(9, 0)))
    expect(r.busted).toBe(false)
    expect(r.spinsPlayed).toBe(40)
  })

  it('records a trajectory only when asked', () => {
    const def = byId('diamond-doubler')
    const off = simulateSession(def, opts(), mulberry32(deriveSeed(4, 0)), false)
    const on = simulateSession(def, opts(), mulberry32(deriveSeed(4, 0)), true)
    expect(off.trajectory).toEqual([])
    expect(on.trajectory.length).toBeGreaterThan(1)
    expect(on.trajectory[0]).toBe(200) // starts at startCredits
    expect(on.trajectory.length).toBeLessThanOrEqual(80) // downsampled
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test sessions`
Expected: FAIL — `Cannot find module '../app/engine/sessions'`.

- [ ] **Step 3: Write the implementation**

```ts
// app/engine/sessions.ts
import type { MachineDef, MachineSessionState } from './types'
import type { RandomFn } from './rng'
import { spin, nextSpinCost, initMachineState } from './index'
import { addCoinToProgressive } from './progressive'

export interface SessionOptions {
  /** starting bankroll in CREDITS (1 credit = 1 coin = denominationCents) */
  startCredits: number
  /** coins wagered per paid spin (1..def.maxCoins) — passed straight to spin() */
  bet: number
  /** maximum PAID spins before a forced stop (a "survive") */
  spinCap: number
  /** 'static': meters stay at reset. 'live': fed per coin-in (mirrors simulateMachine). */
  progressiveMode: 'static' | 'live'
  /** pachislo operator level 1..6 (default: def.defaultOddsLevel) */
  oddsLevel?: number
}

export interface SessionResult {
  busted: boolean        // stopped because it could not afford the next paid spin
  spinsPlayed: number    // PAID spins taken (free spins/respins excluded)
  endBalance: number
  peak: number
  maxDrawdown: number    // deepest credits-below-peak
  totalIn: number        // coins wagered (for empirical RTP)
  totalOut: number       // coins paid out
  trajectory: number[]   // balance after each paid spin, downsampled (≤80), [] unless recorded
}

/** Deterministic per-session seed from a master seed + session index (well-mixed). */
export function deriveSeed(master: number, index: number): number {
  let h = (master ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
  h ^= h >>> 16
  h = Math.imul(h, 0x21f0aaad) >>> 0
  h ^= h >>> 15
  return h >>> 0
}

function downsample(arr: number[], maxPts: number): number[] {
  if (arr.length <= maxPts) return arr.slice()
  const out: number[] = []
  const step = (arr.length - 1) / (maxPts - 1)
  for (let i = 0; i < maxPts; i++) out.push(arr[Math.round(i * step)]!)
  return out
}

export function simulateSession(
  def: MachineDef,
  opts: SessionOptions,
  rand: RandomFn,
  recordTrajectory = false
): SessionResult {
  const state: MachineSessionState = initMachineState(def)
  if (def.family === 'pachislo' && opts.oddsLevel !== undefined && state.pachislo !== null) {
    if (!Number.isInteger(opts.oddsLevel) || opts.oddsLevel < 1 || opts.oddsLevel > def.oddsLevels.length) {
      throw new Error(`${def.id}: oddsLevel ${opts.oddsLevel} out of range 1..${def.oddsLevels.length}`)
    }
    state.pachislo.oddsLevel = opts.oddsLevel
  }

  let balance = opts.startCredits
  let peak = balance
  let maxDrawdown = 0
  let totalIn = 0
  let totalOut = 0
  let paidSpins = 0
  let busted = false
  const traj: number[] = recordTrajectory ? [balance] : []

  const applySpin = (): void => {
    // Mirror simulateMachine's progressive feeding (FO-5140 semantics):
    // stepper/bally feed BEFORE the spin by intended coins; video feeds AFTER by actual coinsIn.
    if (
      opts.progressiveMode === 'live' && def.progressive !== null && state.progressive !== null
      && (def.family === 'stepper' || def.family === 'bally-em')
    ) {
      for (let c = 0; c < opts.bet; c++) addCoinToProgressive(state.progressive, def.progressive)
    }
    const out = spin(def, state, opts.bet, rand)
    if (
      opts.progressiveMode === 'live' && def.family === 'video'
      && def.progressive !== null && state.progressive !== null
    ) {
      for (let c = 0; c < out.coinsIn; c++) addCoinToProgressive(state.progressive, def.progressive)
    }
    totalIn += out.coinsIn
    totalOut += out.totalPayout
    balance += out.totalPayout - out.coinsIn
    if (balance > peak) peak = balance
    if (peak - balance > maxDrawdown) maxDrawdown = peak - balance
    if (out.coinsIn > 0) {
      paidSpins++
      if (recordTrajectory) traj.push(balance)
    }
  }

  // Free video features have cost 0, so they replay inside this loop without
  // touching the affordability check or the paid-spin counter.
  while (paidSpins < opts.spinCap) {
    const cost = nextSpinCost(def, state, opts.bet)
    if (cost > 0 && balance < cost) { busted = true; break }
    applySpin()
  }
  // The cap-th paid spin may have triggered a free feature — play it out so its
  // payout is collected (mirrors simulateMachine's drain; free, so no cost).
  while (state.videoFeature !== null) applySpin()

  return {
    busted,
    spinsPlayed: paidSpins,
    endBalance: balance,
    peak,
    maxDrawdown,
    totalIn,
    totalOut,
    trajectory: recordTrajectory ? downsample(traj, 80) : []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test sessions`
Expected: PASS (all `simulateSession` + `deriveSeed` cases).

- [ ] **Step 5: Gates + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test sessions
git add app/engine/sessions.ts tests/sessions.test.ts
git commit -m "feat(engine): session-level bankroll simulation primitive"
```

---

### Task 0.2: `aggregateSessions` (pure stats)

**Files:**
- Modify: `app/engine/sessions.ts`
- Test: `tests/simLabAggregate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/simLabAggregate.test.ts
import { describe, expect, it } from 'vitest'
import { aggregateSessions } from '../app/engine/sessions'
import type { SessionRecord, SimLabContext } from '../app/engine/sessions'

function ctx(over: Partial<SimLabContext> = {}): SimLabContext {
  return {
    machineId: 'test', startCredits: 100, bet: 1, spinCap: 10,
    houseEdge: 0.1, empiricalRtp: 0.9, survivalBins: 10, histogramBins: 4, ...over
  }
}

// 4 records: 2 bust (end 0), 1 even (end 100), 1 ahead (end 300)
const recs: SessionRecord[] = [
  { endBalance: 0, maxDrawdown: 100, spinsPlayed: 3, busted: true },
  { endBalance: 0, maxDrawdown: 100, spinsPlayed: 5, busted: true },
  { endBalance: 100, maxDrawdown: 20, spinsPlayed: 10, busted: false },
  { endBalance: 300, maxDrawdown: 10, spinsPlayed: 10, busted: false }
]

describe('aggregateSessions', () => {
  it('computes headline stats', () => {
    const r = aggregateSessions(recs, [], ctx())
    expect(r.sessions).toBe(4)
    expect(r.riskOfRuin).toBe(0.5)
    expect(r.pctAhead).toBe(0.25)            // only the 300 ends above 100
    expect(r.meanEnd).toBe(100)              // (0+0+100+300)/4
    expect(r.medianEnd).toBe(50)             // avg of middle two (0,100)
    expect(r.avgSpins).toBeCloseTo((3 + 5 + 10 + 10) / 4)
    expect(r.avgMaxDrawdown).toBeCloseTo((100 + 100 + 20 + 10) / 4)
  })

  it('survival curve starts at 1 and decays to the survival rate', () => {
    const r = aggregateSessions(recs, [], ctx())
    expect(r.survival[0]!.fraction).toBe(1)
    expect(r.survival[r.survival.length - 1]!.spins).toBe(10)
    expect(r.survival[r.survival.length - 1]!.fraction).toBe(0.5) // 2 of 4 reach the cap
  })

  it('end histogram has the right total count and a separate bust count', () => {
    const r = aggregateSessions(recs, [], ctx())
    expect(r.endHistogram.counts.reduce((a, b) => a + b, 0)).toBe(4)
    expect(r.endHistogram.bustCount).toBe(2)
    expect(r.endHistogram.binEdges.length).toBe(r.endHistogram.counts.length + 1)
  })

  it('passes through and caps sample trajectories', () => {
    const samples = [
      { busted: true, points: [100, 0] },
      { busted: false, points: [100, 120] }
    ]
    const r = aggregateSessions(recs, samples, ctx())
    expect(r.sampleTrajectories).toHaveLength(2)
  })

  it('handles an all-survive set without NaNs', () => {
    const surv: SessionRecord[] = [{ endBalance: 100, maxDrawdown: 0, spinsPlayed: 10, busted: false }]
    const r = aggregateSessions(surv, [], ctx())
    expect(r.riskOfRuin).toBe(0)
    expect(Number.isNaN(r.medianEnd)).toBe(false)
    expect(r.drawdownHistogram.counts.reduce((a, b) => a + b, 0)).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test simLabAggregate`
Expected: FAIL — `aggregateSessions` not exported.

- [ ] **Step 3: Add types + implementation to `app/engine/sessions.ts`**

```ts
// --- append to app/engine/sessions.ts ---

export interface SessionRecord {
  endBalance: number
  maxDrawdown: number
  spinsPlayed: number
  busted: boolean
}

export interface SampleTrajectory {
  busted: boolean
  points: number[]
}

export interface SimLabContext {
  machineId: string
  startCredits: number
  bet: number
  spinCap: number
  houseEdge: number
  empiricalRtp: number
  survivalBins?: number   // default 200
  histogramBins?: number  // default 40
}

export interface Histogram {
  binEdges: number[]      // length = counts.length + 1
  counts: number[]
}

export interface SimLabResult {
  machineId: string
  sessions: number
  startCredits: number
  bet: number
  spinCap: number
  riskOfRuin: number
  medianEnd: number
  meanEnd: number
  pctAhead: number
  avgSpins: number
  avgMaxDrawdown: number
  empiricalRtp: number
  houseEdge: number
  survival: { spins: number; fraction: number }[]
  endHistogram: Histogram & { bustCount: number }
  drawdownHistogram: Histogram
  sampleTrajectories: SampleTrajectory[]
}

function median(sorted: number[]): number {
  const n = sorted.length
  if (n === 0) return 0
  const mid = n >> 1
  return n % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

function histogram(values: number[], lo: number, hi: number, bins: number): Histogram {
  const counts = new Array<number>(bins).fill(0)
  const binEdges: number[] = []
  const span = hi - lo || 1
  for (let i = 0; i <= bins; i++) binEdges.push(lo + (span * i) / bins)
  for (const v of values) {
    const clamped = Math.min(Math.max(v, lo), hi)
    let idx = Math.floor(((clamped - lo) / span) * bins)
    if (idx >= bins) idx = bins - 1
    if (idx < 0) idx = 0
    counts[idx]!++
  }
  return { binEdges, counts }
}

export function aggregateSessions(
  records: SessionRecord[],
  samples: SampleTrajectory[],
  ctx: SimLabContext
): SimLabResult {
  const n = records.length
  const survivalBins = ctx.survivalBins ?? 200
  const histogramBins = ctx.histogramBins ?? 40

  let bust = 0
  let ahead = 0
  let sumEnd = 0
  let sumSpins = 0
  let sumDd = 0
  let maxEnd = 0
  let maxDd = 0
  const ends: number[] = []
  const dds: number[] = []
  // deaths[s] = # of sessions whose final paid-spin count is exactly s
  const playedHist = new Array<number>(ctx.spinCap + 1).fill(0)

  for (const r of records) {
    if (r.busted) bust++
    if (r.endBalance > ctx.startCredits) ahead++
    sumEnd += r.endBalance
    sumSpins += r.spinsPlayed
    sumDd += r.maxDrawdown
    if (r.endBalance > maxEnd) maxEnd = r.endBalance
    if (r.maxDrawdown > maxDd) maxDd = r.maxDrawdown
    ends.push(r.endBalance)
    dds.push(r.maxDrawdown)
    const s = Math.min(Math.max(r.spinsPlayed, 0), ctx.spinCap)
    playedHist[s]!++
  }

  // survival[x] = fraction with spinsPlayed >= x (survivors = spinsPlayed == spinCap)
  // suffix counts
  const atLeast = new Array<number>(ctx.spinCap + 2).fill(0)
  for (let x = ctx.spinCap; x >= 0; x--) atLeast[x] = atLeast[x + 1]! + playedHist[x]!
  const survival: { spins: number; fraction: number }[] = []
  const bins = Math.min(survivalBins, ctx.spinCap)
  for (let k = 0; k <= bins; k++) {
    const x = Math.round((k / bins) * ctx.spinCap)
    survival.push({ spins: x, fraction: n ? atLeast[x]! / n : 0 })
  }

  ends.sort((a, b) => a - b)
  dds.sort((a, b) => a - b)

  return {
    machineId: ctx.machineId,
    sessions: n,
    startCredits: ctx.startCredits,
    bet: ctx.bet,
    spinCap: ctx.spinCap,
    riskOfRuin: n ? bust / n : 0,
    medianEnd: median(ends),
    meanEnd: n ? sumEnd / n : 0,
    pctAhead: n ? ahead / n : 0,
    avgSpins: n ? sumSpins / n : 0,
    avgMaxDrawdown: n ? sumDd / n : 0,
    empiricalRtp: ctx.empiricalRtp,
    houseEdge: ctx.houseEdge,
    survival,
    endHistogram: { ...histogram(ends, 0, Math.max(maxEnd, 1), histogramBins), bustCount: bust },
    drawdownHistogram: histogram(dds, 0, Math.max(maxDd, 1), histogramBins),
    sampleTrajectories: samples.slice(0, 8)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test simLabAggregate`
Expected: PASS.

- [ ] **Step 5: Gates + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test simLabAggregate
git add app/engine/sessions.ts tests/simLabAggregate.test.ts
git commit -m "feat(engine): aggregate session results into lab stats + chart data"
```

---

### Task 0.3: `createSimLabRun` (batched driver)

**Files:**
- Modify: `app/engine/sessions.ts`
- Test: `tests/simLabAggregate.test.ts` (add a describe block)

- [ ] **Step 1: Write the failing test**

```ts
// add to tests/simLabAggregate.test.ts
import { createSimLabRun } from '../app/engine/sessions'
import { FLOOR } from '../app/machines'
import type { SimLabOptions } from '../app/engine/sessions'

const byId = (id: string) => FLOOR.find(m => m.id === id)!

function labOpts(over: Partial<SimLabOptions> = {}): SimLabOptions {
  return {
    machineId: 'diamond-doubler', startCredits: 200, bet: 1, spinCap: 200,
    progressiveMode: 'static', sessions: 300, seed: 42, ...over
  }
}

describe('createSimLabRun', () => {
  it('runs to completion in batches and is batch-size independent', () => {
    const def = byId('diamond-doubler')
    const big = createSimLabRun(def, labOpts())
    expect(big.runBatch(10_000).done).toBe(true)
    const r1 = big.result()

    const small = createSimLabRun(def, labOpts())
    let done = false
    while (!done) done = small.runBatch(37).done
    const r2 = small.result()

    expect(r2).toEqual(r1)                 // identical regardless of batch size
    expect(r1.sessions).toBe(300)
    expect(r1.houseEdge).toBeGreaterThan(0)
    expect(r1.empiricalRtp).toBeGreaterThan(0)
  })

  it('keeps a mix of busted and survived sample trajectories', () => {
    // small bankroll + moderate cap → both fates occur
    const def = byId('diamond-doubler')
    const run = createSimLabRun(def, labOpts({ startCredits: 40, spinCap: 300, sessions: 400 }))
    run.runBatch(10_000)
    const r = run.result()
    expect(r.sampleTrajectories.length).toBeGreaterThan(0)
    expect(r.sampleTrajectories.some(t => t.busted)).toBe(true)
    expect(r.sampleTrajectories.some(t => !t.busted)).toBe(true)
  })

  it('property: more bankroll lowers risk of ruin', () => {
    const def = byId('diamond-doubler')
    const low = createSimLabRun(def, labOpts({ startCredits: 30, spinCap: 500, sessions: 500 }))
    const high = createSimLabRun(def, labOpts({ startCredits: 300, spinCap: 500, sessions: 500 }))
    low.runBatch(10_000); high.runBatch(10_000)
    expect(high.result().riskOfRuin).toBeLessThan(low.result().riskOfRuin)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test simLabAggregate`
Expected: FAIL — `createSimLabRun` not exported.

- [ ] **Step 3: Add to `app/engine/sessions.ts`**

```ts
// --- append to app/engine/sessions.ts ---
import { mulberry32 } from './rng'
import { exactRtp } from './exactRtp'

export interface SimLabOptions extends SessionOptions {
  machineId: string
  sessions: number
  seed: number
  trajectorySampleCap?: number  // # of early sessions to record trajectories for (default 60)
  survivalBins?: number
  histogramBins?: number
}

export interface SimLabRun {
  total: number
  runBatch(n: number): { done: boolean; completed: number }
  result(): SimLabResult
}

export function createSimLabRun(def: MachineDef, opts: SimLabOptions): SimLabRun {
  const total = opts.sessions
  const trajCap = opts.trajectorySampleCap ?? 60
  const perFate = 4
  const records: SessionRecord[] = []
  const bustedSamples: SampleTrajectory[] = []
  const survivedSamples: SampleTrajectory[] = []
  let totalIn = 0
  let totalOut = 0
  let i = 0

  function runBatch(n: number): { done: boolean; completed: number } {
    const end = Math.min(i + n, total)
    for (; i < end; i++) {
      const record = i < trajCap
      const r = simulateSession(def, opts, mulberry32(deriveSeed(opts.seed, i)), record)
      records.push({ endBalance: r.endBalance, maxDrawdown: r.maxDrawdown, spinsPlayed: r.spinsPlayed, busted: r.busted })
      totalIn += r.totalIn
      totalOut += r.totalOut
      if (record) {
        const bucket = r.busted ? bustedSamples : survivedSamples
        if (bucket.length < perFate) bucket.push({ busted: r.busted, points: r.trajectory })
      }
    }
    return { done: i >= total, completed: i }
  }

  function result(): SimLabResult {
    const houseEdge = 1 - exactRtp(def, { coins: opts.bet }).rtpPerCoin
    return aggregateSessions(records, [...bustedSamples, ...survivedSamples], {
      machineId: opts.machineId,
      startCredits: opts.startCredits,
      bet: opts.bet,
      spinCap: opts.spinCap,
      houseEdge,
      empiricalRtp: totalIn > 0 ? totalOut / totalIn : 0,
      survivalBins: opts.survivalBins,
      histogramBins: opts.histogramBins
    })
  }

  return { total, runBatch, result }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test simLabAggregate`
Expected: PASS.

- [ ] **Step 5: Gates + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add app/engine/sessions.ts tests/simLabAggregate.test.ts
git commit -m "feat(engine): batched Sim Lab driver over many sessions"
```

---

## Phase 1 — Worker, composable, minimal page

### Task 1.1: The Web Worker

**Files:**
- Create: `app/workers/sim.worker.ts`

No unit test (worker transport is verified by the browser smoke in Task 1.3; the pure logic it calls is already tested). Keep it thin.

- [ ] **Step 1: Write the worker**

```ts
// app/workers/sim.worker.ts
/// <reference lib="webworker" />
import { FLOOR } from '~/machines'
import { createSimLabRun } from '~/engine/sessions'
import type { SimLabOptions } from '~/engine/sessions'

declare const self: DedicatedWorkerGlobalScope

type RunOpts = Omit<SimLabOptions, 'machineId'>
type Incoming = { type: 'run'; machineId: string; opts: RunOpts } | { type: 'cancel' }

let cancelled = false

self.onmessage = async (e: MessageEvent<Incoming>): Promise<void> => {
  const msg = e.data
  if (msg.type === 'cancel') { cancelled = true; return }
  if (msg.type !== 'run') return
  cancelled = false

  const def = FLOOR.find(m => m.id === msg.machineId)
  if (!def) { self.postMessage({ type: 'error', message: `unknown machine ${msg.machineId}` }); return }

  try {
    const run = createSimLabRun(def, { ...msg.opts, machineId: msg.machineId })
    const BATCH = 200
    let done = false
    while (!done) {
      const r = run.runBatch(BATCH)
      done = r.done
      self.postMessage({ type: 'progress', completed: r.completed, total: run.total })
      if (done) break
      // Yield so a queued 'cancel' message can be delivered, then honor it.
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      if (cancelled) { self.postMessage({ type: 'cancelled', result: run.result() }); return }
    }
    self.postMessage({ type: 'done', result: run.result() })
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
```

- [ ] **Step 2: Typecheck (resolve any webworker-lib friction here)**

Run: `pnpm typecheck`
Expected: PASS. If `self`/`postMessage` types conflict with the DOM lib, the `/// <reference lib="webworker" />` + `declare const self: DedicatedWorkerGlobalScope` above resolves it; do not add `unsafe` casts beyond this.

- [ ] **Step 3: Gates + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add app/workers/sim.worker.ts
git commit -m "feat(lab): web worker that streams Sim Lab progress with cooperative cancel"
```

---

### Task 1.2: `useSimWorker` composable

**Files:**
- Create: `app/composables/useSimWorker.ts`

- [ ] **Step 1: Write the composable**

```ts
// app/composables/useSimWorker.ts
import { ref, shallowRef, onScopeDispose } from 'vue'
import type { SimLabOptions, SimLabResult } from '~/engine/sessions'

export type SimRunParams = Omit<SimLabOptions, 'machineId'> & { machineId: string }

export function useSimWorker() {
  const running = ref(false)
  const progress = ref(0) // 0..1
  const completed = ref(0)
  const total = ref(0)
  const result = shallowRef<SimLabResult | null>(null)
  const error = ref<string | null>(null)
  let worker: Worker | null = null

  function terminate(): void {
    if (worker) { worker.terminate(); worker = null }
  }

  function run(params: SimRunParams): void {
    terminate()
    error.value = null
    result.value = null
    completed.value = 0
    total.value = params.sessions
    progress.value = 0
    running.value = true

    worker = new Worker(new URL('../workers/sim.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent): void => {
      const m = e.data
      if (m.type === 'progress') {
        completed.value = m.completed
        total.value = m.total
        progress.value = m.total > 0 ? m.completed / m.total : 0
      } else if (m.type === 'done' || m.type === 'cancelled') {
        result.value = m.result
        running.value = false
        progress.value = 1
        terminate()
      } else if (m.type === 'error') {
        error.value = m.message
        running.value = false
        terminate()
      }
    }
    worker.onerror = (e: ErrorEvent): void => {
      error.value = e.message || 'worker error'
      running.value = false
      terminate()
    }

    const { machineId, ...opts } = params
    worker.postMessage({ type: 'run', machineId, opts })
  }

  function cancel(): void {
    if (worker && running.value) worker.postMessage({ type: 'cancel' })
  }

  onScopeDispose(terminate)
  return { running, progress, completed, total, result, error, run, cancel }
}
```

- [ ] **Step 2: Gates + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add app/composables/useSimWorker.ts
git commit -m "feat(lab): useSimWorker composable wrapping the worker lifecycle"
```

---

### Task 1.3: Minimal `/sim-lab` page + nav

**Files:**
- Create: `app/pages/sim-lab.vue`
- Modify: `app/layouts/default.vue:20-22`

Proves the full pipe end-to-end (form → worker → progress → numbers) before the chart components exist. Charts come in Phase 2.

- [ ] **Step 1: Add the nav item** in `app/layouts/default.vue`, replacing the `navItems` array (lines 20-22):

```ts
const navItems = [
  { to: '/sim-lab', icon: 'i-lucide-flask-conical', label: 'Sim Lab' },
  { to: '/learn', icon: 'i-lucide-book-open', label: 'Learn' },
  { to: '/history', icon: 'i-lucide-scroll-text', label: 'History' }
]
```

- [ ] **Step 2: Write the minimal page**

```vue
<!-- app/pages/sim-lab.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { FLOOR } from '~/machines'
import { useSimWorker } from '~/composables/useSimWorker'

const machineId = ref(FLOOR[0]!.id)
const startCredits = ref(200)
const bet = ref(1)
const spinCap = ref(500)
const sessions = ref(10_000)

const { running, progress, result, error, run, cancel } = useSimWorker()

function start(): void {
  run({
    machineId: machineId.value,
    startCredits: startCredits.value,
    bet: bet.value,
    spinCap: spinCap.value,
    progressiveMode: 'static',
    sessions: sessions.value,
    seed: 1
  })
}
</script>

<template>
  <div class="px-4 py-8 max-w-[1100px] mx-auto space-y-6">
    <h1 class="text-3xl font-bold">
      <span class="text-amber-400">Sim</span> Lab
    </h1>
    <div class="flex flex-wrap items-end gap-3">
      <label class="text-sm">Machine
        <select
          v-model="machineId"
          data-test="machine"
          class="block bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
        >
          <option v-for="m in FLOOR" :key="m.id" :value="m.id">{{ m.name }}</option>
        </select>
      </label>
      <UButton data-test="run" :disabled="running" @click="start">Run</UButton>
      <UButton v-if="running" data-test="cancel" color="error" @click="cancel">Cancel</UButton>
    </div>

    <p v-if="running" data-test="progress">Running… {{ Math.round(progress * 100) }}%</p>
    <p v-if="error" class="text-rose-400">{{ error }}</p>

    <pre v-if="result" data-test="result" class="text-xs">{{ JSON.stringify({
      riskOfRuin: result.riskOfRuin, medianEnd: result.medianEnd, pctAhead: result.pctAhead
    }, null, 2) }}</pre>
  </div>
</template>
```

- [ ] **Step 3: Browser smoke**

```bash
pnpm dev
```
In the browser: open `/sim-lab`, click **Run**, confirm the progress text advances and a result JSON appears; click **Run** again then **Cancel** mid-run and confirm a (partial) result appears. Confirm the console has **no errors and no CSP violations**, and that the worker request loads from `/_nuxt` (Network tab). Capture a viewcap screenshot.

- [ ] **Step 4: Gates + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add app/pages/sim-lab.vue app/layouts/default.vue
git commit -m "feat(lab): minimal Sim Lab page wiring run/progress/cancel + nav"
```

---

## Phase 2 — Lab UI (charts, stats, form)

> All chart components are presentational: props in, inline SVG out, no store access. Each MUST expose an accessible summary (an `aria-label` on the `<svg>` plus a visually-hidden text alternative) so the a11y audit stays at 100. Use the existing palette: amber `#fbbf24` (text-amber-400), emerald `#34d399`, rose `#fb7185`, neutral grids `#404040`. Mirror the sparkline polyline approach already used in `app/components/game/ResultBar.vue` / `app/utils/bankrollSeries.ts`.

### Task 2.1: `ChartFrame` + `LabStatCards`

**Files:**
- Create: `app/components/lab/ChartFrame.vue`
- Create: `app/components/lab/LabStatCards.vue`
- Test: `tests/components/labCharts.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/labCharts.test.ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ChartFrame from '../../app/components/lab/ChartFrame.vue'
import LabStatCards from '../../app/components/lab/LabStatCards.vue'
import type { SimLabResult } from '../../app/engine/sessions'

const result: SimLabResult = {
  machineId: 'diamond-doubler', sessions: 1000, startCredits: 200, bet: 1, spinCap: 500,
  riskOfRuin: 0.62, medianEnd: 0, meanEnd: 140, pctAhead: 0.21, avgSpins: 230, avgMaxDrawdown: 160,
  empiricalRtp: 0.901, houseEdge: 0.099,
  survival: [{ spins: 0, fraction: 1 }, { spins: 250, fraction: 0.6 }, { spins: 500, fraction: 0.38 }],
  endHistogram: { binEdges: [0, 100, 200, 300], counts: [620, 200, 180], bustCount: 620 },
  drawdownHistogram: { binEdges: [0, 100, 200], counts: [300, 700] },
  sampleTrajectories: [{ busted: true, points: [200, 100, 0] }, { busted: false, points: [200, 260] }]
}

describe('ChartFrame', () => {
  it('renders a titled, labelled svg', () => {
    const w = mount(ChartFrame, {
      props: { title: 'Survival', summary: 'curve decays to 38%' },
      slots: { default: '<rect data-test="child" />' }
    })
    const svg = w.find('svg')
    expect(svg.attributes('aria-label')).toContain('Survival')
    expect(w.text()).toContain('curve decays to 38%') // sr-only summary present in DOM
    expect(w.find('[data-test="child"]').exists()).toBe(true)
  })
})

describe('LabStatCards', () => {
  it('shows the headline numbers', () => {
    const w = mount(LabStatCards, { props: { result } })
    expect(w.text()).toMatch(/62(\.0+)?%/)   // risk of ruin
    expect(w.text()).toMatch(/21(\.0+)?%/)   // % ahead
    expect(w.text().toLowerCase()).toContain('risk of ruin')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test labCharts`
Expected: FAIL — components missing.

- [ ] **Step 3: Implement `ChartFrame.vue`**

```vue
<!-- app/components/lab/ChartFrame.vue -->
<script setup lang="ts">
defineProps<{ title: string; summary: string }>()
</script>

<template>
  <figure class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-3 space-y-2">
    <figcaption class="text-xs uppercase tracking-widest text-neutral-400">{{ title }}</figcaption>
    <svg
      viewBox="0 0 320 170"
      class="w-full h-auto"
      role="img"
      :aria-label="`${title}. ${summary}`"
    >
      <slot />
    </svg>
    <p class="sr-only">{{ summary }}</p>
  </figure>
</template>
```

- [ ] **Step 4: Implement `LabStatCards.vue`**

```vue
<!-- app/components/lab/LabStatCards.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import { FLOOR } from '~/machines'
import { formatCents, formatPercent } from '~/utils/format'

const props = defineProps<{ result: SimLabResult }>()
const denom = computed(() => FLOOR.find(m => m.id === props.result.machineId)?.denominationCents ?? 1)
const toCents = (credits: number): number => Math.round(credits * denom.value)

const cards = computed(() => [
  { label: 'Risk of ruin', value: formatPercent(props.result.riskOfRuin), tone: 'rose' },
  { label: 'Ended ahead', value: formatPercent(props.result.pctAhead), tone: 'emerald' },
  { label: 'Median end', value: formatCents(toCents(props.result.medianEnd)), tone: 'neutral' },
  { label: 'Mean end', value: formatCents(toCents(props.result.meanEnd)), tone: 'neutral' },
  { label: 'Avg session length', value: `${Math.round(props.result.avgSpins)} spins`, tone: 'neutral' },
  { label: 'Avg max drawdown', value: formatCents(toCents(props.result.avgMaxDrawdown)), tone: 'amber' },
  { label: 'Empirical RTP', value: formatPercent(props.result.empiricalRtp, 2), tone: 'neutral' },
  { label: 'House edge', value: formatPercent(props.result.houseEdge, 2), tone: 'amber' }
])
const toneClass: Record<string, string> = {
  rose: 'text-rose-400', emerald: 'text-emerald-400', amber: 'text-amber-400', neutral: 'text-neutral-200'
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div
      v-for="c in cards"
      :key="c.label"
      class="rounded-xl bg-neutral-900/70 border border-neutral-800 px-3 py-2"
    >
      <div class="text-[10px] uppercase tracking-widest text-neutral-400">{{ c.label }}</div>
      <div class="text-lg font-mono" :class="toneClass[c.tone]">{{ c.value }}</div>
    </div>
  </div>
</template>
```

- [ ] **Step 5: Run to verify it passes, gates, commit**

```bash
pnpm test labCharts && pnpm lint && pnpm typecheck && pnpm test
git add app/components/lab/ChartFrame.vue app/components/lab/LabStatCards.vue tests/components/labCharts.test.ts
git commit -m "feat(lab): ChartFrame wrapper + headline stat cards"
```

---

### Task 2.2: `SurvivalCurve.vue`

**Files:**
- Create: `app/components/lab/SurvivalCurve.vue`
- Test: add a `describe('SurvivalCurve')` block to `tests/components/labCharts.test.ts`

- [ ] **Step 1: Add the failing test** (reuse the `result` fixture already in the file)

```ts
import SurvivalCurve from '../../app/components/lab/SurvivalCurve.vue'

describe('SurvivalCurve', () => {
  it('plots a polyline and labels the final survival rate', () => {
    const w = mount(SurvivalCurve, { props: { result } })
    expect(w.find('polyline').exists()).toBe(true)
    const pts = w.find('polyline').attributes('points')!.trim().split(/\s+/)
    expect(pts.length).toBe(result.survival.length) // one point per survival sample
    expect(w.find('svg').attributes('aria-label')).toMatch(/survival/i)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `pnpm test labCharts` → FAIL (missing component).

- [ ] **Step 3: Implement**

```vue
<!-- app/components/lab/SurvivalCurve.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import { formatPercent } from '~/utils/format'
import ChartFrame from './ChartFrame.vue'

const props = defineProps<{ result: SimLabResult }>()

// plot area inside the 320x170 viewBox
const X0 = 34, X1 = 312, Y0 = 10, Y1 = 148
const maxSpins = computed(() => props.result.spinCap || 1)

const points = computed(() =>
  props.result.survival.map((s) => {
    const x = X0 + (s.spins / maxSpins.value) * (X1 - X0)
    const y = Y1 - s.fraction * (Y1 - Y0)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
)
const finalRate = computed(() => props.result.survival.at(-1)?.fraction ?? 0)
const summary = computed(() =>
  `Share of bankrolls still solvent over ${props.result.spinCap} spins, ending at ${formatPercent(finalRate.value)} survival.`
)
</script>

<template>
  <ChartFrame title="Survival curve" :summary="summary">
    <line :x1="X0" :y1="Y1" :x2="X1" :y2="Y1" stroke="#404040" stroke-width="1" />
    <line :x1="X0" :y1="Y0" :x2="X0" :y2="Y1" stroke="#404040" stroke-width="1" />
    <polyline :points="points" fill="none" stroke="#34d399" stroke-width="2" />
    <text :x="X0" :y="Y0 - 2" fill="#737373" font-size="8">100%</text>
    <text :x="X1" :y="Y1 + 12" fill="#737373" font-size="8" text-anchor="end">{{ result.spinCap }} spins</text>
  </ChartFrame>
</template>
```

- [ ] **Step 4: Run/gates/commit**

```bash
pnpm test labCharts && pnpm lint && pnpm typecheck && pnpm test
git add app/components/lab/SurvivalCurve.vue tests/components/labCharts.test.ts
git commit -m "feat(lab): survival curve chart"
```

---

### Task 2.3: `EndHistogram.vue` and Task 2.4: `DrawdownHistogram.vue`

**Files:**
- Create: `app/components/lab/EndHistogram.vue`, `app/components/lab/DrawdownHistogram.vue`
- Test: add `describe` blocks to `tests/components/labCharts.test.ts`

Both render bars from a `Histogram` (`binEdges`/`counts`). They share the bar-mapping math; `EndHistogram` additionally tints the first bin (the bust cluster) rose and labels `bustCount`.

- [ ] **Step 1: Add failing tests**

```ts
import EndHistogram from '../../app/components/lab/EndHistogram.vue'
import DrawdownHistogram from '../../app/components/lab/DrawdownHistogram.vue'

describe('EndHistogram', () => {
  it('draws one rect per bin and notes the bust count', () => {
    const w = mount(EndHistogram, { props: { result } })
    expect(w.findAll('rect').length).toBe(result.endHistogram.counts.length)
    expect(w.find('svg').attributes('aria-label')).toMatch(/620/) // bustCount surfaced in summary
  })
})

describe('DrawdownHistogram', () => {
  it('draws one rect per bin', () => {
    const w = mount(DrawdownHistogram, { props: { result } })
    expect(w.findAll('rect').length).toBe(result.drawdownHistogram.counts.length)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `pnpm test labCharts` → FAIL.

- [ ] **Step 3: Implement `EndHistogram.vue`**

```vue
<!-- app/components/lab/EndHistogram.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import { FLOOR } from '~/machines'
import { formatCents } from '~/utils/format'
import ChartFrame from './ChartFrame.vue'

const props = defineProps<{ result: SimLabResult }>()
const X0 = 34, X1 = 312, Y0 = 10, Y1 = 148
const denom = computed(() => FLOOR.find(m => m.id === props.result.machineId)?.denominationCents ?? 1)

const bars = computed(() => {
  const h = props.result.endHistogram
  const max = Math.max(1, ...h.counts)
  const bw = (X1 - X0) / h.counts.length
  return h.counts.map((c, i) => ({
    x: X0 + i * bw + 1,
    y: Y1 - (c / max) * (Y1 - Y0),
    w: Math.max(1, bw - 2),
    h: (c / max) * (Y1 - Y0),
    bust: i === 0 // lowest bin holds the busted bankrolls
  }))
})
const summary = computed(() =>
  `Distribution of ending bankrolls across ${props.result.sessions} sessions; ` +
  `${props.result.endHistogram.bustCount} busted (lowest bar). Start was ${formatCents(Math.round(props.result.startCredits * denom.value))}.`
)
</script>

<template>
  <ChartFrame title="Ending bankroll" :summary="summary">
    <line :x1="X0" :y1="Y1" :x2="X1" :y2="Y1" stroke="#404040" stroke-width="1" />
    <rect
      v-for="(b, i) in bars"
      :key="i"
      :x="b.x" :y="b.y" :width="b.w" :height="b.h"
      :fill="b.bust ? '#fb7185' : '#fbbf24'"
    />
  </ChartFrame>
</template>
```

- [ ] **Step 4: Implement `DrawdownHistogram.vue`** (same bar math, single tone, no bust bin)

```vue
<!-- app/components/lab/DrawdownHistogram.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import ChartFrame from './ChartFrame.vue'

const props = defineProps<{ result: SimLabResult }>()
const X0 = 34, X1 = 312, Y0 = 10, Y1 = 148

const bars = computed(() => {
  const h = props.result.drawdownHistogram
  const max = Math.max(1, ...h.counts)
  const bw = (X1 - X0) / h.counts.length
  return h.counts.map((c, i) => ({
    x: X0 + i * bw + 1,
    y: Y1 - (c / max) * (Y1 - Y0),
    w: Math.max(1, bw - 2),
    h: (c / max) * (Y1 - Y0)
  }))
})
const summary = computed(() =>
  `Distribution of the worst peak-to-trough dip each of ${props.result.sessions} sessions suffered.`
)
</script>

<template>
  <ChartFrame title="Max drawdown" :summary="summary">
    <line :x1="X0" :y1="Y1" :x2="X1" :y2="Y1" stroke="#404040" stroke-width="1" />
    <rect
      v-for="(b, i) in bars"
      :key="i"
      :x="b.x" :y="b.y" :width="b.w" :height="b.h"
      fill="#a78bfa"
    />
  </ChartFrame>
</template>
```

- [ ] **Step 5: Run/gates/commit**

```bash
pnpm test labCharts && pnpm lint && pnpm typecheck && pnpm test
git add app/components/lab/EndHistogram.vue app/components/lab/DrawdownHistogram.vue tests/components/labCharts.test.ts
git commit -m "feat(lab): ending-bankroll and max-drawdown histograms"
```

---

### Task 2.5: `SampleCurves.vue`

**Files:**
- Create: `app/components/lab/SampleCurves.vue`
- Test: add a `describe` block to `tests/components/labCharts.test.ts`

- [ ] **Step 1: Add failing test**

```ts
import SampleCurves from '../../app/components/lab/SampleCurves.vue'

describe('SampleCurves', () => {
  it('draws one polyline per sample trajectory, colored by fate', () => {
    const w = mount(SampleCurves, { props: { result } })
    const lines = w.findAll('polyline')
    expect(lines.length).toBe(result.sampleTrajectories.length)
    // busted curves rose, survived curves emerald
    expect(lines.some(l => l.attributes('stroke') === '#fb7185')).toBe(true)
    expect(lines.some(l => l.attributes('stroke') === '#34d399')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `pnpm test labCharts` → FAIL.

- [ ] **Step 3: Implement**

```vue
<!-- app/components/lab/SampleCurves.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import ChartFrame from './ChartFrame.vue'

const props = defineProps<{ result: SimLabResult }>()
const X0 = 6, X1 = 314, Y0 = 10, Y1 = 148

const yMax = computed(() =>
  Math.max(props.result.startCredits, 1, ...props.result.sampleTrajectories.flatMap(t => t.points))
)

const curves = computed(() =>
  props.result.sampleTrajectories.map((t) => {
    const n = Math.max(1, t.points.length - 1)
    const pts = t.points.map((v, i) => {
      const x = X0 + (i / n) * (X1 - X0)
      const y = Y1 - (v / yMax.value) * (Y1 - Y0)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    return { pts, stroke: t.busted ? '#fb7185' : '#34d399' }
  })
)
const startY = computed(() => Y1 - (props.result.startCredits / yMax.value) * (Y1 - Y0))
const summary = computed(() =>
  `${props.result.sampleTrajectories.length} example bankroll paths; rose paths busted, green survived.`
)
</script>

<template>
  <ChartFrame title="Sample sessions" :summary="summary">
    <line :x1="X0" :y1="startY" :x2="X1" :y2="startY" stroke="#404040" stroke-width="1" stroke-dasharray="3 3" />
    <polyline
      v-for="(c, i) in curves"
      :key="i"
      :points="c.pts" fill="none" :stroke="c.stroke" stroke-width="1.5" opacity="0.85"
    />
  </ChartFrame>
</template>
```

- [ ] **Step 4: Run/gates/commit**

```bash
pnpm test labCharts && pnpm lint && pnpm typecheck && pnpm test
git add app/components/lab/SampleCurves.vue tests/components/labCharts.test.ts
git commit -m "feat(lab): sample session trajectories chart"
```

---

### Task 2.6: `LabForm` + `LabProgress`, assemble the page

**Files:**
- Create: `app/components/lab/LabForm.vue`, `app/components/lab/LabProgress.vue`
- Modify: `app/pages/sim-lab.vue`
- Test: `tests/components/labForm.test.ts`

`LabForm` owns the inputs and emits a typed `run` payload. Bankroll is entered in **dollars** and converted to credits via the selected machine's `denominationCents`. Bet is clamped to `1..maxCoins`. It warns (does not block) when `sessions > 50000`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/labForm.test.ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LabForm from '../../app/components/lab/LabForm.vue'

const stubs = { UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' }, UIcon: true }

describe('LabForm', () => {
  it('emits a run payload with dollars converted to credits', async () => {
    // canal-royale denomination is 1 cent → $20 = 2000 credits; default bet = maxCoins
    const w = mount(LabForm, { props: { running: false }, global: { stubs } })
    await w.find('[data-test="machine"]').setValue('canal-royale')
    await w.find('[data-test="bankroll"]').setValue('20')
    await w.find('[data-test="run"]').trigger('click')
    const ev = w.emitted('run')
    expect(ev).toBeTruthy()
    const payload = ev![0]![0] as Record<string, number | string>
    expect(payload.machineId).toBe('canal-royale')
    expect(payload.startCredits).toBe(2000)
    expect(payload.sessions).toBeGreaterThan(0)
  })

  it('warns above 50k sessions but still allows running', async () => {
    const w = mount(LabForm, { props: { running: false }, global: { stubs } })
    await w.find('[data-test="sessions"]').setValue('80000')
    expect(w.text().toLowerCase()).toMatch(/slow|while|large/)
    expect(w.find('[data-test="run"]').attributes('disabled')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `pnpm test labForm` → FAIL.

- [ ] **Step 3: Implement `LabForm.vue`**

```vue
<!-- app/components/lab/LabForm.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FLOOR } from '~/machines'
import type { SimRunParams } from '~/composables/useSimWorker'

defineProps<{ running: boolean }>()
const emit = defineEmits<{ run: [SimRunParams] }>()

const machineId = ref(FLOOR[0]!.id)
const def = computed(() => FLOOR.find(m => m.id === machineId.value)!)
const bankrollDollars = ref(50)
const bet = ref(def.value.maxCoins)
const spinCap = ref(500)
const sessions = ref(10_000)

// Re-clamp bet to the new machine's range when the machine changes.
watch(machineId, () => { bet.value = Math.min(Math.max(1, bet.value), def.value.maxCoins) })

const warn = computed(() => sessions.value > 50_000)

function emitRun(): void {
  const startCredits = Math.max(1, Math.round((bankrollDollars.value * 100) / def.value.denominationCents))
  emit('run', {
    machineId: machineId.value,
    startCredits,
    bet: Math.min(Math.max(1, Math.floor(bet.value)), def.value.maxCoins),
    spinCap: Math.max(1, Math.floor(spinCap.value)),
    progressiveMode: 'static',
    sessions: Math.max(1, Math.floor(sessions.value)),
    seed: 1
  })
}
</script>

<template>
  <div class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
    <label class="text-xs text-neutral-400 col-span-2 sm:col-span-1">Machine
      <select v-model="machineId" data-test="machine" class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200">
        <option v-for="m in FLOOR" :key="m.id" :value="m.id">{{ m.name }}</option>
      </select>
    </label>
    <label class="text-xs text-neutral-400">Bankroll ($)
      <input v-model.number="bankrollDollars" data-test="bankroll" type="number" min="1" class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200">
    </label>
    <label class="text-xs text-neutral-400">Bet (coins)
      <input v-model.number="bet" data-test="bet" type="number" min="1" :max="def.maxCoins" class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200">
    </label>
    <label class="text-xs text-neutral-400">Spin cap
      <input v-model.number="spinCap" data-test="cap" type="number" min="1" class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200">
    </label>
    <label class="text-xs text-neutral-400">Sessions
      <input v-model.number="sessions" data-test="sessions" type="number" min="1" class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200">
    </label>
    <div class="col-span-2 sm:col-span-5 flex items-center gap-3">
      <UButton data-test="run" :disabled="running" @click="emitRun">Run simulation</UButton>
      <span v-if="warn" class="text-xs text-amber-400">Large run — this may take a while.</span>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Implement `LabProgress.vue`**

```vue
<!-- app/components/lab/LabProgress.vue -->
<script setup lang="ts">
defineProps<{ progress: number; completed: number; total: number }>()
defineEmits<{ cancel: [] }>()
</script>

<template>
  <div class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-4 space-y-2">
    <div class="flex items-center justify-between text-xs text-neutral-400">
      <span>Running… {{ completed.toLocaleString() }} / {{ total.toLocaleString() }} sessions</span>
      <UButton size="xs" color="error" variant="soft" data-test="cancel" @click="$emit('cancel')">Cancel</UButton>
    </div>
    <div
      class="h-2 rounded bg-neutral-800 overflow-hidden"
      role="progressbar"
      :aria-valuenow="Math.round(progress * 100)"
      aria-valuemin="0"
      aria-valuemax="100"
    >
      <div class="h-full bg-amber-500 transition-[width] duration-150" :style="{ width: `${progress * 100}%` }" />
    </div>
  </div>
</template>
```

- [ ] **Step 5: Replace `app/pages/sim-lab.vue` with the assembled page**

```vue
<!-- app/pages/sim-lab.vue -->
<script setup lang="ts">
import { useSimWorker } from '~/composables/useSimWorker'
import type { SimRunParams } from '~/composables/useSimWorker'
import LabForm from '~/components/lab/LabForm.vue'
import LabProgress from '~/components/lab/LabProgress.vue'
import LabStatCards from '~/components/lab/LabStatCards.vue'
import SurvivalCurve from '~/components/lab/SurvivalCurve.vue'
import EndHistogram from '~/components/lab/EndHistogram.vue'
import SampleCurves from '~/components/lab/SampleCurves.vue'
import DrawdownHistogram from '~/components/lab/DrawdownHistogram.vue'

const { running, progress, completed, total, result, error, run, cancel } = useSimWorker()
const onRun = (params: SimRunParams): void => run(params)
</script>

<template>
  <div class="px-4 py-8 max-w-[1100px] mx-auto space-y-6">
    <header class="space-y-1">
      <h1 class="text-3xl font-bold"><span class="text-amber-400">Sim</span> Lab</h1>
      <p class="text-neutral-400 text-sm max-w-2xl">
        Run thousands of bankrolls against a machine until they bust or hit a spin cap, and see what
        variance actually does to your money. Every figure comes from the same engine that runs the floor.
      </p>
    </header>

    <LabForm :running="running" @run="onRun" />
    <LabProgress v-if="running" :progress="progress" :completed="completed" :total="total" @cancel="cancel" />
    <p v-if="error" class="text-rose-400 text-sm">{{ error }}</p>

    <template v-if="result">
      <LabStatCards :result="result" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SurvivalCurve :result="result" />
        <EndHistogram :result="result" />
        <SampleCurves :result="result" />
        <DrawdownHistogram :result="result" />
      </div>
    </template>
  </div>
</template>
```

- [ ] **Step 6: Browser smoke (mandatory)**

`pnpm dev` → `/sim-lab`: run a sim on **Diamond Doubler** ($50, bet 1, cap 500, 10k sessions); confirm progress bar advances, all four charts + stat cards render, numbers are sane (risk of ruin between 0–100%, survival decays). Re-run and **Cancel** mid-run — partial results render. Switch to **Stock Rush** (pachislo) and **Canal Royale** (free spins) and run — no console errors, no CSP violations. viewcap screenshot of a completed run.

- [ ] **Step 7: Gates + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add app/components/lab/LabForm.vue app/components/lab/LabProgress.vue app/pages/sim-lab.vue tests/components/labForm.test.ts
git commit -m "feat(lab): inputs, progress, and assembled Sim Lab results page"
```

---

## Phase 3 — /learn section

> Shared building blocks first, then one page per topic. Every page: a short intuition paragraph + one **live** headline number (computed from the def / `exactRtp()`), then a `LearnDisclosure` ("Show the math") containing the rigorous tables. Mirror `ParSheetModal.vue` for table styling (`text-xs font-mono`, `divide-y divide-neutral-800/60`). Each topic page links back to `/sim-lab` where relevant.

### Task 3.1: Learn components + index page

**Files:**
- Create: `app/components/learn/LearnSection.vue`, `LearnTopicCard.vue`, `LearnDisclosure.vue`
- Create: `app/pages/learn/index.vue`
- Test: `tests/components/learnPages.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/learnPages.test.ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LearnDisclosure from '../../app/components/learn/LearnDisclosure.vue'

const stubs = { NuxtLink: { template: '<a><slot /></a>' }, UIcon: true }

describe('LearnDisclosure', () => {
  it('renders a native details/summary with the label and slotted body', () => {
    const w = mount(LearnDisclosure, {
      props: { label: 'Show the math' },
      slots: { default: '<p data-test="body">derivation</p>' },
      global: { stubs }
    })
    expect(w.find('details').exists()).toBe(true)
    expect(w.find('summary').text()).toContain('Show the math')
    expect(w.find('[data-test="body"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `pnpm test learnPages` → FAIL.

- [ ] **Step 3: Implement `LearnDisclosure.vue`**

```vue
<!-- app/components/learn/LearnDisclosure.vue -->
<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <details class="rounded-lg border border-neutral-800 bg-neutral-900/50 group">
    <summary class="cursor-pointer select-none px-4 py-2 text-sm text-amber-400 flex items-center gap-2 marker:content-['']">
      <UIcon name="i-lucide-chevron-right" class="w-4 h-4 transition-transform group-open:rotate-90" />
      {{ label }}
    </summary>
    <div class="px-4 py-3 border-t border-neutral-800 space-y-3 text-sm text-neutral-300">
      <slot />
    </div>
  </details>
</template>
```

- [ ] **Step 4: Implement `LearnSection.vue`** (intuition + headline number + disclosure slot)

```vue
<!-- app/components/learn/LearnSection.vue -->
<script setup lang="ts">
defineProps<{ title: string; headline?: string; headlineLabel?: string }>()
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-xl font-bold text-amber-400">{{ title }}</h2>
    <div v-if="headline" class="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <div class="text-[10px] uppercase tracking-widest text-amber-300/70">{{ headlineLabel }}</div>
      <div class="text-2xl font-mono text-amber-300">{{ headline }}</div>
    </div>
    <div class="text-neutral-300 leading-relaxed space-y-3"><slot name="intuition" /></div>
    <slot />
  </section>
</template>
```

- [ ] **Step 5: Implement `LearnTopicCard.vue`**

```vue
<!-- app/components/learn/LearnTopicCard.vue -->
<script setup lang="ts">
defineProps<{ to: string; title: string; blurb: string; icon: string }>()
</script>

<template>
  <NuxtLink
    :to="to"
    class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-4 space-y-2 hover:border-amber-500/40 transition-colors block"
  >
    <UIcon :name="icon" class="w-5 h-5 text-amber-400" />
    <div class="font-semibold text-neutral-100">{{ title }}</div>
    <p class="text-sm text-neutral-400 leading-relaxed">{{ blurb }}</p>
  </NuxtLink>
</template>
```

- [ ] **Step 6: Implement `app/pages/learn/index.vue`**

```vue
<!-- app/pages/learn/index.vue -->
<script setup lang="ts">
import LearnTopicCard from '~/components/learn/LearnTopicCard.vue'

const topics = [
  { to: '/learn/house-edge', icon: 'i-lucide-percent', title: 'House edge', blurb: 'Why every machine quietly keeps a slice of every dollar — and how slowly that truth shows up.' },
  { to: '/learn/telnaes-reels', icon: 'i-lucide-dices', title: 'Telnaes virtual reels', blurb: 'The patent that let three physical reels hide a million-to-one jackpot behind near-misses.' },
  { to: '/learn/hold-and-spin', icon: 'i-lucide-grip', title: 'Hold & spin math', blurb: 'The respin-reset feature as a Markov chain: how often the board actually fills.' },
  { to: '/learn/gargoyles-eye', icon: 'i-lucide-gem', title: "Gargoyle's Eye multiplier", blurb: 'What an additive ×N gem is really worth, and why additive ≠ multiplicative.' }
]
</script>

<template>
  <div class="px-4 py-8 max-w-[900px] mx-auto space-y-8">
    <header class="space-y-2">
      <h1 class="text-4xl font-bold tracking-tight"><span class="text-amber-400">Learn</span> the math</h1>
      <p class="text-neutral-400 max-w-2xl leading-relaxed">
        The floor shows you spinning reels. These pages show you the machinery underneath — the same
        numbers the PAR sheet, X-ray, and Sim Lab are built from.
      </p>
    </header>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <LearnTopicCard v-for="t in topics" :key="t.to" v-bind="t" />
    </div>
    <NuxtLink to="/sim-lab" class="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
      <UIcon name="i-lucide-flask-conical" class="w-4 h-4" /> See it in action in the Sim Lab →
    </NuxtLink>
  </div>
</template>
```

- [ ] **Step 7: Run/gates/commit**

```bash
pnpm test learnPages && pnpm lint && pnpm typecheck && pnpm test
git add app/components/learn tests/components/learnPages.test.ts app/pages/learn/index.vue
git commit -m "feat(learn): shared learn components + topic index"
```

---

### Task 3.2: `/learn/house-edge`

**Files:**
- Create: `app/pages/learn/house-edge.vue`
- Test: add a `describe('house-edge')` block to `tests/components/learnPages.test.ts`

Compute a live floor-wide table: for each `def` in `FLOOR`, `report = exactRtp(def, { coins: def.maxCoins })`, `rtp = report.rtpPerCoin`, `houseEdge = 1 - rtp`, `lossPer100 = houseEdge * 100`. Headline = the floor's average house edge (or Diamond Doubler's). Mirror `ParSheetModal`'s table styling.

- [ ] **Step 1: Add the failing test** (mount with `NuxtLink`/`UIcon` stubs; assert a live percentage and a known machine name render)

```ts
import HouseEdge from '../../app/pages/learn/house-edge.vue'

describe('house-edge', () => {
  it('renders a live floor-wide house-edge table', () => {
    const w = mount(HouseEdge, { global: { stubs } })
    expect(w.text()).toContain('Diamond Doubler')
    expect(w.text()).toMatch(/\d+\.\d+%/)          // at least one computed percentage
    expect(w.text().toLowerCase()).toContain('house edge')
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `pnpm test learnPages` → FAIL.

- [ ] **Step 3: Implement**

```vue
<!-- app/pages/learn/house-edge.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { FLOOR } from '~/machines'
import { exactRtp } from '~/engine'
import { formatPercent } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const rows = computed(() => FLOOR.map((def) => {
  const rtp = exactRtp(def, { coins: def.maxCoins }).rtpPerCoin
  return { name: def.name, rtp, houseEdge: 1 - rtp, lossPer100: (1 - rtp) * 100 }
}))
const avgEdge = computed(() => rows.value.reduce((a, r) => a + r.houseEdge, 0) / rows.value.length)
</script>

<template>
  <div class="px-4 py-8 max-w-[760px] mx-auto space-y-8">
    <h1 class="text-3xl font-bold">House edge</h1>
    <LearnSection
      title="The casino's cut"
      :headline="formatPercent(avgEdge)"
      headline-label="Average house edge across this floor"
    >
      <template #intuition>
        <p>
          Every machine pays back a little less than it takes — over millions of spins. The gap is the
          <strong>house edge</strong>: <code>house edge = 1 − RTP</code>, where RTP is the long-run return
          to player. A 5% edge means that, on average, every $100 wagered returns $95. You rarely feel it
          spin to spin, because variance is loud and the edge is quiet — which is exactly the point.
        </p>
      </template>
      <LearnDisclosure label="Show the math — every machine on the floor">
        <table class="w-full text-xs font-mono">
          <thead class="text-neutral-400">
            <tr class="text-left">
              <th class="py-1 pr-2">Machine</th><th class="py-1 px-2 text-right">RTP</th>
              <th class="py-1 px-2 text-right">House edge</th><th class="py-1 pl-2 text-right">Loss / $100</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr v-for="r in rows" :key="r.name">
              <td class="py-1 pr-2 text-neutral-200">{{ r.name }}</td>
              <td class="py-1 px-2 text-right text-emerald-400">{{ formatPercent(r.rtp) }}</td>
              <td class="py-1 px-2 text-right text-rose-400">{{ formatPercent(r.houseEdge) }}</td>
              <td class="py-1 pl-2 text-right text-neutral-300">${{ r.lossPer100.toFixed(2) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400">Every figure is computed at render time from the machine definition via <code>exactRtp()</code>.</p>
      </LearnDisclosure>
      <NuxtLink to="/sim-lab" class="inline-flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300">
        <UIcon name="i-lucide-flask-conical" class="w-4 h-4" /> Watch the edge grind a bankroll down in the Sim Lab →
      </NuxtLink>
    </LearnSection>
  </div>
</template>
```

- [ ] **Step 4: Run/gates/commit**

```bash
pnpm test learnPages && pnpm lint && pnpm typecheck && pnpm test
git add app/pages/learn/house-edge.vue tests/components/learnPages.test.ts
git commit -m "feat(learn): house edge page with live floor-wide table"
```

---

### Task 3.3: `/learn/telnaes-reels`

**Files:**
- Create: `app/pages/learn/telnaes-reels.vue`
- Test: add a `describe('telnaes-reels')` block

**Read first:** `app/machines/diamond-doubler.ts` for `physicalStrips` and `virtualMaps` (a `StepperMachineDef`). For reel index `r`, the physical strip has `physicalStrips[r].length` stops; the virtual map `virtualMaps[r]` has `virtualMaps[r].length` virtual stops (the larger number). For the jackpot symbol (the top `bestStepperAward` symbol, e.g. the `7`/wild), physical count = occurrences in `physicalStrips[r]`; virtual count = occurrences of those indices in `virtualMaps[r]`. Headline = the jackpot symbol's **virtual** odds on one reel vs its **physical** odds (use `formatOdds`).

- [ ] **Step 1: Add the failing test**

```ts
import Telnaes from '../../app/pages/learn/telnaes-reels.vue'

describe('telnaes-reels', () => {
  it('contrasts physical vs virtual stops with live numbers', () => {
    const w = mount(Telnaes, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('virtual')
    expect(w.text().toLowerCase()).toContain('physical')
    expect(w.text()).toMatch(/1 in [\d,]+/)   // a formatOdds() figure
  })
})
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement.** Build a per-reel table of `{ reel, physicalStops, virtualStops }` from `DIAMOND_DOUBLER.physicalStrips` / `.virtualMaps`, plus a per-symbol weighting table for reel 1 (`symbol → physical count, virtual count, virtual probability`). Use `LearnSection` (headline = jackpot symbol virtual odds via `formatOdds`), intuition paragraph explaining Inge Telnaes's 1984 virtual-reel patent (map many virtual stops onto few physical ones to inflate the jackpot's improbability while keeping it visible for near-misses), and a `LearnDisclosure` with the tables. Reference that the X-ray panel shows this mapping live during play. Import `DIAMOND_DOUBLER` from `~/machines/diamond-doubler`. Follow the table styling from Task 3.2.

- [ ] **Step 4: Run/gates/commit**

```bash
pnpm test learnPages && pnpm lint && pnpm typecheck && pnpm test
git add app/pages/learn/telnaes-reels.vue tests/components/learnPages.test.ts
git commit -m "feat(learn): Telnaes virtual reels page from live Diamond Doubler data"
```

---

### Task 3.4: `/learn/hold-and-spin`

**Files:**
- Create: `app/pages/learn/hold-and-spin.vue`
- Test: add a `describe('hold-and-spin')` block

**Read first:** `app/machines/ruby-of-gargoyle.ts` for the `holdAndSpin` config (grid cell count = 15, lock trigger = 6+ rubies, respins = 3, reset-on-new-lock) and the per-cell ruby landing probability used by the feature. Model the feature as an absorbing Markov chain over `(cellsFilled, respinsLeft)`: each respin, empty cells independently land a ruby with probability `p`; any new lock resets respins to 3; the chain absorbs when respins reach 0 or the board fills (15). Compute (numerically, in the page) the probability of filling the board and the expected final lock count from a 6-lock start. Headline = P(fill the board) as `formatOdds` or `formatPercent`.

- [ ] **Step 1: Add the failing test**

```ts
import HoldAndSpin from '../../app/pages/learn/hold-and-spin.vue'

describe('hold-and-spin', () => {
  it('explains the respin-reset chain with a live fill number', () => {
    const w = mount(HoldAndSpin, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('respin')
    expect(w.text().toLowerCase()).toContain('markov')
    expect(w.text()).toMatch(/%|1 in/)   // a computed probability
  })
})
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement.** In `<script setup>`, read the `holdAndSpin` config from `RUBY_OF_GARGOYLE`; write a small pure helper in the page that evaluates the Markov chain (iterate states; for a given filled count and respins-left, enumerate the number of new rubies among empty cells via the binomial with probability `p`, transition with respin reset on ≥1 new lock) to get `P(fill)` and `E[final locks]`. Render: `LearnSection` (headline = P(fill)), intuition (every new orb resets the 3 respins, so a hot board snowballs — but the reset is also why most boards stall short of full), and a `LearnDisclosure` containing the transition intuition and a compact table of `respins remaining × P(continue)`. Keep the math helper deterministic and unit-free. If the exact per-cell `p` is not directly in the config, derive it from the documented orb weight in the def and state the assumption in a footnote.

- [ ] **Step 4: Run/gates/commit**

```bash
pnpm test learnPages && pnpm lint && pnpm typecheck && pnpm test
git add app/pages/learn/hold-and-spin.vue tests/components/learnPages.test.ts
git commit -m "feat(learn): hold-and-spin Markov page from live Ruby of Gargoyle config"
```

---

### Task 3.5: `/learn/gargoyles-eye`

**Files:**
- Create: `app/pages/learn/gargoyles-eye.vue`
- Test: add a `describe('gargoyles-eye')` block

**Read first:** `app/machines/ruby-of-gargoyle.ts` for the Gargoyle's Eye multiplier-gem config (the ×N values, e.g. ×2/×3, and their landing probability). Compute the gem's expected added multiplier `E[ΔN] = Σ p_i · N_i` and explain additive stacking (two ×2 gems → ×4 total added... i.e. +2 +2, contrasted with multiplicative which would compound). Headline = `E[added multiplier per locked gem]` or the gem's contribution to feature RTP.

- [ ] **Step 1: Add the failing test**

```ts
import GargoylesEye from '../../app/pages/learn/gargoyles-eye.vue'

describe('gargoyles-eye', () => {
  it('explains the additive multiplier with live values', () => {
    const w = mount(GargoylesEye, { global: { stubs } })
    expect(w.text().toLowerCase()).toContain('additive')
    expect(w.text()).toMatch(/×\s*\d/)   // a multiplier value rendered
  })
})
```

- [ ] **Step 2: Run to verify it fails** — FAIL.

- [ ] **Step 3: Implement.** Read the multiplier values/probabilities from `RUBY_OF_GARGOYLE`; compute `E[ΔN]`; render `LearnSection` (headline = expected added multiplier), intuition (the Eye adds to a running multiplier rather than multiplying it — linear growth, so it rewards filling the board with gems but can't explode like a compounding multiplier), and a `LearnDisclosure` with a table of `gem value × probability × contribution` and a worked two-gem example (additive vs multiplicative side by side). Link back to `/learn/hold-and-spin` (the gems land during the same feature) and to `/sim-lab`.

- [ ] **Step 4: Browser smoke (all /learn pages)**

`pnpm dev` → visit `/learn`, click each of the four cards, confirm each page renders a live headline number, the "Show the math" disclosure toggles open/closed, tables show real figures, and links work. No console errors, no CSP violations. viewcap screenshot of each page.

- [ ] **Step 5: Gates + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add app/pages/learn/gargoyles-eye.vue tests/components/learnPages.test.ts
git commit -m "feat(learn): Gargoyle's Eye additive multiplier page from live config"
```

---

## Phase 4 — Nav, CSP, prerender, deploy verify

### Task 4.1: Add `worker-src` to the CSP

**Files:**
- Modify: `scripts/csp-hashes.mjs`

- [ ] **Step 1: Read the script** and find where the policy string is assembled (the directive list including `script-src`, `style-src`, `connect-src`, etc.).

- [ ] **Step 2: Add `worker-src 'self'`** to the directive list (place it next to `script-src`). The module worker bundles to a same-origin file under `/_nuxt`, so `'self'` is correct.

- [ ] **Step 3: Verify the generated policy**

```bash
pnpm generate
grep -i "worker-src" dist/_headers
```
Expected: the `Content-Security-Policy` line now contains `worker-src 'self'`.

- [ ] **Step 4: Commit**

```bash
git add scripts/csp-hashes.mjs
git commit -m "build(csp): allow same-origin web worker (worker-src 'self')"
```

### Task 4.2: Prerender the new routes

**Files:**
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Add a `nitro.prerender.routes` array** alongside the existing `nitro` config:

```ts
nitro: {
  preset: 'netlify_static',
  prerender: {
    routes: ['/sim-lab', '/learn', '/learn/house-edge', '/learn/telnaes-reels', '/learn/hold-and-spin', '/learn/gargoyles-eye']
  }
}
```

- [ ] **Step 2: Verify the routes are emitted**

```bash
pnpm generate
ls dist/sim-lab dist/learn dist/learn/house-edge
```
Expected: each route produced its own directory/HTML (no prerender errors in the build log).

- [ ] **Step 3: Commit**

```bash
git add nuxt.config.ts
git commit -m "build: prerender Sim Lab and /learn routes"
```

### Task 4.3: Production preview + smoke + a11y

- [ ] **Step 1: Build and preview**

```bash
pnpm generate && pnpm preview
```

- [ ] **Step 2: Smoke the built output.** In the preview server: run a Sim Lab simulation to completion (confirm the worker loads under the production CSP — **no CSP violation in the console**), cancel a run, and visit all four `/learn` pages with disclosures. Confirm the network panel shows the worker chunk served from `/_nuxt` (a file, not a blob URL).

- [ ] **Step 3: a11y audit** (hold 100/100). Run the a11y audit against `/sim-lab` and each `/learn/*` route. Fix any violations (chart `aria-label`/sr-only summaries, form `<label>` associations, `progressbar` role, disclosure semantics). Re-run until clean.

- [ ] **Step 4: Full gates**

```bash
pnpm lint && pnpm typecheck && pnpm test
```
Expected: all green. No code commit unless a11y fixes were needed (commit those: `git commit -m "a11y: ..."`).

---

## Phase 5 — Docs & release

### Task 5.1: Version + CHANGELOG + README + branding

**Files:**
- Modify: `package.json` (version → `0.6.0`), `CHANGELOG.md`, `README.md`, branding assets/meta (og-image svg/png, social meta in `nuxt.config.ts` head).

- [ ] **Step 1:** Bump `package.json` version to `0.6.0`.
- [ ] **Step 2:** Add a `CHANGELOG.md` entry for `0.6.0` — Sim Lab (risk/bankroll Monte-Carlo in a web worker; survival curve, ending-bankroll + drawdown histograms, sample sessions), `/learn` section (house edge, Telnaes virtual reels, hold-and-spin Markov, Gargoyle's Eye multiplier), Netlify deploy verified (worker under CSP, prerendered routes).
- [ ] **Step 3:** Update `README.md` — add Sim Lab + Learn to the feature list and any "pages/routes" section; update counts (now also a worker + learn pages). Then **reread the README end-to-end** for structure/order (per the maintenance habit).
- [ ] **Step 4:** Regenerate/refresh the og-image (svg + png) and social meta if the feature list is shown there.
- [ ] **Step 5: Gates + commit**

```bash
pnpm lint && pnpm typecheck && pnpm test
git add -A
git commit -m "docs: v0.6.0 — Sim Lab, /learn pages, deploy notes"
```

### Task 5.2: Final verification

- [ ] **Step 1:** Run the full suite once more: `pnpm lint && pnpm typecheck && pnpm test`.
- [ ] **Step 2:** `pnpm generate` one final time; confirm `dist/_headers` has `worker-src 'self'` and all new routes exist under `dist/`.
- [ ] **Step 3:** Final browser smoke of the built preview (Sim Lab run + all /learn pages), viewcap screenshots for the record.
- [ ] **Step 4:** Report status to the user. **Do not push** — the user pushes (and fixes commit timestamps) when ready.

---

## Self-Review (author checklist — completed)

- **Spec coverage:** risk/bankroll lab (Phase 0–2) ✓; bust-or-cap session model (Task 0.1) ✓; all four visualizations (Tasks 2.2–2.5) ✓ + headline stats (2.1) ✓; `/learn` index + four topic pages (Phase 3) ✓; layered intuition→rigor with live data (LearnSection + LearnDisclosure, Tasks 3.1–3.5) ✓; `sessions.ts` sibling layer reusing `spin()`/`nextSpinCost()`/`initMachineState()`, `simulateMachine` untouched (Phase 0) ✓; native module worker + `useSimWorker`, no new deps (Phase 1) ✓; cooperative cancel (Task 1.1) ✓; deterministic per-session seeds (Task 0.1) ✓; exact finalize-time aggregation (Task 0.2) ✓; CSP `worker-src` + prerender + verify (Phase 4) ✓; version 0.6.0 + docs/branding (Phase 5) ✓.
- **Type consistency:** `SessionOptions`/`SessionResult`/`SessionRecord`/`SimLabContext`/`SimLabResult`/`SimLabOptions`/`SimLabRun` defined in Task 0.1–0.3 and reused verbatim by the worker (1.1), composable (1.2), and every chart (2.x). `survival` is `{ spins, fraction }[]`, `endHistogram` adds `bustCount`, charts read those exact shapes. `SimRunParams` defined in 1.2 and consumed by `LabForm` (2.6) and the page.
- **Placeholder scan:** engine/worker/composable/charts are full code; the four-quadrant-distinct `/learn` topic pages (3.3–3.5) specify exact source files to read, exact fields, the computation, the headline, the components to use, and test assertions — no "TBD"/"add error handling"/"similar to" placeholders.
