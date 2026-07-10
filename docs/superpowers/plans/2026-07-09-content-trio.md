# Content Trio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the three teaching surfaces from `docs/superpowers/specs/2026-07-09-content-trio-design.md` — a `/learn/myths` page with a live 250k-spin independence experiment, Sim Lab live expected math with an expected-vs-actual histogram overlay, and a History page with machine names, plain-English awards, and an expected-vs-actual takeaway line.

**Architecture:** No engine math changes. One new seeded experiment util (mythsExperiment, the ldwExperiment pattern) rides the existing `rtp.worker` via one new protocol message; the Sim Lab panel and History takeaway are pure presentation over `ExactRtpReport` numbers fetched through the existing `rtpClient`/`useExactRtp` cache (sync fallback keeps SSG + vitest working untouched).

**Tech Stack:** Nuxt 4 / Vue 3 `<script setup lang="ts">` (versions per package.json: nuxt ^4.4.2, vue ^3.5.38), Pinia 3, vitest 4 (+ happy-dom for components), Tailwind 4 classes, pnpm.

## Global Constraints

- Code style: no semicolons, single quotes, 2-space indent, explicit return types on exported functions (repo eslint config enforces — `pnpm lint` must pass per task).
- Never import the engine barrel (`~/engine`) from worker-shared utils — leaf modules only (`~/engine/stepper`, `~/engine/rng`, `~/engine/exactRtp`), matching `ldwExperiment.ts`.
- Frozen-number tests: seeded experiments pin their published figures exactly (house pattern: LDW's 63.34%).
- Per-task gate: `pnpm lint` AND the task's targeted `pnpm vitest run <files>` — run in foreground, read the exit code (never pipe through `tail`).
- Do NOT run `pnpm dev` at any point (contends with `.nuxt` typecheck state).
- Commit after every task; conventional-commit style (`feat(scope): …`); **no AI co-author trailers of any kind**.
- Prod strips `data-test` attributes — fine to use them in tests (vitest is non-prod).
- Money renders via existing `~/utils/format` helpers (`formatCents`, `formatCentsExact`, `formatSignedCents`, `formatPercent`, `formatOdds`) — never hand-format.

---

### Task 1: `mythsExperiment` util + frozen tests

**Files:**
- Create: `app/utils/mythsExperiment.ts`
- Test: `tests/utils/mythsExperiment.test.ts`

**Interfaces:**
- Consumes: `SEVENS_ABLAZE` (`app/machines/sevens-ablaze.ts`), `spinStepper(def, state, coins, rand)` (`app/engine/stepper.ts`), `mulberry32(seed)` (`app/engine/rng.ts`), `exactRtp(def)` (`app/engine/exactRtp.ts` leaf), `MachineSessionState` (`app/engine/types.ts`).
- Produces: `MYTHS_SPINS: number`, `interface MythsExperimentResult`, `runMythsExperiment(): MythsExperimentResult` — Tasks 2 and 3 import these names exactly.

- [ ] **Step 1: Write the failing test** (structural assertions first; frozen pins added in Step 5)

```ts
// tests/utils/mythsExperiment.test.ts
import { describe, expect, it } from 'vitest'
import { MYTHS_SPINS, runMythsExperiment } from '../../app/utils/mythsExperiment'

describe('runMythsExperiment', () => {
  it('is deterministic and refutes streak memory: every bucket sits at the overall hit rate', () => {
    const r = runMythsExperiment()
    expect(r.spins).toBe(MYTHS_SPINS)
    expect(r.buckets.length).toBe(8)
    for (const b of r.buckets) {
      expect(b.samples, `bucket "${b.label}" must have real sample volume`).toBeGreaterThan(1000)
      expect(Math.abs(b.hitRate - r.overallHitRate), `bucket "${b.label}" must match the overall rate`).toBeLessThan(0.02)
    }
    expect(r.longestDrought).toBeGreaterThan(20)
    expect(r.jackpots).toBeGreaterThan(5)
    expect(r.jackpotGaps).not.toBeNull()
    expect(r.jackpotGaps!.min).toBeLessThan(r.jackpotGaps!.max)
    // engine-derived, not hardcoded: P(3×F7) = 27/72^3 = 1/13,824
    expect(r.expectedGap).toBeCloseTo(13824, 0)
    const again = runMythsExperiment()
    expect(again).toEqual(r) // pure function of the fixed seed
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/utils/mythsExperiment.test.ts`
Expected: FAIL — cannot resolve `app/utils/mythsExperiment`.

- [ ] **Step 3: Write the implementation**

```ts
// app/utils/mythsExperiment.ts
// The /learn/myths live experiment, shared by the rtp.worker, the no-Worker
// sync fallback, and the tests (the ldwExperiment pattern). Seeded
// (mulberry32(20260709)) so the page can promise "reload and the numbers
// repeat exactly". Leaf-module imports on purpose: the worker bundle needs
// the stepper evaluator, the RNG, and the exact math — not the engine barrel.
import { SEVENS_ABLAZE } from '~/machines/sevens-ablaze'
import { spinStepper } from '~/engine/stepper'
import { mulberry32 } from '~/engine/rng'
import { exactRtp } from '~/engine/exactRtp'
import type { MachineSessionState } from '~/engine/types'

export const MYTHS_SPINS = 250_000

export interface MythsBucket {
  label: string
  samples: number
  hitRate: number
}

export interface MythsExperimentResult {
  spins: number
  /** P(any pay) across all spins — the number every bucket must match */
  overallHitRate: number
  /** hit rate conditioned on what just happened — the refutation, as data */
  buckets: MythsBucket[]
  /** longest run of consecutive no-pay spins observed */
  longestDrought: number
  /** 3×F7 top-award hits ('3f7') */
  jackpots: number
  /** spins between consecutive jackpots (n−1 gaps) */
  jackpotGaps: { min: number, max: number, mean: number } | null
  /** engine-exact expected spins per jackpot: 1 / P('3f7') */
  expectedGap: number
}

/** Which conditional bucket does a spin belong to, given the streak BEFORE it? */
function bucketIndex(lossStreak: number, winStreak: number): number | null {
  if (winStreak >= 2) return 7 // after 2+ straight wins
  if (winStreak === 1) return 6 // after a win
  if (lossStreak >= 10) return 5
  if (lossStreak >= 5) return 4
  if (lossStreak >= 1) return lossStreak - 1 // 1..4 → 0..3
  return null // very first spin: no history yet
}

const BUCKET_LABELS = [
  'after 1 straight loss', 'after 2 straight losses', 'after 3 straight losses',
  'after 4 straight losses', 'after 5–9 straight losses', 'after 10+ straight losses',
  'after a win', 'after 2+ straight wins'
]

export function runMythsExperiment(): MythsExperimentResult {
  const def = SEVENS_ABLAZE
  // 1 coin on purpose: the top award is the fixed 1000-credit pay, so there is
  // no progressive meter to explain away. All-null session state is safe — the
  // meter branch requires maxCoins AND live progressive state.
  const state: MachineSessionState = {
    progressive: null, videoFeature: null, pachislo: null, blackjackReel: null, lockReel: null
  }
  const rand = mulberry32(20260709)
  const samples = new Array<number>(BUCKET_LABELS.length).fill(0)
  const bucketHits = new Array<number>(BUCKET_LABELS.length).fill(0)
  let hits = 0
  let lossStreak = 0
  let winStreak = 0
  let longestDrought = 0
  let jackpots = 0
  let lastJackpotSpin = -1
  const gaps: number[] = []
  for (let i = 0; i < MYTHS_SPINS; i++) {
    const idx = bucketIndex(lossStreak, winStreak)
    const out = spinStepper(def, state, 1, rand)
    const hit = out.totalPayout > 0
    if (idx !== null) {
      samples[idx]!++
      if (hit) bucketHits[idx]!++
    }
    if (hit) {
      hits++
      winStreak++
      lossStreak = 0
    } else {
      lossStreak++
      winStreak = 0
      if (lossStreak > longestDrought) longestDrought = lossStreak
    }
    if (out.wins.some(w => w.entryId === '3f7')) {
      jackpots++
      if (lastJackpotSpin >= 0) gaps.push(i - lastJackpotSpin)
      lastJackpotSpin = i
    }
  }
  const p3f7 = exactRtp(def).breakdown.find(b => b.entryId === '3f7')?.probability ?? 0
  return {
    spins: MYTHS_SPINS,
    overallHitRate: hits / MYTHS_SPINS,
    buckets: BUCKET_LABELS.map((label, i) => ({
      label, samples: samples[i]!, hitRate: samples[i]! > 0 ? bucketHits[i]! / samples[i]! : 0
    })),
    longestDrought,
    jackpots,
    jackpotGaps: gaps.length > 0
      ? { min: Math.min(...gaps), max: Math.max(...gaps), mean: gaps.reduce((a, b) => a + b, 0) / gaps.length }
      : null,
    expectedGap: p3f7 > 0 ? 1 / p3f7 : 0
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/utils/mythsExperiment.test.ts`
Expected: PASS. If a bucket misses the 0.02 tolerance (possible but unlikely with this seed), bump the seed constant by 1 and re-run — then keep whichever seed passed, permanently.

- [ ] **Step 5: Freeze the published numbers**

Temporarily add `console.log(JSON.stringify(runMythsExperiment(), null, 2))` inside the test, run it once, copy the actual values, remove the log, and append these pins to the same `it` (with the printed values substituted — these examples show the shape):

```ts
    // Frozen (mulberry32(20260709)): the page publishes these; they must not drift.
    expect(r.overallHitRate).toBeCloseTo(0.1572, 3) // ← replace with printed value
    expect(r.jackpots).toBe(18) //                     ← replace with printed value
    expect(r.jackpotGaps!.min).toBe(123) //            ← replace with printed value
    expect(r.jackpotGaps!.max).toBe(45678) //          ← replace with printed value
```

- [ ] **Step 6: Re-run test + lint, verify exit codes**

Run: `pnpm vitest run tests/utils/mythsExperiment.test.ts && pnpm lint`
Expected: both PASS (exit 0).

- [ ] **Step 7: Commit**

```bash
git add app/utils/mythsExperiment.ts tests/utils/mythsExperiment.test.ts
git commit -m "feat(learn): seeded 250k-spin myths experiment (streak-conditioned hit rates, jackpot gaps)"
```

---

### Task 2: rtp.worker plumbing for the myths experiment

**Files:**
- Modify: `app/workers/rtp-worker-protocol.ts`
- Modify: `app/workers/rtp.worker.ts`
- Modify: `app/utils/rtpClient.ts`
- Test: `tests/utils/rtpClient.test.ts`

**Interfaces:**
- Consumes: `runMythsExperiment()`, `MythsExperimentResult` from Task 1.
- Produces: `mythsExperimentAsync(): Promise<MythsExperimentResult>` exported from `~/utils/rtpClient` — Task 3's page calls exactly this.

- [ ] **Step 1: Write the failing test** — append to `tests/utils/rtpClient.test.ts` inside the existing `describe`:

```ts
  it('runs the myths experiment through the same fallback', async () => {
    expect(await mythsExperimentAsync()).toEqual(runMythsExperiment())
  })
```

and extend the imports at the top of the file:

```ts
import { exactRtpAsync, ldwExperimentAsync, mythsExperimentAsync, peekExactRtp } from '../../app/utils/rtpClient'
import { runMythsExperiment } from '../../app/utils/mythsExperiment'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/utils/rtpClient.test.ts`
Expected: FAIL — `mythsExperimentAsync` is not exported.

- [ ] **Step 3: Implement the protocol + worker + client**

`app/workers/rtp-worker-protocol.ts` — add the myths message pair:

```ts
// app/workers/rtp-worker-protocol.ts
import type { ExactRtpReport } from '~/engine'
import type { ExactRtpOptions } from '~/engine/exactRtp'
import type { LdwExperimentResult } from '~/utils/ldwExperiment'
import type { MythsExperimentResult } from '~/utils/mythsExperiment'

export type RtpWorkerIncoming
  = | { type: 'exactRtp', reqId: number, machineId: string, opts: ExactRtpOptions }
    | { type: 'ldw', reqId: number }
    | { type: 'myths', reqId: number }

export type RtpWorkerOutgoing
  = | { type: 'result', reqId: number, report: ExactRtpReport }
    | { type: 'ldwResult', reqId: number, result: LdwExperimentResult }
    | { type: 'mythsResult', reqId: number, result: MythsExperimentResult }
    | { type: 'error', reqId: number, message: string }
```

`app/workers/rtp.worker.ts` — add one branch after the `ldw` branch (and the import):

```ts
import { runMythsExperiment } from '~/utils/mythsExperiment'
```

```ts
    if (msg.type === 'myths') {
      const out: RtpWorkerOutgoing = { type: 'mythsResult', reqId: msg.reqId, result: runMythsExperiment() }
      self.postMessage(out)
      return
    }
```

`app/utils/rtpClient.ts` — three edits.

1. Imports:

```ts
import { runMythsExperiment } from '~/utils/mythsExperiment'
import type { MythsExperimentResult } from '~/utils/mythsExperiment'
```

2. `Waiter` gains a resolver (and the dispatch handles the new message):

```ts
interface Waiter {
  resolveReport?: (r: ExactRtpReport) => void
  resolveLdw?: (r: LdwExperimentResult) => void
  resolveMyths?: (r: MythsExperimentResult) => void
  reject: (e: Error) => void
}
```

In `getWorker()`'s `onmessage`, replace the two-way dispatch with:

```ts
    if (msg.type === 'result') w.resolveReport?.(msg.report)
    else if (msg.type === 'ldwResult') w.resolveLdw?.(msg.result)
    else if (msg.type === 'mythsResult') w.resolveMyths?.(msg.result)
    else w.reject(new Error(msg.message))
```

3. Append the public function (a structural clone of `ldwExperimentAsync`):

```ts
let mythsCache: MythsExperimentResult | null = null
let mythsPending: Promise<MythsExperimentResult> | null = null

export function mythsExperimentAsync(): Promise<MythsExperimentResult> {
  if (mythsCache !== null) return Promise.resolve(mythsCache)
  if (mythsPending !== null) return mythsPending

  const w = getWorker()
  if (w === null) {
    mythsCache = runMythsExperiment()
    return Promise.resolve(mythsCache)
  }

  const reqId = nextReqId++
  mythsPending = new Promise<MythsExperimentResult>((resolve, reject) => {
    waiters.set(reqId, { resolveMyths: resolve, reject })
    const msg: RtpWorkerIncoming = { type: 'myths', reqId }
    w.postMessage(msg)
  })
    .catch(() => runMythsExperiment())
    .then((result) => {
      mythsCache = result
      mythsPending = null
      return result
    })
  return mythsPending
}
```

- [ ] **Step 4: Run test + lint**

Run: `pnpm vitest run tests/utils/rtpClient.test.ts tests/utils/mythsExperiment.test.ts && pnpm lint`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/workers/rtp-worker-protocol.ts app/workers/rtp.worker.ts app/utils/rtpClient.ts tests/utils/rtpClient.test.ts
git commit -m "feat(worker): myths experiment runs in the rtp.worker (cached, sync no-Worker fallback)"
```

---

### Task 3: `/learn/myths` page, hub card, glossary terms

**Files:**
- Create: `app/pages/learn/myths.vue`
- Modify: `app/pages/learn/index.vue` (9th topic card)
- Modify: `app/pages/learn/glossary.vue` (2 new entries)
- Test: `tests/components/learnPages.test.ts`

**Interfaces:**
- Consumes: `mythsExperimentAsync()` (Task 2), `MYTHS_SPINS`, `MythsExperimentResult` (Task 1), `formatPercent`/`formatOdds` (`~/utils/format`), `LearnSection`/`LearnDisclosure` components.
- Produces: route `/learn/myths` (nothing downstream imports it).

- [ ] **Step 1: Write the failing tests** — append to `tests/components/learnPages.test.ts`:

```ts
import Myths from '../../app/pages/learn/myths.vue'
```

```ts
describe('myths', () => {
  it('states the myths in their own voice and refutes them with the live experiment', async () => {
    const w = mount(Myths, { global: { stubs } })
    await nextTick() // experiment runs onMounted…
    await nextTick() // …and resolves through the rtpClient fallback's microtask
    const t = w.text().toLowerCase()
    expect(t).toContain('gambler')
    expect(t).toContain('due')
    expect(t).toContain('no memory')
    expect(w.text()).toMatch(/250,000/)
    expect(w.text()).toMatch(/\d+\.\d+%/) // live hit rates rendered
  })

  it('shows the jackpot-gap evidence with engine-exact odds', async () => {
    const w = mount(Myths, { global: { stubs } })
    await nextTick()
    await nextTick()
    expect(w.text()).toMatch(/1 in 13,824/) // formatOdds of the exact 3×F7 probability
    expect(w.text().toLowerCase()).toContain('drought')
  })
})
```

In the existing `glossary` describe, extend the second term list (`defines the terms the app itself displays`) with `'gambler', 'independence'` and the anchor list in `gives every entry a unique anchor id` with `'gamblers-fallacy'`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/components/learnPages.test.ts`
Expected: FAIL — myths.vue missing + glossary terms missing.

- [ ] **Step 3: Create the page**

```vue
<!-- app/pages/learn/myths.vue -->
<script setup lang="ts">
import { onMounted, ref } from 'vue'
// A live, seeded independence experiment: a quarter-million spins of the REAL
// Sevens Ablaze engine, hit rates conditioned on what just happened. Same
// seed, same numbers, every visit — the experiment lives in
// ~/utils/mythsExperiment so the worker, the fallback, and the tests all run
// the same code.
import { MYTHS_SPINS as N, type MythsExperimentResult } from '~/utils/mythsExperiment'
import { mythsExperimentAsync } from '~/utils/rtpClient'
import { formatOdds, formatPercent } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const exp = ref<MythsExperimentResult | null>(null)
onMounted(async () => {
  // Runs in the rtp.worker in real browsers — first paint never waits on
  // 250,000 spins. Same seed, same numbers, exactly as promised below.
  exp.value = await mythsExperimentAsync()
})

const after10 = (r: MythsExperimentResult): number =>
  r.buckets.find(b => b.label.startsWith('after 10+'))?.hitRate ?? 0
</script>

<template>
  <div class="px-4 py-8 max-w-[760px] mx-auto space-y-8">
    <nav class="text-xs text-neutral-400">
      <NuxtLink
        to="/learn"
        class="hover:text-amber-400"
      >← Learn</NuxtLink>
    </nav>
    <h1 class="text-3xl font-bold">
      Myths: due, hot &amp; cold
    </h1>
    <p class="text-neutral-400 text-sm">
      Every myth below is stated the way it gets said on a real floor — then a
      quarter-million live spins of Sevens Ablaze, run through the same engine
      the game page uses, get to answer.
    </p>

    <LearnSection
      title="“It hasn't paid in ages — it has to hit soon.”"
      :headline="exp ? `${formatPercent(exp.overallHitRate)} vs ${formatPercent(after10(exp))}` : 'measuring…'"
      headline-label="Hit rate on any random spin vs. immediately after 10+ straight losses — measured live in your browser"
    >
      <template #intuition>
        <p>
          That feeling is the <strong>gambler's fallacy</strong>: the belief that a
          run of losses makes a win more likely, as if the machine owed you one.
          But a slot machine <strong>has no memory</strong>. Every spin is one fresh
          draw from the random number generator; the reels are a display, not a
          state. The machine doesn't know it just took your last twenty bets —
          nothing inside it counts droughts, and nothing ripens.
        </p>
        <p>
          The two numbers above are the whole argument: the chance of a pay right
          after a brutal cold streak is the same chance as on any other spin.
        </p>
      </template>
      <LearnDisclosure :label="`Show the experiment — ${N.toLocaleString('en-US')} real spins, conditioned on the streak`">
        <p
          v-if="!exp"
          class="text-neutral-400"
        >
          Running {{ N.toLocaleString('en-US') }} seeded spins in your browser…
        </p>
        <table
          v-else
          class="w-full text-xs font-mono"
        >
          <thead>
            <tr class="text-neutral-500 text-left">
              <th class="py-1 pr-2 font-normal">
                The spin played…
              </th>
              <th class="py-1 px-2 text-right font-normal">
                Spins measured
              </th>
              <th class="py-1 pl-2 text-right font-normal">
                Hit rate
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800/60">
            <tr>
              <td class="py-1 pr-2 text-neutral-200">
                on any spin (overall)
              </td>
              <td class="py-1 px-2 text-right text-neutral-400">
                {{ exp.spins.toLocaleString('en-US') }}
              </td>
              <td class="py-1 pl-2 text-right text-amber-300">
                {{ formatPercent(exp.overallHitRate) }}
              </td>
            </tr>
            <tr
              v-for="b in exp.buckets"
              :key="b.label"
            >
              <td class="py-1 pr-2 text-neutral-200">
                {{ b.label }}
              </td>
              <td class="py-1 px-2 text-right text-neutral-400">
                {{ b.samples.toLocaleString('en-US') }}
              </td>
              <td class="py-1 pl-2 text-right text-emerald-400">
                {{ formatPercent(b.hitRate) }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="text-neutral-400">
          {{ N.toLocaleString('en-US') }} seeded spins of Sevens Ablaze (1 coin),
          run through the real engine at render time — reload and the numbers
          repeat exactly. Cold streaks, hot streaks, long droughts: the next
          spin's odds never move.
        </p>
      </LearnDisclosure>
    </LearnSection>

    <LearnSection
      title="“The jackpot is due.”"
      :headline="exp ? formatOdds(1 / exp.expectedGap) : 'measuring…'"
      headline-label="Odds of the 3× Flaming Seven jackpot — identical on every single spin, computed exactly from the reels"
    >
      <template #intuition>
        <p>
          No jackpot is ever due, because nothing accumulates toward it. The odds
          above come from the machine's own
          <NuxtLink
            to="/learn/telnaes-reels"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >virtual reel weights</NuxtLink> — and they were exactly the same on
          every one of the {{ N.toLocaleString('en-US') }} spins.
        </p>
        <p v-if="exp && exp.jackpotGaps">
          In the experiment the jackpot landed {{ exp.jackpots }} times. The gap
          between one jackpot and the next ran from
          <strong>{{ exp.jackpotGaps.min.toLocaleString('en-US') }}</strong> spins to
          <strong>{{ exp.jackpotGaps.max.toLocaleString('en-US') }}</strong> — around an
          expected {{ Math.round(exp.expectedGap).toLocaleString('en-US') }}. A short gap
          didn't mean the machine was "hot", and a long one didn't mean it was
          "filling up": both are just what independent {{ formatOdds(1 / exp.expectedGap) }}
          odds look like when you actually watch them. The longest stretch without
          <em>any</em> pay was {{ exp.longestDrought }} spins — droughts are ordinary,
          not meaningful.
        </p>
        <p>
          (The one number on a real floor that <em>does</em> grow is a progressive
          meter — the display of what players fed it, not better odds. See
          <NuxtLink
            to="/learn/house-edge"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >house edge</NuxtLink>.)
        </p>
      </template>
    </LearnSection>

    <LearnSection title="“This machine runs hot.” / “That one's gone cold.”">
      <template #intuition>
        <p>
          Streaks are real — you just watched a {{ exp ? exp.longestDrought : 'long' }}-spin
          drought happen in seeded data. What's not real is the machine <em>knowing</em>
          about them. Hot and cold are stories told <strong>afterward</strong> about
          runs that any independent sequence produces; the streak-conditioned table
          above shows the next spin never gets the memo. Picking a machine "because
          it's hot" changes the story you'll tell, not the odds you'll get.
        </p>
        <p>
          Want to see the draw happen instead of guessing at it? Every betting
          machine's X-ray panel shows the RNG numbers behind each spin. And the one
          floor machine that LOOKS like it has memory —
          <NuxtLink
            to="/learn/pachislo"
            class="text-amber-400 hover:text-amber-300 underline underline-offset-2"
          >Stock Rush's stock meter</NuxtLink> — is a disclosed pachislo mechanic,
          priced into its exact math, not a mood.
        </p>
      </template>
    </LearnSection>
  </div>
</template>
```

- [ ] **Step 4: Add the hub card** — in `app/pages/learn/index.vue`, insert after the ldw-near-miss topic (before glossary):

```ts
  { to: '/learn/myths', icon: 'i-lucide-flame', title: 'Myths: due, hot & cold', blurb: 'No machine is ever due and none of them run hot — a quarter-million live spins prove the reels have no memory.' },
```

- [ ] **Step 5: Add the glossary entries** — in `app/pages/learn/glossary.vue`, insert alphabetically (after `free-spins`, and after `house-edge`, respectively):

```ts
  { id: 'gamblers-fallacy', term: 'Gambler\'s fallacy', def: 'The belief that a run of losses makes a win more likely — that the machine "owes" you. It doesn\'t: every spin is an independent draw, and the odds after ten straight losses are identical to the odds on any other spin.', link: { to: '/learn/myths', label: 'watch it fail across 250,000 live spins' } },
```

```ts
  { id: 'independence', term: 'Independence (of spins)', def: 'The statistical property that makes slot myths myths: each spin is a fresh random draw, unaffected by every spin before it. No memory, no ripening, no hot or cold — streaks happen in the results, never in the odds.', link: { to: '/learn/myths', label: 'the live experiment' } },
```

- [ ] **Step 6: Run tests + lint**

Run: `pnpm vitest run tests/components/learnPages.test.ts tests/utils/learnLink.test.ts && pnpm lint`
Expected: PASS (learnLink included to catch any hub/topic coupling), exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/pages/learn/myths.vue app/pages/learn/index.vue app/pages/learn/glossary.vue tests/components/learnPages.test.ts
git commit -m "feat(learn): myths page — gambler's fallacy, due jackpots, hot/cold refuted by a live 250k-spin experiment"
```

---

### Task 4: `labMath` util + `edgeOpts` helper

**Files:**
- Create: `app/utils/labMath.ts`
- Modify: `app/utils/floorIntel.ts` (add `edgeOpts`)
- Test: `tests/utils/labMath.test.ts`

**Interfaces:**
- Consumes: `ExactRtpReport`, `MachineDef` (`~/engine`), `FloorIntelOptions` (`~/utils/floorIntel`).
- Produces: `labExpectedMath(def, report, p): LabExpectedMathModel` and `edgeOpts(def, coins): FloorIntelOptions` — Tasks 5 and 9 import these names exactly. `LabExpectedMathModel` fields: `perSpinCostCents, perSpinReturnCents, perSpinLossCents, capCoinInCents, capExpectedLossCents, capExpectedEndCents, expectationBustSpins, sessionSigmaCents, n0Spins` (all `number`, the two nullable ones `number | null`).

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/labMath.test.ts
import { describe, expect, it } from 'vitest'
import { exactRtp } from '../../app/engine'
import type { ExactRtpReport, MachineDef } from '../../app/engine'
import { SEVENS_ABLAZE } from '../../app/machines/sevens-ablaze'
import { edgeOpts } from '../../app/utils/floorIntel'
import { labExpectedMath } from '../../app/utils/labMath'

// Hand-checkable fixture: $1 denom, 90% RTP, per-coin variance 25.
const fakeDef = { id: 'fake', denominationCents: 100, family: 'stepper', maxCoins: 2 } as unknown as MachineDef
const fakeReport = { rtpPerCoin: 0.9, hitFrequency: 0.2, variancePerCoin: 25, breakdown: [] } as ExactRtpReport

describe('labExpectedMath', () => {
  it('computes the no-bust expectation model by hand-checkable arithmetic', () => {
    const m = labExpectedMath(fakeDef, fakeReport, { startCredits: 100, bet: 2, spinCap: 500 })
    expect(m.perSpinCostCents).toBe(200) // 2 coins × $1
    expect(m.perSpinReturnCents).toBe(180) // × 0.9
    expect(m.perSpinLossCents).toBe(20) // the edge's toll
    expect(m.capCoinInCents).toBe(100_000) // 500 spins × $2
    expect(m.capExpectedLossCents).toBe(10_000) // × 10% edge
    expect(m.capExpectedEndCents).toBe(0) // $100 start − $100 expected loss
    expect(m.expectationBustSpins).toBe(500) // start ÷ per-spin loss
    // σ_session = bet × √(spins × var/coin) × denom = 2 × √12500 × 100¢
    expect(m.sessionSigmaCents).toBeCloseTo(2 * Math.sqrt(500 * 25) * 100, 6)
    expect(m.n0Spins).toBeCloseTo(25 / 0.1 ** 2, 6) // var / edge² = 2500
  })

  it('returns null spins-to-bust and N₀ when there is no edge', () => {
    const evenReport = { ...fakeReport, rtpPerCoin: 1 }
    const m = labExpectedMath(fakeDef, evenReport, { startCredits: 100, bet: 1, spinCap: 100 })
    expect(m.perSpinLossCents).toBe(0)
    expect(m.expectationBustSpins).toBeNull()
    expect(m.n0Spins).toBeNull()
  })

  it('holds together on a real machine and its exact report', () => {
    const report = exactRtp(SEVENS_ABLAZE)
    const m = labExpectedMath(SEVENS_ABLAZE, report, { startCredits: 100, bet: 2, spinCap: 500 })
    expect(m.perSpinCostCents).toBe(200)
    expect(m.perSpinLossCents).toBeGreaterThan(0)
    expect(m.capExpectedEndCents).toBeLessThan(100 * 100)
    expect(m.n0Spins).toBeGreaterThan(1000) // variance dwarfs a ~5% edge
  })
})

describe('edgeOpts', () => {
  it('passes coins only for the families whose exact math consumes it cheaply', () => {
    expect(edgeOpts(SEVENS_ABLAZE, 2)).toEqual({ coins: 2 })
    expect(edgeOpts({ family: 'bally-em' } as MachineDef, 3)).toEqual({ coins: 3 })
    // video exact math is the expensive 24⁵ enumeration — never fork its cache by bet
    expect(edgeOpts({ family: 'video' } as MachineDef, 10)).toEqual({})
    expect(edgeOpts({ family: 'pachislo' } as MachineDef, 2)).toEqual({})
    expect(edgeOpts(SEVENS_ABLAZE, undefined)).toEqual({})
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/utils/labMath.test.ts`
Expected: FAIL — modules/exports missing.

- [ ] **Step 3: Implement**

Append to `app/utils/floorIntel.ts`:

```ts
/**
 * Exact-report options for "what does THIS bet do": stepper and Bally exact
 * math consume `coins` and recompute instantly; video's 24⁵ enumeration must
 * never be forked per bet (its per-coin RTP doesn't depend on it anyway).
 */
export function edgeOpts(def: MachineDef, coins: number | undefined): FloorIntelOptions {
  if (coins === undefined) return {}
  return def.family === 'stepper' || def.family === 'bally-em' ? { coins } : {}
}
```

Create `app/utils/labMath.ts`:

```ts
// app/utils/labMath.ts
// The Sim Lab's "math before you spin" (guidelines §2.5): closed-form
// expectation and volatility for the CURRENT form values, all in cents, all
// labeled MODEL by the component that renders them. The model deliberately
// assumes every spin plays (no bust truncation) — the page says so, and the
// gap against the measured mean is itself the lesson.
import type { ExactRtpReport, MachineDef } from '~/engine'

export interface LabExpectedMathParams {
  startCredits: number
  bet: number
  spinCap: number
}

export interface LabExpectedMathModel {
  perSpinCostCents: number
  perSpinReturnCents: number
  perSpinLossCents: number
  capCoinInCents: number
  capExpectedLossCents: number
  /** start − expected loss; negative means expectation alone busts the bankroll */
  capExpectedEndCents: number
  /** spins at which pure expectation crosses $0 (null when the game has no edge) */
  expectationBustSpins: number | null
  /** one-session ±1σ of luck: bet × √(spinCap × variancePerCoin), in cents */
  sessionSigmaCents: number
  /** spins for the edge to outgrow 1σ of luck: variancePerCoin / edge² (null when no edge) */
  n0Spins: number | null
}

export function labExpectedMath(
  def: MachineDef,
  report: ExactRtpReport,
  p: LabExpectedMathParams
): LabExpectedMathModel {
  const denom = def.denominationCents
  const edge = 1 - report.rtpPerCoin
  const perSpinCostCents = p.bet * denom
  const perSpinReturnCents = perSpinCostCents * report.rtpPerCoin
  const perSpinLossCents = perSpinCostCents - perSpinReturnCents
  const capCoinInCents = p.spinCap * perSpinCostCents
  const capExpectedLossCents = capCoinInCents * edge
  const startCents = p.startCredits * denom
  return {
    perSpinCostCents,
    perSpinReturnCents,
    perSpinLossCents,
    capCoinInCents,
    capExpectedLossCents,
    capExpectedEndCents: startCents - capExpectedLossCents,
    expectationBustSpins: perSpinLossCents > 0 ? Math.ceil(startCents / perSpinLossCents) : null,
    sessionSigmaCents: p.bet * Math.sqrt(p.spinCap * report.variancePerCoin) * denom,
    n0Spins: edge > 0 ? report.variancePerCoin / (edge * edge) : null
  }
}
```

- [ ] **Step 4: Run test + lint**

Run: `pnpm vitest run tests/utils/labMath.test.ts tests/utils/floorIntel.test.ts && pnpm lint`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/utils/labMath.ts app/utils/floorIntel.ts tests/utils/labMath.test.ts
git commit -m "feat(lab): closed-form expected-math model (per-spin EV, no-bust end, sigma, N0) + edgeOpts"
```

---

### Task 5: LabForm `change` emit + `LabExpectedMath` panel + sim-lab wiring

**Files:**
- Modify: `app/components/lab/LabForm.vue`
- Create: `app/components/lab/LabExpectedMath.vue`
- Modify: `app/pages/sim-lab.vue`
- Test: `tests/components/labForm.test.ts`, create `tests/components/labExpectedMath.test.ts`

**Interfaces:**
- Consumes: `labExpectedMath`, `LabExpectedMathModel` (Task 4), `edgeOpts` (Task 4), `useExactRtp` (`~/composables/useExactRtp`), `SimRunParams` (`~/composables/useSimWorker`), `SimLabResult` (`~/engine/sessions`).
- Produces: `LabForm` emits `change: [SimRunParams]` (immediate + on every edit); `LabExpectedMath` props `{ def: MachineDef | null, model: LabExpectedMathModel | null, result: SimLabResult | null }`. `sim-lab.vue` owns a `runExpectedEndCredits: Ref<number | null>` that Task 6's histogram prop consumes.

- [ ] **Step 1: Write the failing tests**

Append to `tests/components/labForm.test.ts`:

```ts
  it('emits live change payloads: immediately on mount and on every edit', async () => {
    const w = mount(LabForm, { props: { running: false }, global: { stubs } })
    const initial = w.emitted('change')
    expect(initial).toBeTruthy() // immediate watch: the math panel is never blank
    await w.find('[data-test="bankroll"]').setValue('20')
    const evs = w.emitted('change')!
    const last = evs[evs.length - 1]![0] as Record<string, number | string>
    expect(last.startCredits).toBe(2000) // $20 at canal-royale's 1¢ denom
  })
```

Create `tests/components/labExpectedMath.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import LabExpectedMath from '../../app/components/lab/LabExpectedMath.vue'
import { SEVENS_ABLAZE } from '../../app/machines/sevens-ablaze'
import { exactRtp } from '../../app/engine'
import { labExpectedMath } from '../../app/utils/labMath'
import type { SimLabResult } from '../../app/engine/sessions'

const stubs = { NuxtLink: { template: '<a><slot /></a>' }, UIcon: true }
const model = labExpectedMath(SEVENS_ABLAZE, exactRtp(SEVENS_ABLAZE), { startCredits: 100, bet: 2, spinCap: 500 })

describe('LabExpectedMath', () => {
  it('renders the model figures, labeled as model', () => {
    const w = mount(LabExpectedMath, { props: { def: SEVENS_ABLAZE, model, result: null }, global: { stubs } })
    const t = w.text().toLowerCase()
    expect(t).toContain('model')
    expect(t).toContain('per spin')
    expect(t).toContain('luck')
    expect(w.text()).toMatch(/\$\d/) // dollar figures rendered
    expect(w.text()).toMatch(/\d[\d,]* spins/) // N₀ / bust-horizon rendered
  })

  it('reconciles model vs measured once a run exists', () => {
    const result = { meanEnd: 80, machineId: 'sevens-ablaze' } as SimLabResult
    const w = mount(LabExpectedMath, { props: { def: SEVENS_ABLAZE, model, result }, global: { stubs } })
    const t = w.text().toLowerCase()
    expect(t).toContain('measured')
    expect(t).toContain('bust') // explains why measured mean > no-bust model
  })

  it('shows a computing state while the exact report is cold', () => {
    const w = mount(LabExpectedMath, { props: { def: SEVENS_ABLAZE, model: null, result: null }, global: { stubs } })
    expect(w.text().toLowerCase()).toContain('computing')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run tests/components/labForm.test.ts tests/components/labExpectedMath.test.ts`
Expected: FAIL — no `change` emit; component missing.

- [ ] **Step 3: Implement LabForm's change emit**

In `app/components/lab/LabForm.vue`, extend the emits and extract the payload builder (the existing `emitRun` body becomes `currentParams()`):

```ts
const emit = defineEmits<{ run: [SimRunParams], change: [SimRunParams] }>()
```

```ts
function currentParams(): SimRunParams {
  const startCredits = Math.max(1, Math.round((bankrollDollars.value * 100) / def.value.denominationCents))
  return {
    machineId: machineId.value,
    startCredits,
    bet: Math.min(Math.max(1, Math.floor(bet.value)), def.value.maxCoins),
    spinCap: Math.max(1, Math.floor(spinCap.value)),
    progressiveMode: 'static',
    sessions: Math.max(1, Math.floor(sessions.value)),
    seed: 1
  }
}

function emitRun(): void {
  emit('run', currentParams())
}

// The live math panel updates as the form is edited, before any run.
watch([machineId, bankrollDollars, bet, spinCap, sessions], () => {
  emit('change', currentParams())
}, { immediate: true })
```

(The existing `watch(machineId, …)` bet-clamp stays as is.)

- [ ] **Step 4: Create the panel component**

```vue
<!-- app/components/lab/LabExpectedMath.vue -->
<script setup lang="ts">
// Presentation-only (guidelines §2.5 "see the math instantly"): the page owns
// the exact report + labExpectedMath; this renders the MODEL numbers and, after
// a run, reconciles them against the MEASURED mean without hand-waving.
import { computed } from 'vue'
import type { MachineDef } from '~/engine'
import type { SimLabResult } from '~/engine/sessions'
import type { LabExpectedMathModel } from '~/utils/labMath'
import { formatCents, formatCentsExact } from '~/utils/format'

const props = defineProps<{
  def: MachineDef | null
  model: LabExpectedMathModel | null
  result: SimLabResult | null
}>()

const spins = (n: number): string => `${Math.round(n).toLocaleString('en-US')} spins`

const cells = computed(() => {
  const m = props.model
  if (m === null) return []
  const end = m.capExpectedEndCents
  return [
    { label: 'Per spin', value: `${formatCentsExact(m.perSpinCostCents)} in · ${formatCentsExact(m.perSpinLossCents)} kept by the house`, gloss: 'Bet size, and the house edge\'s expected toll on each spin' },
    { label: 'If every spin plays', value: `${formatCents(m.capCoinInCents)} wagered · expect to lose ${formatCents(m.capExpectedLossCents)}`, gloss: 'Coin-in and expected loss over the full spin cap, before variance has its say' },
    end >= 0
      ? { label: 'Expected end (model)', value: formatCents(end), gloss: 'Starting bankroll minus the expected loss, if no bust cuts the session short' }
      : { label: 'Expectation busts you first', value: m.expectationBustSpins === null ? '—' : `~${spins(m.expectationBustSpins)}`, gloss: 'At pure expectation the bankroll hits $0 before the spin cap' },
    { label: '±1σ of luck', value: formatCents(m.sessionSigmaCents), gloss: 'One standard deviation of a session\'s ending bankroll — how loudly variance talks over the edge' },
    { label: 'Edge outgrows luck after', value: m.n0Spins === null ? 'never (no edge)' : `~${spins(m.n0Spins)}`, gloss: 'Spins until the expected loss exceeds one standard deviation of luck — before this, variance dominates' }
  ]
})

const measuredEndCents = computed(() => {
  if (props.result === null || props.def === null) return null
  return Math.round(props.result.meanEnd * props.def.denominationCents)
})
</script>

<template>
  <section class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-4 space-y-3">
    <div class="flex items-baseline gap-2">
      <h2 class="text-sm font-bold text-neutral-100">
        The math, before you spin
      </h2>
      <span class="text-[10px] uppercase tracking-widest text-amber-400/80 border border-amber-500/30 rounded px-1.5 py-0.5">model</span>
    </div>
    <p
      v-if="model === null"
      class="text-xs text-neutral-400"
    >
      Computing this machine's exact math…
    </p>
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
    >
      <div
        v-for="c in cells"
        :key="c.label"
        data-test="lab-model"
        :title="c.gloss"
        class="space-y-0.5"
      >
        <div class="text-[10px] uppercase tracking-widest text-neutral-400">
          {{ c.label }}
        </div>
        <div class="text-sm font-mono text-neutral-200">
          {{ c.value }}
        </div>
      </div>
    </div>
    <p
      v-if="model !== null && measuredEndCents !== null"
      class="text-xs text-neutral-400"
    >
      Model expected end
      <span class="font-mono text-amber-300">{{ formatCents(Math.max(0, model.capExpectedEndCents)) }}</span>
      vs measured mean end
      <span class="font-mono text-neutral-200">{{ formatCents(measuredEndCents) }}</span>
      — sessions that bust stop losing early, so the measured mean sits above the
      no-bust model. That gap is bust truncation, not luck.
    </p>
    <p
      v-if="def !== null && (def.family === 'video' || def.family === 'pachislo')"
      class="text-[10px] text-neutral-500"
    >
      {{ def.family === 'video'
        ? 'Volatility figure uses the machine\'s max-lines exact math.'
        : 'Volatility figure is the attribution model at the default operator setting.' }}
    </p>
  </section>
</template>
```

- [ ] **Step 5: Wire the page**

Replace `app/pages/sim-lab.vue`'s script and slot the panel between the form and progress:

```vue
<!-- app/pages/sim-lab.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSimWorker } from '~/composables/useSimWorker'
import type { SimRunParams } from '~/composables/useSimWorker'
import { useExactRtp } from '~/composables/useExactRtp'
import { edgeOpts } from '~/utils/floorIntel'
import { labExpectedMath } from '~/utils/labMath'
import { FLOOR } from '~/machines'
import LabForm from '~/components/lab/LabForm.vue'
import LabExpectedMath from '~/components/lab/LabExpectedMath.vue'
import LabProgress from '~/components/lab/LabProgress.vue'
import LabStatCards from '~/components/lab/LabStatCards.vue'
import SurvivalCurve from '~/components/lab/SurvivalCurve.vue'
import EndHistogram from '~/components/lab/EndHistogram.vue'
import SampleCurves from '~/components/lab/SampleCurves.vue'
import DrawdownHistogram from '~/components/lab/DrawdownHistogram.vue'

const { running, progress, completed, total, result, error, run, cancel } = useSimWorker()

// Live expected math (§2.5): recomputed as the form changes, before any run.
const params = ref<SimRunParams | null>(null)
const def = computed(() => params.value === null ? null : FLOOR.find(m => m.id === params.value!.machineId) ?? null)
const report = useExactRtp(() => def.value, () => edgeOpts(def.value ?? FLOOR[0]!, params.value?.bet))
const model = computed(() => {
  if (def.value === null || report.value === null || params.value === null) return null
  return labExpectedMath(def.value, report.value, params.value)
})

// The histogram overlay reflects the params the run STARTED with, not live edits.
const runExpectedEndCredits = ref<number | null>(null)
function onRun(p: SimRunParams): void {
  runExpectedEndCredits.value = model.value === null || def.value === null
    ? null
    : model.value.capExpectedEndCents / def.value.denominationCents
  run(p)
}
</script>

<template>
  <div class="px-4 py-8 max-w-[1100px] mx-auto space-y-6">
    <header class="space-y-1">
      <h1 class="text-3xl font-bold">
        <span class="text-amber-400">Sim</span> Lab
      </h1>
      <p class="text-neutral-400 text-sm max-w-2xl">
        Run thousands of bankrolls against a machine until they bust or hit a spin cap, and see what
        variance actually does to your money. Every figure comes from the same engine that runs the floor.
      </p>
    </header>

    <LabForm
      :running="running"
      @run="onRun"
      @change="params = $event"
    />
    <LabExpectedMath
      :def="def"
      :model="model"
      :result="result"
    />
    <LabProgress
      v-if="running"
      :progress="progress"
      :completed="completed"
      :total="total"
      @cancel="cancel"
    />
    <p
      v-if="error"
      class="text-rose-400 text-sm"
    >
      {{ error }}
    </p>

    <template v-if="result">
      <LabStatCards :result="result" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SurvivalCurve :result="result" />
        <EndHistogram
          :result="result"
          :expected-end-credits="runExpectedEndCredits"
        />
        <SampleCurves :result="result" />
        <DrawdownHistogram :result="result" />
      </div>
    </template>
  </div>
</template>
```

(Note: `EndHistogram` ignores the unknown prop until Task 6 adds it — Vue treats it as a passthrough attribute, so this wiring is safe to land first.)

- [ ] **Step 6: Run tests + lint**

Run: `pnpm vitest run tests/components/labForm.test.ts tests/components/labExpectedMath.test.ts tests/components/labStatCards.test.ts && pnpm lint`
Expected: PASS, exit 0.

- [ ] **Step 7: Commit**

```bash
git add app/components/lab/LabForm.vue app/components/lab/LabExpectedMath.vue app/pages/sim-lab.vue tests/components/labForm.test.ts tests/components/labExpectedMath.test.ts
git commit -m "feat(lab): live expected-math panel — per-spin EV, no-bust end, sigma, N0 update as the form moves"
```

---

### Task 6: EndHistogram expected-vs-actual markers

**Files:**
- Modify: `app/components/lab/EndHistogram.vue`
- Test: `tests/components/labCharts.test.ts`

**Interfaces:**
- Consumes: the `expected-end-credits` prop Task 5's page already passes (`number | null`).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test** — append to the `EndHistogram` describe in `tests/components/labCharts.test.ts` (the file's shared `result` fixture has `binEdges: [0, 100, 200, 300]`, `meanEnd: 140`):

```ts
  it('overlays the model expected end and the measured mean when provided', () => {
    const w = mount(EndHistogram, { props: { result, expectedEndCredits: 60 } })
    const model = w.find('[data-test="model-end"]')
    const mean = w.find('[data-test="mean-end"]')
    expect(model.exists()).toBe(true)
    expect(mean.exists()).toBe(true)
    // linear map over [0, 300] credits between X0=34 and X1=312
    expect(Number(model.attributes('x1'))).toBeCloseTo(34 + (60 / 300) * (312 - 34), 3)
    expect(Number(mean.attributes('x1'))).toBeCloseTo(34 + (140 / 300) * (312 - 34), 3)
    expect(w.find('svg').attributes('aria-label')).toMatch(/model|expected/i)
  })

  it('draws no markers when the model end is absent', () => {
    const w = mount(EndHistogram, { props: { result } })
    expect(w.find('[data-test="model-end"]').exists()).toBe(false)
    expect(w.find('[data-test="mean-end"]').exists()).toBe(false)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/labCharts.test.ts`
Expected: FAIL — markers not rendered.

- [ ] **Step 3: Implement** — in `app/components/lab/EndHistogram.vue`:

Extend the props and add the mapping + summary:

```ts
const props = defineProps<{ result: SimLabResult, expectedEndCredits?: number | null }>()
```

```ts
const hiCredits = computed(() => {
  const edges = props.result.endHistogram.binEdges
  return Math.max(1, edges[edges.length - 1] ?? 1)
})
const xFor = (credits: number): number =>
  X0 + Math.min(1, Math.max(0, credits / hiCredits.value)) * (X1 - X0)
const modelX = computed(() =>
  props.expectedEndCredits === undefined || props.expectedEndCredits === null
    ? null
    : xFor(Math.max(0, props.expectedEndCredits)))
const meanX = computed(() => modelX.value === null ? null : xFor(props.result.meanEnd))
```

Extend `summary` (inside the existing computed, after the current sentence) so the markers are announced:

```ts
const summary = computed(() =>
  `Distribution of ending bankrolls across ${props.result.sessions} sessions; `
  + `${props.result.endHistogram.bustCount} busted (leftmost bar (near-zero balance)). Start was ${formatCents(Math.round(props.result.startCredits * denom.value))}.`
  + (modelX.value === null
    ? ''
    : ` Model expected end ${formatCents(Math.round(Math.max(0, props.expectedEndCredits!) * denom.value))}; measured mean end ${formatCents(Math.round(props.result.meanEnd * denom.value))}.`)
)
```

Template — after the `<rect v-for …>` block, add markers + a small legend:

```vue
    <template v-if="modelX !== null && meanX !== null">
      <line
        data-test="model-end"
        :x1="modelX"
        :y1="Y0"
        :x2="modelX"
        :y2="Y1"
        stroke="#fbbf24"
        stroke-width="1.5"
        stroke-dasharray="4 3"
      />
      <line
        data-test="mean-end"
        :x1="meanX"
        :y1="Y0"
        :x2="meanX"
        :y2="Y1"
        stroke="#a3a3a3"
        stroke-width="1.5"
      />
      <text
        :x="X1"
        y="18"
        text-anchor="end"
        font-size="8"
        fill="#fbbf24"
      >⋯ expected (model)</text>
      <text
        :x="X1"
        y="28"
        text-anchor="end"
        font-size="8"
        fill="#a3a3a3"
      >— mean (measured)</text>
    </template>
```

- [ ] **Step 4: Run tests + lint**

Run: `pnpm vitest run tests/components/labCharts.test.ts && pnpm lint`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/components/lab/EndHistogram.vue tests/components/labCharts.test.ts
git commit -m "feat(lab): expected-vs-actual markers on the ending-bankroll histogram"
```

---

### Task 7: `entryLabel` util (machine names, plain-English awards, game kinds)

**Files:**
- Create: `app/utils/entryLabel.ts`
- Test: `tests/utils/entryLabel.test.ts`

**Interfaces:**
- Consumes: `ALL_MACHINES` (`~/machines`), `MachineDef` (`~/engine`).
- Produces: `machineName(id: string): string`, `entryLabel(def: MachineDef | null, entryId: string): string`, `gameKindLabel(kind: string): string` — Task 9 imports these names exactly.

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/entryLabel.test.ts
import { describe, expect, it } from 'vitest'
import { FLOOR } from '../../app/machines'
import { CANAL_ROYALE } from '../../app/machines/canal-royale'
import { SEVENS_ABLAZE } from '../../app/machines/sevens-ablaze'
import { STOCK_RUSH } from '../../app/machines/stock-rush'
import { TEMPLE_OF_GOLD } from '../../app/machines/temple-of-gold'
import { entryLabel, gameKindLabel, machineName } from '../../app/utils/entryLabel'

describe('machineName', () => {
  it('resolves floor ids to display names and falls back to the raw id', () => {
    expect(machineName('sevens-ablaze')).toBe('Sevens Ablaze')
    expect(machineName('long-gone-machine')).toBe('long-gone-machine')
  })
})

describe('entryLabel', () => {
  it('humanizes every paytable id on the floor (no raw id leaks)', () => {
    for (const def of FLOOR) {
      if (!('paytable' in def)) continue
      for (const e of def.paytable as { id: string }[]) {
        const label = entryLabel(def, e.id)
        expect(label, `${def.id}/${e.id} must humanize`).not.toBe(e.id)
        expect(label.length).toBeGreaterThan(2)
      }
    }
  })

  it('renders the canonical family shapes', () => {
    expect(entryLabel(CANAL_ROYALE, 'li5')).toBe('5× Winged Lion')
    expect(entryLabel(CANAL_ROYALE, 'sc3')).toBe('3× Gondola Scatter')
    expect(entryLabel(CANAL_ROYALE, 'grand')).toBe('Grand')
    expect(entryLabel(CANAL_ROYALE, 'hold-and-spin')).toBe('Hold & Spin')
    expect(entryLabel(SEVENS_ABLAZE, '3f7')).toBe('3× Flaming Seven')
    expect(entryLabel(SEVENS_ABLAZE, 'mix7')).toBe('Any Flaming Seven / Red Seven')
    expect(entryLabel(STOCK_RUSH, 'big')).toBe('BIG bonus')
    expect(entryLabel(STOCK_RUSH, 'jac')).toBe('JAC win')
    // cascade entry ids are symbol ids
    const sym = Object.keys(TEMPLE_OF_GOLD.symbols)[0]!
    expect(entryLabel(TEMPLE_OF_GOLD, sym)).toContain(TEMPLE_OF_GOLD.symbols[sym]!.label)
  })

  it('never throws: unknown ids and null defs fall back to the raw id', () => {
    expect(entryLabel(CANAL_ROYALE, 'mystery-id')).toBe('mystery-id')
    expect(entryLabel(null, 'li5')).toBe('li5')
  })
})

describe('gameKindLabel', () => {
  it('humanizes the engine game kinds and passes unknowns through', () => {
    expect(gameKindLabel('base')).toBe('Base')
    expect(gameKindLabel('normal')).toBe('Base')
    expect(gameKindLabel('free-spin')).toBe('Free spin')
    expect(gameKindLabel('respin')).toBe('Respin')
    expect(gameKindLabel('jac')).toBe('JAC')
    expect(gameKindLabel('interlude')).toBe('Interlude')
    expect(gameKindLabel('deal')).toBe('Deal')
    expect(gameKindLabel('weird')).toBe('weird')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/utils/entryLabel.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// app/utils/entryLabel.ts
// Plain-English names for what the History table records as raw ids. Display
// only — the export log keeps raw ids (the machine-readable surface). Never
// throws: unknown ids and unresolvable machines fall back to the raw string,
// because old histories can hold retired machines' rows.
import type { MachineDef } from '~/engine'
import { ALL_MACHINES } from '~/machines'

export function machineName(id: string): string {
  return ALL_MACHINES.find(m => m.id === id)?.name ?? id
}

const GAME_KIND_LABELS: Record<string, string> = {
  base: 'Base',
  normal: 'Base',
  'free-spin': 'Free spin',
  respin: 'Respin',
  jac: 'JAC',
  interlude: 'Interlude',
  deal: 'Deal'
}

export function gameKindLabel(kind: string): string {
  return GAME_KIND_LABELS[kind] ?? kind
}

/** ids any family can emit */
const UNIVERSAL: Record<string, string> = {
  grand: 'Grand',
  'hold-and-spin': 'Hold & Spin',
  tumble: 'Tumble chain'
}

const PACHISLO: Record<string, string> = {
  cherry: 'Cherry',
  watermelon: 'Watermelon',
  bell: 'Bell',
  replay: 'Replay',
  reg: 'REG bonus',
  big: 'BIG bonus',
  jac: 'JAC win',
  'interlude-bell': 'Interlude bell'
}

const BLACKJACK_REEL: Record<string, string> = {
  crash: 'Flamed out',
  topped: 'Topped out (reel 5)',
  cash: 'Cashed out'
}

const LOCK_REEL: Record<string, string> = {
  collect: 'Collect',
  'base-cash': 'Base collect',
  'bonus-cash': '777 bonus cash',
  'seven-upgrade': '777 bonus 7-upgrade'
}

type AnyPayEntry
  = | { id: string, kind: 'allWild' }
    | { id: string, kind: 'allSame', symbol: string }
    | { id: string, kind: 'anyOf', symbols: string[] }
    | { id: string, kind: 'count', symbol: string, n: number }
    | { id: string, kind: 'run', symbol: string, length: number }
    | { id: string, kind: 'allOf', symbol: string }
    | { id: string, symbol: string, length: number } // video: no kind field

export function entryLabel(def: MachineDef | null, entryId: string): string {
  if (def === null) return entryId
  const hit = UNIVERSAL[entryId]
  if (hit !== undefined) return hit
  const sym = (s: string): string => def.symbols?.[s]?.label ?? s

  if (def.family === 'pachislo') return PACHISLO[entryId] ?? entryId
  if (def.family === 'blackjack-reel') return BLACKJACK_REEL[entryId] ?? entryId
  if (def.family === 'lock-reel') return LOCK_REEL[entryId] ?? entryId
  // cascade pays are keyed by the symbol itself
  if (def.family === 'cascade') {
    return def.symbols?.[entryId] !== undefined ? `${sym(entryId)} pays` : entryId
  }

  // video scatter wins: 'sc3' → "3× Gondola Scatter"
  const scMatch = /^sc(\d+)$/.exec(entryId)
  if (scMatch !== null && 'scatter' in def && def.scatter !== null) {
    return `${scMatch[1]}× ${sym(def.scatter.symbol)}`
  }

  const paytable = 'paytable' in def ? (def.paytable as unknown as AnyPayEntry[]) : []
  const entry = paytable.find(e => e.id === entryId)
  if (entry === undefined) return entryId
  if (!('kind' in entry)) return `${entry.length}× ${sym(entry.symbol)}`
  switch (entry.kind) {
    case 'allWild': return 'All wilds'
    case 'allSame': return `3× ${sym(entry.symbol)}`
    case 'anyOf': return `Any ${entry.symbols.map(sym).join(' / ')}`
    case 'count': return `${entry.n}× ${sym(entry.symbol)}`
    case 'run': return `${entry.length}× ${sym(entry.symbol)}`
    case 'allOf': return `3× ${sym(entry.symbol)}`
    default: return entryId
  }
}
```

Note for the implementer: if TypeScript complains about the `def.symbols` /
`def.scatter` / `def.paytable` accesses on the `MachineDef` union, prefer
narrowing via `in` checks (as above) over `any` casts; adjust the `AnyPayEntry`
bridge type to whatever the union actually needs, but keep the public
signatures EXACTLY as specified in Interfaces.

- [ ] **Step 4: Run test + lint**

Run: `pnpm vitest run tests/utils/entryLabel.test.ts && pnpm lint`
Expected: PASS, exit 0. If a specific expected string differs from a def's real symbol labels (e.g. Stock Rush's flag names), fix the TEST to the def's actual label — the def is the source of truth — but keep the "no raw id leaks" loop green.

- [ ] **Step 5: Commit**

```bash
git add app/utils/entryLabel.ts tests/utils/entryLabel.test.ts
git commit -m "feat(history): family-aware plain-English labels for machines, awards, and game kinds"
```

---

### Task 8: `historyTakeaway` util

**Files:**
- Create: `app/utils/historyTakeaway.ts`
- Test: `tests/utils/historyTakeaway.test.ts`

**Interfaces:**
- Consumes: `SpinRecord` (`~/stores/slots` — exported interface).
- Produces: `edgeKey(machineId, coins): string`, `takeawaySums(rows, edgeByKey): TakeawaySums` where `TakeawaySums = { wageredCents, expectedNetCents, actualNetCents, coveredRows, excludedRows }` (all `number`) — Task 9 imports these names exactly.

- [ ] **Step 1: Write the failing test**

```ts
// tests/utils/historyTakeaway.test.ts
import { describe, expect, it } from 'vitest'
import type { SpinRecord } from '../../app/stores/slots'
import { edgeKey, takeawaySums } from '../../app/utils/historyTakeaway'

const row = (over: Partial<SpinRecord>): SpinRecord => ({
  id: 1, machineId: 'sevens-ablaze', gameKind: 'base', coins: 2,
  coinsInCents: 200, payoutCents: 0, entryIds: [], t: 0, ...over
})

describe('takeawaySums', () => {
  it('accumulates wagered, expected net (at the exact edge), and actual net over covered rows', () => {
    const edges = new Map([[edgeKey('sevens-ablaze', 2), 0.055]])
    const rows = [
      row({ id: 1, payoutCents: 0 }), //   in 200, out 0
      row({ id: 2, payoutCents: 400 }), // in 200, out 400
      row({ id: 3, payoutCents: 100 }) //  in 200, out 100 (an LDW)
    ]
    const s = takeawaySums(rows, edges)
    expect(s.coveredRows).toBe(3)
    expect(s.excludedRows).toBe(0)
    expect(s.wageredCents).toBe(600)
    expect(s.expectedNetCents).toBeCloseTo(-600 * 0.055, 6)
    expect(s.actualNetCents).toBe(500 - 600)
  })

  it('excludes rows whose machine edge is unknown, counting them honestly', () => {
    const edges = new Map([[edgeKey('sevens-ablaze', 2), 0.055]])
    const rows = [row({ id: 1 }), row({ id: 2, machineId: 'retired-machine' })]
    const s = takeawaySums(rows, edges)
    expect(s.coveredRows).toBe(1)
    expect(s.excludedRows).toBe(1)
    expect(s.wageredCents).toBe(200) // covered rows only — apples to apples
  })

  it('is empty-safe', () => {
    const s = takeawaySums([], new Map())
    expect(s).toEqual({ wageredCents: 0, expectedNetCents: 0, actualNetCents: 0, coveredRows: 0, excludedRows: 0 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/utils/historyTakeaway.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement**

```ts
// app/utils/historyTakeaway.ts
// The History page's expectation-vs-variance line (guidelines §2.3): what the
// machines' exact edges predicted for the recorded coin-in vs what actually
// happened. Pure sums — the page fetches the edges (rtpClient) and formats.
import type { SpinRecord } from '~/stores/slots'

export interface TakeawaySums {
  wageredCents: number
  /** Σ −(coin-in × edge) over covered rows — negative when the house has an edge */
  expectedNetCents: number
  actualNetCents: number
  coveredRows: number
  /** rows skipped because their machine's edge is unknown (retired machines) */
  excludedRows: number
}

export function edgeKey(machineId: string, coins: number): string {
  return `${machineId}:${coins}`
}

export function takeawaySums(rows: SpinRecord[], edgeByKey: Map<string, number>): TakeawaySums {
  const s: TakeawaySums = { wageredCents: 0, expectedNetCents: 0, actualNetCents: 0, coveredRows: 0, excludedRows: 0 }
  for (const r of rows) {
    const edge = edgeByKey.get(edgeKey(r.machineId, r.coins))
    if (edge === undefined) {
      s.excludedRows++
      continue
    }
    s.coveredRows++
    s.wageredCents += r.coinsInCents
    s.expectedNetCents -= r.coinsInCents * edge
    s.actualNetCents += r.payoutCents - r.coinsInCents
  }
  return s
}
```

- [ ] **Step 4: Run test + lint**

Run: `pnpm vitest run tests/utils/historyTakeaway.test.ts && pnpm lint`
Expected: PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
git add app/utils/historyTakeaway.ts tests/utils/historyTakeaway.test.ts
git commit -m "feat(history): expected-vs-actual net sums at the machines' exact edges"
```

---

### Task 9: History page wiring — names, awards, the takeaway line

**Files:**
- Modify: `app/components/history/HistoryTable.vue`
- Modify: `app/pages/history.vue`
- Test: create `tests/components/historyTable.test.ts`

**Interfaces:**
- Consumes: `machineName`/`entryLabel`/`gameKindLabel` (Task 7), `edgeKey`/`takeawaySums` (Task 8), `edgeOpts` (Task 4), `exactRtpAsync` (`~/utils/rtpClient`), `ALL_MACHINES` (`~/machines`).
- Produces: nothing downstream.

- [ ] **Step 1: Write the failing test**

```ts
// tests/components/historyTable.test.ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HistoryTable from '../../app/components/history/HistoryTable.vue'
import HistoryPage from '../../app/pages/history.vue'
import { useSlotsStore } from '../../app/stores/slots'
import type { SpinRecord } from '../../app/stores/slots'

const stubs = {
  UIcon: true,
  UButton: { template: '<button v-bind="$attrs" @click="$emit(\'click\')"><slot /></button>' },
  NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
  HistoryTable
}

const row = (over: Partial<SpinRecord>): SpinRecord => ({
  id: 1, machineId: 'sevens-ablaze', gameKind: 'base', coins: 1,
  coinsInCents: 100, payoutCents: 0, entryIds: [], t: 0, ...over
})

function seedStore(rows: SpinRecord[]) {
  setActivePinia(createPinia())
  localStorage.clear()
  const store = useSlotsStore()
  store.history.push(...rows)
  for (const r of rows) {
    store.stats.spins++
    store.stats.totalInCents += r.coinsInCents
    store.stats.totalOutCents += r.payoutCents
  }
  return store
}

describe('HistoryTable', () => {
  beforeEach(() => localStorage.clear())

  it('shows machine names, humanized awards, and humanized game kinds — no raw ids', () => {
    seedStore([row({ id: 1, payoutCents: 100_000, entryIds: ['3f7'], gameKind: 'base' })])
    const w = mount(HistoryTable, { global: { stubs } })
    expect(w.text()).toContain('Sevens Ablaze')
    expect(w.text()).toContain('3× Flaming Seven')
    expect(w.text()).toContain('Base')
    expect(w.text()).not.toContain('sevens-ablaze')
    expect(w.text()).not.toContain('3f7')
  })

  it('keeps raw ids for machines that no longer resolve', () => {
    seedStore([row({ id: 1, machineId: 'retired-machine', entryIds: ['old-award'] })])
    const w = mount(HistoryTable, { global: { stubs } })
    expect(w.text()).toContain('retired-machine')
    expect(w.text()).toContain('old-award')
  })
})

describe('history page takeaway', () => {
  beforeEach(() => localStorage.clear())

  it('renders expected-vs-actual at the machines\' exact edges once history exists', async () => {
    seedStore([row({ id: 1 }), row({ id: 2, payoutCents: 200 })])
    const w = mount(HistoryPage, { global: { stubs } })
    await flushPromises() // edges resolve through the rtpClient sync fallback
    const t = w.text().toLowerCase()
    expect(t).toContain('expected')
    expect(t).toContain('actual')
    expect(w.text()).toMatch(/[−-]\$\d/) // a negative expected-dollars figure
  })

  it('stays silent with an empty history', () => {
    seedStore([])
    const w = mount(HistoryPage, { global: { stubs } })
    expect(w.text().toLowerCase()).not.toContain('expected result')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/historyTable.test.ts`
Expected: FAIL — raw ids still rendered; no takeaway.

- [ ] **Step 3: Update `HistoryTable.vue`**

Script gains the humanizers (and a def resolver):

```ts
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCents, formatSignedCents } from '~/utils/format'
import { entryLabel, gameKindLabel, machineName } from '~/utils/entryLabel'
import { ALL_MACHINES } from '~/machines'

const store = useSlotsStore()
const rows = computed(() => [...store.history].reverse())
const defOf = (id: string) => ALL_MACHINES.find(m => m.id === id) ?? null
const awards = (machineId: string, entryIds: string[]): string => {
  const def = defOf(machineId)
  return entryIds.map(e => entryLabel(def, e)).join(' · ')
}
```

Template cell swaps (three `<td>`s):

```vue
        <td class="px-4 py-2 text-neutral-300">
          {{ machineName(r.machineId) }}
        </td>
        <td class="px-4 py-2 text-neutral-500 text-xs">
          {{ gameKindLabel(r.gameKind) }}
        </td>
```

```vue
        <td class="px-4 py-2 text-neutral-500 text-xs">
          {{ awards(r.machineId, r.entryIds) || '—' }}
        </td>
```

(The Awards cell drops its `font-mono` class — it is prose now.)

- [ ] **Step 4: Update `app/pages/history.vue`** — add the takeaway between the stats bar and the table:

Script additions:

```ts
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCents, formatSignedCents } from '~/utils/format'
import { ALL_MACHINES } from '~/machines'
import { exactRtpAsync } from '~/utils/rtpClient'
import { edgeOpts } from '~/utils/floorIntel'
import { edgeKey, takeawaySums } from '~/utils/historyTakeaway'
```

```ts
// Expected-vs-actual at the machines' exact edges (guidelines §2.3). Edges are
// fetched per distinct (machine, coins) through the rtpClient cache — worker in
// real browsers, sync fallback in SSG/tests.
const edges = ref<Map<string, number>>(new Map())
const wantedKeys = computed(() => {
  const keys = new Map<string, { def: (typeof ALL_MACHINES)[number], coins: number }>()
  for (const r of store.history) {
    const def = ALL_MACHINES.find(m => m.id === r.machineId)
    if (def === undefined) continue
    const k = edgeKey(r.machineId, r.coins)
    if (!keys.has(k)) keys.set(k, { def, coins: r.coins })
  }
  return keys
})
watchEffect(() => {
  for (const [k, { def, coins }] of wantedKeys.value) {
    if (edges.value.has(k)) continue
    void exactRtpAsync(def, edgeOpts(def, coins)).then((report) => {
      const next = new Map(edges.value)
      next.set(k, 1 - report.rtpPerCoin)
      edges.value = next
    })
  }
})
const takeaway = computed(() => {
  if (store.history.length === 0) return null
  for (const k of wantedKeys.value.keys()) {
    if (!edges.value.has(k)) return null // still computing
  }
  return takeawaySums(store.history, edges.value)
})
const luckCents = computed(() => takeaway.value === null ? 0 : takeaway.value.actualNetCents - Math.round(takeaway.value.expectedNetCents))
```

Template — insert directly after the stats-bar `<div>`:

```vue
    <div
      v-if="takeaway && takeaway.coveredRows > 0"
      data-test="takeaway"
      class="rounded-xl bg-neutral-900/70 border border-neutral-800 px-4 py-2.5 text-sm text-neutral-300 space-y-1"
    >
      <p>
        At these machines' exact edges, expected result on your
        <span class="font-mono text-neutral-200">{{ formatCents(takeaway.wageredCents) }}</span> wagered:
        <span class="font-mono text-amber-300">{{ formatSignedCents(Math.round(takeaway.expectedNetCents)) }}</span>.
        Your actual:
        <span
          class="font-mono"
          :class="takeaway.actualNetCents >= 0 ? 'text-emerald-400' : 'text-red-400'"
        >{{ formatSignedCents(takeaway.actualNetCents) }}</span>
        — luck has been
        <span class="font-mono text-neutral-200">{{ formatCents(Math.abs(luckCents)) }}</span>
        {{ luckCents >= 0 ? 'kind' : 'unkind' }}.
        Play on and the gap per dollar shrinks toward zero.
        <span
          v-if="takeaway.excludedRows > 0"
          class="text-neutral-500"
        >(Excludes {{ takeaway.excludedRows }} games on retired machines.)</span>
      </p>
      <p class="text-[10px] text-neutral-500">
        Expected figures use each machine's exact math at your recorded bet — Stock Rush at its
        default operator setting, strategy machines at optimal play.
      </p>
    </div>
```

- [ ] **Step 5: Run tests + lint**

Run: `pnpm vitest run tests/components/historyTable.test.ts tests/utils/entryLabel.test.ts && pnpm lint`
Expected: PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
git add app/components/history/HistoryTable.vue app/pages/history.vue tests/components/historyTable.test.ts
git commit -m "feat(history): machine names, plain-English awards, expected-vs-actual takeaway at exact edges"
```

---

### Task 10: CHANGELOG, full gate, live browser smoke

**Files:**
- Modify: `CHANGELOG.md` (under `## [Unreleased]`, `### Added`)

- [ ] **Step 1: CHANGELOG** — add under `## [Unreleased]` (create an `### Added` heading there if the section only has `### Fixed`):

```markdown
### Added
- **`/learn/myths` — due, hot & cold, refuted live.** Gambler's fallacy, "due"
  jackpots, and hot/cold machines, each stated in its own voice and answered by
  a seeded 250,000-spin experiment through the real Sevens Ablaze engine (in the
  rtp.worker): hit rates conditioned on the preceding streak are identical, and
  the 1-in-13,824 jackpot's gaps show no schedule. Ninth learn card; glossary
  gains gambler's-fallacy and independence entries.
- **Sim Lab shows the math before you spin.** A live model panel (per-spin EV,
  no-bust expected end, ±1σ of luck, spins-for-the-edge-to-outgrow-luck) updates
  as the form moves, every figure labeled model vs measured — and after a run the
  ending-bankroll histogram overlays the model expected end against the measured
  mean (guidelines §2.5).
- **History speaks English and draws the lesson.** Machine names instead of ids,
  awards as "5× Winged Lion" instead of `li5`, game kinds humanized — and a
  takeaway line comparing the expected net at the machines' exact edges against
  the actual net, with luck quantified (guidelines §2.3).
```

- [ ] **Step 2: Full gate**

Run: `pnpm check`
Expected: lint + typecheck + all tests + floor verify PASS (exit 0). Fix anything it surfaces before proceeding.

- [ ] **Step 3: Commit**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG — the content trio (myths lab, Sim Lab live math, History takeaway)"
```

- [ ] **Step 4: Live browser smoke** (session driver, not a subagent): `pnpm generate`, serve `dist/` with the CSP-applying static server (the house smoke pattern — check served CSP hashes match on-disk `_headers` first), then verify in Chrome: `/learn/myths` fills its numbers via the worker (no long tasks, no console errors under the production CSP), Sim Lab's model panel updates while dragging inputs and the histogram shows both markers after a run, History shows names/awards/takeaway after a few real spins on the game page. viewcap screenshots for the record.

---

## Self-review notes

- Spec §1 (myths page) → Tasks 1–3; §2 (Sim Lab) → Tasks 4–6; §3 (History) → Tasks 7–9; gates → global constraints + Task 10. README pass intentionally deferred (handoff: separate pre-push item).
- Type/name consistency verified: `MYTHS_SPINS`/`runMythsExperiment`/`MythsExperimentResult` (T1→T2→T3), `mythsExperimentAsync` (T2→T3), `labExpectedMath`/`LabExpectedMathModel`/`edgeOpts` (T4→T5, T4→T9), `expectedEndCredits` prop (T5→T6), `machineName`/`entryLabel`/`gameKindLabel` (T7→T9), `edgeKey`/`takeawaySums` (T8→T9).
- Known judgment calls: myths seed may need a ±1 bump if a bucket misses tolerance (T1 Step 4 says how); entryLabel test strings defer to def labels when they disagree (T7 Step 4 says how); Vue passthrough makes T5's early `expected-end-credits` binding safe before T6 lands.
