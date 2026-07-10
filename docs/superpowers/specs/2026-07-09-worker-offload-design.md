# Worker Offload — Design Spec (2026-07-09)

Audit tranche 3 (owner-approved): three main-thread stalls move to a worker —
the floor's X-ray toggle (4 video machines × 24⁵-state `exactRtp` ≈ ~4s
frozen), the `/learn/ldw-near-miss` page (up to 40k synchronous spins in
`onMounted`), and the PAR sheet's Math tab (~1s per video machine). No number
changes anywhere — same reports, same seeds; the UI gains loading states.

## Architecture

### New: `app/workers/rtp.worker.ts` + `app/workers/rtp-worker-protocol.ts`
A second, LONG-LIVED module worker (unlike `sim.worker`, which is terminated
per run) — requests are short and cacheable, so one instance serves the whole
session. It resolves defs from `ALL_MACHINES` (the PAR sheet can open on a
parked machine).

```ts
export type RtpWorkerIncoming
  = | { type: 'exactRtp', reqId: number, machineId: string, opts: ExactRtpOptions }
    | { type: 'ldw', reqId: number }
export type RtpWorkerOutgoing
  = | { type: 'result', reqId: number, report: ExactRtpReport }
    | { type: 'ldwResult', reqId: number, result: LdwExperimentResult }
    | { type: 'error', reqId: number, message: string }
```

### New: `app/utils/ldwExperiment.ts`
The page's `runExperiment()` extracted VERBATIM (leaf engine imports, seed
`mulberry32(20260703)` kept — the page copy promises "reload and the numbers
repeat exactly", and memory of the published number is 63.34% LDW share).
Callable from the worker, the sync fallback, and tests.

### New: `app/utils/rtpClient.ts`
The client-side async cache — the only place that talks to the worker.

```ts
peekExactRtp(def, opts): ExactRtpReport | null      // sync cache read
exactRtpAsync(def, opts): Promise<ExactRtpReport>   // worker-backed
ldwExperimentAsync(): Promise<LdwExperimentResult>
```

- Cache keyed `def.id:oddsLevel:coins` (same normalization floorIntel uses);
  pending-promise dedupe so ten floor cards asking at once post once each.
- **No `Worker` global (SSR, vitest/happy-dom, ancient browsers) → compute
  synchronously via `exactRtp` inside a resolved promise.** This single rule
  keeps SSG builds, every existing component test, and the derived-RTP
  assertions working with ZERO churn.
- A worker `error` response (or construction throw) also falls back to the
  sync path — degraded to jank, never to wrong/missing numbers.

### New: `app/composables/useExactRtp.ts`
`useExactRtp(def: () => MachineDef | null, opts?: () => FloorIntelOptions)`
→ `Ref<ExactRtpReport | null>`. Watches the getters; `null` def → `null`
(the "don't compute" gate); cache hit fills synchronously (no flash on
revisits); otherwise requests async with a staleness token so a fast machine
switch can't paint the wrong report.

### Modified consumers
- `app/utils/floorIntel.ts`: gains `intelFromReport(def, report): FloorIntel`
  (the derivation, extracted); `floorIntel()` keeps its sync signature and
  cache for tests/SSG callers — hot-path components stop calling it.
- `MachineCard.vue`: `useExactRtp(() => store.settings.xray ? props.def : null,
  () => ({ coins: bet }))` + `intelFromReport`; while X-ray is on and the
  report is pending, the stats block shows a dim "computing…" line.
- `SessionSidebar.vue` / `XrayPanel.vue`: same pattern (opts carry
  `oddsLevel`/`coins` exactly as their `floorIntel` calls do today); existing
  `v-if` null-guards absorb the pending state.
- `ParSheetModal.vue`: the Math-tab watcher drops the 30ms paint-delay hack and
  awaits `exactRtpAsync` (the `computing` spinner already exists); a token
  guards stale writes when the tab/machine changes mid-compute.
- `ldw-near-miss.vue`: `onMounted(async () => { exp.value = await
  ldwExperimentAsync() })`; the template's null state ("measuring…") already
  exists.

### Explicitly untouched
`house-edge.vue` and `pachislo.vue` (SSG-time sync computes — build-time, not
runtime jank), `PachisloControls` operator-key levels (21³ ≈ trivial),
`lockReelExactRtp`/`blackjackReelExactRtp` direct calls in XrayPanel (parked
families, small state spaces), Sim Lab's own worker.

## Testing

- `tests/utils/ldwExperiment.test.ts`: freezes the seeded result —
  `ldwShareOfWins ≈ 0.6334` (the published number), paid-spin invariants.
- `tests/utils/rtpClient.test.ts` (node, no Worker): async result deep-equals
  sync `exactRtp` for a cheap machine; second call returns the cached object;
  `peekExactRtp` null-then-hit; distinct opts → distinct cache entries;
  `ldwExperimentAsync` equals the direct call.
- All existing suites must pass UNCHANGED via the sync fallback (parSheet's
  derived assertions included). One tolerated exception: `learnPages.test.ts`
  may need one extra `nextTick` for the now-async LDW experiment — test-only,
  and only if proven necessary.
- Worker shell stays thin and untested, matching the `sim.worker` precedent —
  its two callees are the unit-tested functions above.
- Live acceptance (browser): a `PerformanceObserver('longtask')` probe while
  toggling floor X-ray and loading the LDW page — the ~1s-per-video-machine
  main-thread tasks must be gone (worker does the work; cards/tables fill in
  asynchronously); values shown must match the pre-tranche numbers.

## Rejected alternatives

- **Extending `sim.worker`** — its composable terminates the instance per run
  and its protocol is Sim-Lab-shaped (progress/cancel); grafting short RPC
  onto it couples two lifecycles for no gain.
- **Chunking on the main thread** (rAF/idle slicing of the 24⁵ loop) — keeps
  the CPU cost on the UI thread, complicates the exact-math code, and the
  worker infrastructure already exists and is CSP-proven.
