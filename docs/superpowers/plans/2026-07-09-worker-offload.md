# Worker Offload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the three main-thread stalls (floor X-ray ≈4s, LDW-lab 40k spins, PAR-sheet Math tab ≈1s) onto a long-lived module worker per `docs/superpowers/specs/2026-07-09-worker-offload-design.md` — identical numbers, async loading states, zero existing-test churn via a sync no-Worker fallback.

**Architecture:** New `rtp.worker` (long-lived RPC: exactRtp + LDW experiment) behind `utils/rtpClient.ts` (keyed cache + pending dedupe + sync fallback when `Worker` is absent) and `composables/useExactRtp.ts` (reactive ref that fills synchronously on cache hit or fallback). Consumers (`MachineCard`, `SessionSidebar`, `XrayPanel`, `ParSheetModal`, `ldw-near-miss`) switch from sync `floorIntel`/`exactRtp` calls to the async layer; `floorIntel` keeps its sync API for tests/SSG.

**Tech Stack:** Nuxt 4, Vite module workers (`new Worker(new URL(...), { type: 'module' })` — the CSP-proven `sim.worker` pattern), Vitest 4.

## Global Constraints

- **No AI trailer in commits.**
- **No number changes**: every displayed RTP/HF/volatility and the LDW experiment's seeded results must be bit-identical (`mulberry32(20260703)` stays).
- **Existing tests pass unchanged** via the fallback (single tolerated exception: `learnPages.test.ts` may gain ONE extra `nextTick` if the async LDW conversion needs it).
- In no-`Worker` environments the fallback computes synchronously and caches BEFORE the promise resolves, so `useExactRtp` can fill synchronously (test transparency).
- SSG/sync users stay untouched: `house-edge.vue`, `pachislo.vue`, `PachisloControls`, XrayPanel's direct `lockReelExactRtp`/`blackjackReelExactRtp` calls, `sim.worker`.
- Per-task gate: `pnpm lint` + the task's vitest files; full `pnpm check` + live long-task probe in the final task.
- Branch: `worker-offload`. Repo root: `/Volumes/satechi/webdev/metaincognita-slots`.

---

### Task W1: Extract the LDW experiment (pure, seeded, frozen)

**Files:**
- Create: `app/utils/ldwExperiment.ts`
- Create: `tests/utils/ldwExperiment.test.ts`
- Modify: `app/pages/learn/ldw-near-miss.vue` (script block :1-76 — drop the inline fn, import the util, still SYNC this task)

**Interfaces:**
- Produces: `export interface LdwExperimentResult { wins: number, trueWins: number, ldw: number, nearMissLosses: number, hitPct: number, trueWinPct: number, ldwPct: number, ldwShareOfWins: number }`, `export const LDW_PAID_SPINS = 10_000`, `export function runLdwExperiment(): LdwExperimentResult` from `~/utils/ldwExperiment`. Tasks W2/W5 consume all three.

- [ ] **Step 1: Write the failing test** — create `tests/utils/ldwExperiment.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LDW_PAID_SPINS, runLdwExperiment } from '../../app/utils/ldwExperiment'

describe('runLdwExperiment', () => {
  it('is seeded and frozen — the published 63.34% LDW share must not drift', () => {
    const r = runLdwExperiment()
    // Deterministic (mulberry32(20260703)): same numbers every run, every visit.
    expect(r.ldwShareOfWins).toBeCloseTo(0.6334, 3)
    expect(r.wins).toBe(r.trueWins + r.ldw)
    expect(r.hitPct).toBeCloseTo(r.wins / LDW_PAID_SPINS, 10)
    expect(r.nearMissLosses).toBeGreaterThan(0)
    const again = runLdwExperiment()
    expect(again).toEqual(r) // pure function of the fixed seed
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/utils/ldwExperiment.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/utils/ldwExperiment.ts`** (the page's function, verbatim logic):

```ts
// app/utils/ldwExperiment.ts
// The /learn/ldw-near-miss live experiment, extracted so the rtp.worker, the
// no-Worker sync fallback, and the page all run the SAME code. Seeded
// (mulberry32(20260703)) — the page promises "reload and the numbers repeat
// exactly", and tests freeze the published 63.34% LDW share.
// Leaf-module imports on purpose: the worker bundle only needs the video
// evaluator, the RNG, and the near-miss detector — not the whole engine barrel.
import { CANAL_ROYALE } from '~/machines/canal-royale'
import { spinVideo } from '~/engine/video'
import { mulberry32 } from '~/engine/rng'
import { nearMisses } from '~/engine/nearMiss'
import type { MachineSessionState } from '~/engine/types'

export const LDW_PAID_SPINS = 10_000

export interface LdwExperimentResult {
  wins: number
  trueWins: number
  ldw: number
  nearMissLosses: number
  hitPct: number
  trueWinPct: number
  ldwPct: number
  ldwShareOfWins: number
}

export function runLdwExperiment(): LdwExperimentResult {
  const def = CANAL_ROYALE
  // canal-royale has no progressive and no interactive state — a fresh video
  // session is all-null (what initMachineState(def) would build).
  const state: MachineSessionState = {
    progressive: null, videoFeature: null, pachislo: null, blackjackReel: null, lockReel: null
  }
  const rand = mulberry32(20260703)
  const bet = def.maxCoins
  let paid = 0
  let wins = 0
  let trueWins = 0
  let ldw = 0
  let nearMissLosses = 0
  let guard = 0
  while (paid < LDW_PAID_SPINS && guard < LDW_PAID_SPINS * 4) {
    guard++
    const out = spinVideo(def, state, bet, rand)
    if (out.coinsIn === 0) continue // free-feature games: no stake at risk
    paid++
    if (out.totalPayout === 0) {
      if (nearMisses(def, out).length > 0) nearMissLosses++
    } else {
      wins++
      if (out.totalPayout >= out.coinsIn) trueWins++
      else ldw++
    }
  }
  return {
    wins,
    trueWins,
    ldw,
    nearMissLosses,
    hitPct: wins / LDW_PAID_SPINS,
    trueWinPct: trueWins / LDW_PAID_SPINS,
    ldwPct: ldw / LDW_PAID_SPINS,
    ldwShareOfWins: wins > 0 ? ldw / wins : 0
  }
}
```

- [ ] **Step 4: Point the page at the util (still sync — behavior unchanged this task)**

In `app/pages/learn/ldw-near-miss.vue`, replace the script's experiment plumbing: delete `const N = 10_000`, the `interface ExperimentResult`, and the whole inline `runExperiment()` (with its now-unneeded `CANAL_ROYALE`/`spinVideo`/`mulberry32`/`nearMisses`/`MachineSessionState` imports), and use:

```ts
import { onMounted, ref } from 'vue'
import { LDW_PAID_SPINS as N, runLdwExperiment, type LdwExperimentResult } from '~/utils/ldwExperiment'
import { formatPercent } from '~/utils/format'
import LearnSection from '~/components/learn/LearnSection.vue'
import LearnDisclosure from '~/components/learn/LearnDisclosure.vue'

const exp = ref<LdwExperimentResult | null>(null)
onMounted(() => {
  exp.value = runLdwExperiment()
})
```

(The template uses `N` and `exp` exactly as before — no template edits.)

- [ ] **Step 5: Run to verify pass**

Run: `pnpm vitest run tests/utils/ldwExperiment.test.ts tests/components/learnPages.test.ts`
Expected: PASS — the freeze matches the published number and the page suite is untouched.

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint
git add app/utils/ldwExperiment.ts app/pages/learn/ldw-near-miss.vue tests/utils/ldwExperiment.test.ts
git commit -m "refactor(learn): extract the seeded LDW experiment into a pure util (frozen at 63.34%)"
```

---

### Task W2: The rtp worker + async client with sync fallback

**Files:**
- Create: `app/workers/rtp-worker-protocol.ts`
- Create: `app/workers/rtp.worker.ts`
- Create: `app/utils/rtpClient.ts`
- Create: `tests/utils/rtpClient.test.ts`

**Interfaces:**
- Consumes: `runLdwExperiment`, `LdwExperimentResult` (W1); `exactRtp`, `ExactRtpOptions`, `ExactRtpReport` from `~/engine`; `ALL_MACHINES`.
- Produces: `peekExactRtp(def: MachineDef, opts?: FloorIntelOptions): ExactRtpReport | null`, `exactRtpAsync(def: MachineDef, opts?: FloorIntelOptions): Promise<ExactRtpReport>`, `ldwExperimentAsync(): Promise<LdwExperimentResult>` from `~/utils/rtpClient` (opts shape = floorIntel's `{ oddsLevel?, coins? }`). Tasks W3–W5 consume these.

- [ ] **Step 1: Write the failing tests** — create `tests/utils/rtpClient.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { exactRtp } from '../../app/engine'
import { DIAMOND_DOUBLER } from '../../app/machines/diamond-doubler'
import { STOCK_RUSH } from '../../app/machines/stock-rush'
import { exactRtpAsync, ldwExperimentAsync, peekExactRtp } from '../../app/utils/rtpClient'
import { runLdwExperiment } from '../../app/utils/ldwExperiment'

// node env has no Worker global → these tests exercise the sync fallback,
// which is exactly the path SSG and every component test relies on.
describe('rtpClient (no-Worker fallback)', () => {
  it('resolves the same report the sync engine produces, and caches it', async () => {
    expect(peekExactRtp(DIAMOND_DOUBLER)).toBeNull()
    const viaClient = await exactRtpAsync(DIAMOND_DOUBLER)
    expect(viaClient).toEqual(exactRtp(DIAMOND_DOUBLER))
    expect(peekExactRtp(DIAMOND_DOUBLER)).toBe(viaClient) // cached object identity
    expect(await exactRtpAsync(DIAMOND_DOUBLER)).toBe(viaClient)
  })

  it('fallback populates the cache synchronously (before awaiting)', () => {
    void exactRtpAsync(DIAMOND_DOUBLER, { coins: 2 })
    expect(peekExactRtp(DIAMOND_DOUBLER, { coins: 2 })).not.toBeNull()
  })

  it('keys the cache by machine and opts', async () => {
    const l4 = await exactRtpAsync(STOCK_RUSH, { oddsLevel: 4 })
    const l6 = await exactRtpAsync(STOCK_RUSH, { oddsLevel: 6 })
    expect(l4.rtpPerCoin).not.toBe(l6.rtpPerCoin)
    expect(peekExactRtp(STOCK_RUSH, { oddsLevel: 4 })).toBe(l4)
    expect(peekExactRtp(STOCK_RUSH, { oddsLevel: 6 })).toBe(l6)
  })

  it('runs the LDW experiment through the same fallback', async () => {
    expect(await ldwExperimentAsync()).toEqual(runLdwExperiment())
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/utils/rtpClient.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `app/workers/rtp-worker-protocol.ts`**

```ts
// app/workers/rtp-worker-protocol.ts
import type { ExactRtpOptions, ExactRtpReport } from '~/engine'
import type { LdwExperimentResult } from '~/utils/ldwExperiment'

export type RtpWorkerIncoming
  = | { type: 'exactRtp', reqId: number, machineId: string, opts: ExactRtpOptions }
    | { type: 'ldw', reqId: number }

export type RtpWorkerOutgoing
  = | { type: 'result', reqId: number, report: ExactRtpReport }
    | { type: 'ldwResult', reqId: number, result: LdwExperimentResult }
    | { type: 'error', reqId: number, message: string }
```

- [ ] **Step 4: Create `app/workers/rtp.worker.ts`** (thin shell, `sim.worker` precedent):

```ts
// app/workers/rtp.worker.ts
/// <reference lib="webworker" />
// Long-lived RPC worker for the exact-math hot paths (floor X-ray, PAR sheet)
// and the LDW lab — unlike sim.worker it is NOT terminated per request; the
// rtpClient keeps one instance for the whole session and dispatches by reqId.
import { ALL_MACHINES } from '~/machines'
import { exactRtp } from '~/engine'
import { runLdwExperiment } from '~/utils/ldwExperiment'
import type { RtpWorkerIncoming, RtpWorkerOutgoing } from './rtp-worker-protocol'

declare const self: DedicatedWorkerGlobalScope

self.onmessage = (e: MessageEvent<RtpWorkerIncoming>): void => {
  const msg = e.data
  try {
    if (msg.type === 'ldw') {
      const out: RtpWorkerOutgoing = { type: 'ldwResult', reqId: msg.reqId, result: runLdwExperiment() }
      self.postMessage(out)
      return
    }
    if (msg.type !== 'exactRtp') return
    const def = ALL_MACHINES.find(m => m.id === msg.machineId)
    if (!def) throw new Error(`unknown machine ${msg.machineId}`)
    const out: RtpWorkerOutgoing = { type: 'result', reqId: msg.reqId, report: exactRtp(def, msg.opts) }
    self.postMessage(out)
  } catch (err) {
    const out: RtpWorkerOutgoing = { type: 'error', reqId: msg.reqId, message: err instanceof Error ? err.message : String(err) }
    self.postMessage(out)
  }
}
```

- [ ] **Step 5: Create `app/utils/rtpClient.ts`**

```ts
// app/utils/rtpClient.ts
// The ONLY doorway to rtp.worker: a keyed report cache with pending-promise
// dedupe. Where `Worker` doesn't exist (SSR/SSG, vitest, ancient browsers) —
// or if the worker errors — it computes synchronously via the same exactRtp,
// so results are identical everywhere and existing tests need no changes.
// In fallback mode the cache is populated BEFORE the promise resolves, so
// useExactRtp can fill synchronously (test transparency).
import { exactRtp } from '~/engine'
import type { ExactRtpOptions, ExactRtpReport, MachineDef } from '~/engine'
import { runLdwExperiment } from '~/utils/ldwExperiment'
import type { LdwExperimentResult } from '~/utils/ldwExperiment'
import type { FloorIntelOptions } from '~/utils/floorIntel'
import type { RtpWorkerIncoming, RtpWorkerOutgoing } from '~/workers/rtp-worker-protocol'

const reports = new Map<string, ExactRtpReport>()
const pending = new Map<string, Promise<ExactRtpReport>>()

function keyOf(defId: string, opts: FloorIntelOptions): string {
  return `${defId}:${opts.oddsLevel ?? ''}:${opts.coins ?? ''}`
}

function toEngineOpts(opts: FloorIntelOptions): ExactRtpOptions {
  return {
    ...(opts.oddsLevel === undefined ? {} : { oddsLevel: opts.oddsLevel }),
    ...(opts.coins === undefined ? {} : { coins: opts.coins })
  }
}

function workerSupported(): boolean {
  return typeof Worker !== 'undefined' && typeof window !== 'undefined'
}

// ── the long-lived worker + reqId dispatch ─────────────────────────────────

interface Waiter {
  resolveReport?: (r: ExactRtpReport) => void
  resolveLdw?: (r: LdwExperimentResult) => void
  reject: (e: Error) => void
}

let worker: Worker | null = null
let nextReqId = 1
const waiters = new Map<number, Waiter>()

function getWorker(): Worker | null {
  if (!workerSupported()) return null
  if (worker !== null) return worker
  try {
    worker = new Worker(new URL('../workers/rtp.worker.ts', import.meta.url), { type: 'module' })
  } catch {
    return null // constructor blocked (CSP/odd env) → callers fall back to sync
  }
  worker.onmessage = (e: MessageEvent<RtpWorkerOutgoing>) => {
    const msg = e.data
    const w = waiters.get(msg.reqId)
    if (w === undefined) return
    waiters.delete(msg.reqId)
    if (msg.type === 'result') w.resolveReport?.(msg.report)
    else if (msg.type === 'ldwResult') w.resolveLdw?.(msg.result)
    else w.reject(new Error(msg.message))
  }
  worker.onerror = () => {
    // Kill the broken instance and fail every waiter — their catch blocks
    // fall back to the sync path, so the numbers still arrive.
    const failed = [...waiters.values()]
    waiters.clear()
    worker?.terminate()
    worker = null
    for (const w of failed) w.reject(new Error('rtp.worker crashed'))
  }
  return worker
}

// ── public API ──────────────────────────────────────────────────────────────

/** Sync cache read — null until someone computed this def+opts. */
export function peekExactRtp(def: MachineDef, opts: FloorIntelOptions = {}): ExactRtpReport | null {
  return reports.get(keyOf(def.id, opts)) ?? null
}

export function exactRtpAsync(def: MachineDef, opts: FloorIntelOptions = {}): Promise<ExactRtpReport> {
  const key = keyOf(def.id, opts)
  const hit = reports.get(key)
  if (hit !== undefined) return Promise.resolve(hit)
  const inFlight = pending.get(key)
  if (inFlight !== undefined) return inFlight

  const w = getWorker()
  if (w === null) {
    // Sync fallback: compute now, cache BEFORE resolving.
    const report = exactRtp(def, toEngineOpts(opts))
    reports.set(key, report)
    return Promise.resolve(report)
  }

  const reqId = nextReqId++
  const p = new Promise<ExactRtpReport>((resolve, reject) => {
    waiters.set(reqId, { resolveReport: resolve, reject })
    const msg: RtpWorkerIncoming = { type: 'exactRtp', reqId, machineId: def.id, opts: toEngineOpts(opts) }
    w.postMessage(msg)
  })
    .catch(() => exactRtp(def, toEngineOpts(opts))) // degraded to jank, never to missing numbers
    .then((report) => {
      reports.set(key, report)
      pending.delete(key)
      return report
    })
  pending.set(key, p)
  return p
}

let ldwCache: LdwExperimentResult | null = null
let ldwPending: Promise<LdwExperimentResult> | null = null

export function ldwExperimentAsync(): Promise<LdwExperimentResult> {
  if (ldwCache !== null) return Promise.resolve(ldwCache)
  if (ldwPending !== null) return ldwPending

  const w = getWorker()
  if (w === null) {
    ldwCache = runLdwExperiment()
    return Promise.resolve(ldwCache)
  }

  const reqId = nextReqId++
  ldwPending = new Promise<LdwExperimentResult>((resolve, reject) => {
    waiters.set(reqId, { resolveLdw: resolve, reject })
    const msg: RtpWorkerIncoming = { type: 'ldw', reqId }
    w.postMessage(msg)
  })
    .catch(() => runLdwExperiment())
    .then((result) => {
      ldwCache = result
      ldwPending = null
      return result
    })
  return ldwPending
}
```

- [ ] **Step 6: Run to verify pass**

Run: `pnpm vitest run tests/utils/rtpClient.test.ts`
Expected: PASS (4 tests, fallback paths).

- [ ] **Step 7: Lint and commit**

```bash
pnpm lint
git add app/workers/rtp-worker-protocol.ts app/workers/rtp.worker.ts app/utils/rtpClient.ts tests/utils/rtpClient.test.ts
git commit -m "feat(perf): long-lived rtp.worker + cached async client with sync fallback"
```

---

### Task W3: `useExactRtp` composable + `intelFromReport`

**Files:**
- Modify: `app/utils/floorIntel.ts`
- Create: `app/composables/useExactRtp.ts`
- Create: `tests/useExactRtp.test.ts`

**Interfaces:**
- Consumes: `peekExactRtp`, `exactRtpAsync` (W2).
- Produces: `useExactRtp(def: () => MachineDef | null, opts?: () => FloorIntelOptions): Ref<ExactRtpReport | null>` from `~/composables/useExactRtp`; `intelFromReport(def: MachineDef, report: ExactRtpReport): FloorIntel` from `~/utils/floorIntel`. Task W4 consumes both.

- [ ] **Step 1: Write the failing test** — create `tests/useExactRtp.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { exactRtp } from '../app/engine'
import { DIAMOND_DOUBLER } from '../app/machines/diamond-doubler'
import { SEVENS_ABLAZE } from '../app/machines/sevens-ablaze'
import type { MachineDef } from '../app/engine'
import { useExactRtp } from '../app/composables/useExactRtp'
import { floorIntel, intelFromReport } from '../app/utils/floorIntel'

describe('useExactRtp (no-Worker env → sync fill)', () => {
  it('fills synchronously in fallback mode, nulls on a null def, tracks def changes', async () => {
    const def = ref<MachineDef | null>(null)
    let report!: ReturnType<typeof useExactRtp>
    const w = mount(defineComponent({
      setup() {
        report = useExactRtp(() => def.value)
        return () => h('div')
      }
    }))
    expect(report.value).toBeNull()

    def.value = DIAMOND_DOUBLER
    await nextTick()
    expect(report.value).toEqual(exactRtp(DIAMOND_DOUBLER))

    def.value = SEVENS_ABLAZE
    await nextTick()
    expect(report.value).toEqual(exactRtp(SEVENS_ABLAZE))

    def.value = null
    await nextTick()
    expect(report.value).toBeNull()
    w.unmount()
  })
})

describe('intelFromReport', () => {
  it('derives exactly what the sync floorIntel derives', () => {
    const viaSync = floorIntel(DIAMOND_DOUBLER, { coins: 2 })
    const viaReport = intelFromReport(DIAMOND_DOUBLER, exactRtp(DIAMOND_DOUBLER, { coins: 2 }))
    expect(viaReport).toEqual(viaSync)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/useExactRtp.test.ts`
Expected: FAIL — `intelFromReport`/`useExactRtp` missing.

- [ ] **Step 3: Refactor `app/utils/floorIntel.ts`** — extract the derivation; `floorIntel` keeps its exact behavior (sync, cached):

```ts
import { exactRtp } from '~/engine'
import type { ExactRtpReport, MachineDef } from '~/engine'

export interface FloorIntel {
  rtp: number
  hitFrequency: number
  /** standard deviation of per-coin pay — the computed volatility figure */
  sdPerCoin: number
  topAwardId: string | null
  topAwardProbability: number | null
}

export interface FloorIntelOptions {
  /** pachislo operator level 1..6 */
  oddsLevel?: number
  /**
   * Active line/coin count. For 'lines' machines (Bally lines, selectable-line
   * video) the per-spin hit frequency and volatility depend on this; RTP/coin
   * does not. Omit to use the machine's maxCoins (the headline figure).
   */
  coins?: number
}

/** Derive the floor-card figures from an already-computed report. */
export function intelFromReport(def: MachineDef, report: ExactRtpReport): FloorIntel {
  const topId = def.topAwardEntryId ?? null
  const top = topId === null ? undefined : report.breakdown.find(b => b.entryId === topId)
  return {
    rtp: report.rtpPerCoin,
    hitFrequency: report.hitFrequency,
    sdPerCoin: Math.sqrt(report.variancePerCoin),
    topAwardId: topId,
    topAwardProbability: top?.probability ?? null
  }
}

const cache = new Map<string, FloorIntel>()

/**
 * Sync intel (tests, SSG, cheap one-offs). The interactive hot paths use
 * useExactRtp + intelFromReport instead so video-family enumeration runs in
 * the rtp.worker, off the main thread.
 */
export function floorIntel(def: MachineDef, opts: FloorIntelOptions = {}): FloorIntel {
  const key = `${def.id}:${opts.oddsLevel ?? ''}:${opts.coins ?? ''}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const report: ExactRtpReport = exactRtp(def, {
    ...(opts.oddsLevel === undefined ? {} : { oddsLevel: opts.oddsLevel }),
    ...(opts.coins === undefined ? {} : { coins: opts.coins })
  })
  const intel = intelFromReport(def, report)
  cache.set(key, intel)
  return intel
}
```

- [ ] **Step 4: Create `app/composables/useExactRtp.ts`**

```ts
// app/composables/useExactRtp.ts
// Reactive exact-math report for a (possibly changing) machine. Cache hits —
// and the no-Worker sync fallback — fill synchronously (no flash); cold video
// machines fill when the rtp.worker answers. Pass a null def to gate off the
// computation entirely (e.g. floor cards while X-ray is off).
import { ref, watchEffect } from 'vue'
import type { Ref } from 'vue'
import type { ExactRtpReport, MachineDef } from '~/engine'
import type { FloorIntelOptions } from '~/utils/floorIntel'
import { exactRtpAsync, peekExactRtp } from '~/utils/rtpClient'

export function useExactRtp(
  def: () => MachineDef | null,
  opts: () => FloorIntelOptions = () => ({})
): Ref<ExactRtpReport | null> {
  const report = ref<ExactRtpReport | null>(null)
  let token = 0
  watchEffect(() => {
    const d = def()
    const o = opts()
    const t = ++token
    if (d === null) {
      report.value = null
      return
    }
    const promise = exactRtpAsync(d, o)
    // Fallback mode (and warm cache) populate synchronously — re-peek so the
    // first paint already has the number.
    const hit = peekExactRtp(d, o)
    if (hit !== null) {
      report.value = hit
      return
    }
    report.value = null
    void promise.then((r) => {
      if (t === token) report.value = r // stale-token guard on machine switches
    })
  })
  return report
}
```

- [ ] **Step 5: Run to verify pass**

Run: `pnpm vitest run tests/useExactRtp.test.ts tests/utils/floorIntel.test.ts`
Expected: PASS (new + the untouched floorIntel suite).

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint
git add app/utils/floorIntel.ts app/composables/useExactRtp.ts tests/useExactRtp.test.ts
git commit -m "feat(perf): useExactRtp composable + intelFromReport (floorIntel stays sync for tests/SSG)"
```

---

### Task W4: Convert the three intel consumers

**Files:**
- Modify: `app/components/floor/MachineCard.vue` (script :57-60, template stats block)
- Modify: `app/components/game/SessionSidebar.vue` (script :17-18)
- Modify: `app/components/game/XrayPanel.vue` (script :26-27)

**Interfaces:**
- Consumes: `useExactRtp`, `intelFromReport` (W3).

- [ ] **Step 1: MachineCard** — replace the `intel` computed:

```ts
import { useExactRtp } from '~/composables/useExactRtp'
import { intelFromReport } from '~/utils/floorIntel'
```

(drop the `floorIntel` import) and

```ts
// Floor xray headline: report at the bet dialed in for this machine (defaults
// to maxCoins) so the per-spin hit frequency/volatility match the in-game
// sidebar for 'lines' machines. Computed OFF-thread: a null def while X-ray
// is off gates the work entirely; a video machine fills in when the worker
// answers instead of freezing the floor for ~1s apiece.
const rtpReport = useExactRtp(
  () => store.settings.xray ? props.def : null,
  () => ({ coins: store.settings.betsByMachine[props.def.id] ?? props.def.maxCoins })
)
const intel = computed(() =>
  rtpReport.value === null ? null : intelFromReport(props.def, rtpReport.value))
```

Template — after the `v-if="intel"` stats grid, add the pending state:

```html
    <div
      v-else-if="store.settings.xray"
      class="pt-2 border-t border-neutral-800/70 text-[11px] font-mono text-neutral-500"
    >
      computing exact odds…
    </div>
```

- [ ] **Step 2: SessionSidebar** — replace the `intel` computed (keep the comment):

```ts
import { useExactRtp } from '~/composables/useExactRtp'
import { intelFromReport } from '~/utils/floorIntel'
```

(drop the `floorIntel` import) and

```ts
// Hit frequency and volatility are per-spin figures that depend on the active
// line count for 'lines' machines, so report them at the player's current bet.
const rtpReport = useExactRtp(
  () => def.value,
  () => ({ oddsLevel: oddsLevel.value, coins: store.currentBet })
)
const intel = computed(() =>
  def.value === null || rtpReport.value === null ? null : intelFromReport(def.value, rtpReport.value))
```

- [ ] **Step 3: XrayPanel** — replace `exactRtpValue`:

```ts
import { useExactRtp } from '~/composables/useExactRtp'
```

(drop the `floorIntel` import) and

```ts
const rtpReport = useExactRtp(() => def.value, () => ({ oddsLevel: oddsLevel.value }))
const exactRtpValue = computed(() => rtpReport.value === null ? null : rtpReport.value.rtpPerCoin)
```

- [ ] **Step 4: Run the touched suites**

Run: `pnpm vitest run tests/components/sessionSidebar.test.ts tests/components/floorFirstRun.test.ts tests/components/storageNotice.test.ts tests/components/xrayLockReel.test.ts tests/components/learnPages.test.ts`
Expected: PASS unchanged (sync fill in happy-dom).

- [ ] **Step 5: Lint and commit**

```bash
pnpm lint
git add app/components/floor/MachineCard.vue app/components/game/SessionSidebar.vue app/components/game/XrayPanel.vue
git commit -m "perf(intel): floor cards, sidebar and X-ray read exact math via the worker"
```

---

### Task W5: ParSheet Math tab + LDW page go async

**Files:**
- Modify: `app/components/game/ParSheetModal.vue` (the math watcher, :26-40)
- Modify: `app/pages/learn/ldw-near-miss.vue` (onMounted)

**Interfaces:**
- Consumes: `exactRtpAsync`, `ldwExperimentAsync` (W2).

- [ ] **Step 1: ParSheetModal** — replace the lazy-compute watcher block:

```ts
/** the joint pass for video machines costs ~1s — computed in the rtp.worker */
const report = ref<ExactRtpReport | null>(null)
const computing = ref(false)
let reportToken = 0
watch([() => props.open, def, tab], async ([open, d, t]) => {
  const token = ++reportToken
  if (!open || d === null || t !== 'math') return
  report.value = null
  computing.value = true
  // Report hit frequency/volatility at the active line count for 'lines'
  // machines (currentBet); RTP/coin is unaffected. Pachislo is keyed by level.
  const opts = d.family === 'pachislo'
    ? { oddsLevel: store.currentState?.pachislo?.oddsLevel ?? undefined }
    : { coins: store.currentBet }
  const result = await exactRtpAsync(d, opts)
  if (token !== reportToken) return // tab/machine changed mid-compute
  report.value = result
  computing.value = false
}, { immediate: true })
```

with the import swapped (`exactRtp` from `~/engine` → keep other engine imports; add `import { exactRtpAsync } from '~/utils/rtpClient'`; remove `exactRtp` from the `~/engine` import if now unused).

- [ ] **Step 2: LDW page** — make the mount async:

```ts
import { ldwExperimentAsync } from '~/utils/rtpClient'
import { LDW_PAID_SPINS as N, type LdwExperimentResult } from '~/utils/ldwExperiment'

const exp = ref<LdwExperimentResult | null>(null)
onMounted(async () => {
  // Runs in the rtp.worker in real browsers — first paint and first tap never
  // wait on 10,000 spins. Same seed, same numbers, exactly as before.
  exp.value = await ldwExperimentAsync()
})
```

(`runLdwExperiment` import from W1 is no longer needed in the page.)

- [ ] **Step 3: Run the touched suites (watch for the tolerated learnPages exception)**

Run: `pnpm vitest run tests/components/parSheet.test.ts tests/components/learnPages.test.ts tests/components/xrayLockReel.test.ts`
Expected: PASS. If (and only if) the ldw-near-miss test fails on timing, add ONE extra `await nextTick()` after the existing one in `tests/components/learnPages.test.ts`'s ldw-near-miss test — the fallback resolves in a microtask; nothing else may change.

- [ ] **Step 4: Lint and commit**

```bash
pnpm lint
git add app/components/game/ParSheetModal.vue app/pages/learn/ldw-near-miss.vue
git commit -m "perf(learn+par): PAR math tab and the 10k-spin LDW lab run in the rtp.worker"
```

---

### Task W6: Gates, live long-task probe, CHANGELOG, merge

**Files:**
- Modify: `CHANGELOG.md` (Unreleased → Changed, first bullet)

- [ ] **Step 1: CHANGELOG** — insert as the FIRST bullet under `### Changed`:

```markdown
- **The heavy exact math moved off the main thread.** A long-lived `rtp.worker`
  now computes `exactRtp` for the floor's X-ray cards, the sidebar/X-ray intel,
  and the PAR sheet's Math tab (each video machine is a 24⁵-state enumeration
  ≈1s — the floor used to freeze ~4s with X-ray on), and runs the LDW lab's
  10,000 seeded spins (the learn page no longer blocks first paint). Identical
  numbers everywhere — same engine code, same seeds; environments without
  workers (SSG, tests) fall back to the same math computed synchronously.
```

- [ ] **Step 2: Full repo gate**

Run: `pnpm check`
Expected: green end-to-end, verify 10/10.

- [ ] **Step 3: Live long-task probe** (`pnpm dev`, real browser)

1. Floor page, session started, X-ray OFF. Install `new PerformanceObserver(list => window.__lt.push(...list.getEntries().map(e => Math.round(e.duration)))).observe({ entryTypes: ['longtask'] })` with `window.__lt = []`.
2. Toggle X-ray ON. Wait ~5s. Cards must show "computing exact odds…" then fill with the SAME RTP values as before the tranche (canal 92.4559%, dragons 93.9950%, thunder 90.2948%, ruby 90.0802%). `window.__lt` must contain NO ~1000ms entries (previously four).
3. `/learn/ldw-near-miss` with a fresh probe: page paints immediately, table fills with 63.34% share; no ≈40k-spin long task.
4. PAR sheet Math tab on a video machine: spinner then exact RTP; no ~1s main-thread task.
5. Console: zero errors.

- [ ] **Step 4: Commit, merge (house pattern), stay unpushed**

```bash
git add CHANGELOG.md
git commit -m "docs: CHANGELOG — exact math off the main thread"
git checkout main && git merge --ff-only worker-offload && git branch -d worker-offload
```

(Timestamps are business-hours — off-hours rewrite before any push.)
