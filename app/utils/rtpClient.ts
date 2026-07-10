// app/utils/rtpClient.ts
// The ONLY doorway to rtp.worker: a keyed report cache with pending-promise
// dedupe. Where `Worker` doesn't exist (SSR/SSG, vitest, ancient browsers) —
// or if the worker errors — it computes synchronously via the same exactRtp,
// so results are identical everywhere and existing tests need no changes.
// In fallback mode the cache is populated BEFORE the promise resolves, so
// useExactRtp can fill synchronously (test transparency).
import { exactRtp } from '~/engine'
import type { ExactRtpReport, MachineDef } from '~/engine'
import type { ExactRtpOptions } from '~/engine/exactRtp'
import { runLdwExperiment } from '~/utils/ldwExperiment'
import type { LdwExperimentResult } from '~/utils/ldwExperiment'
import { runMythsExperiment } from '~/utils/mythsExperiment'
import type { MythsExperimentResult } from '~/utils/mythsExperiment'
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
  resolveMyths?: (r: MythsExperimentResult) => void
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
    else if (msg.type === 'mythsResult') w.resolveMyths?.(msg.result)
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

  // Parked families' solvers live behind ~/engine/parked — load them before
  // any main-thread exactRtp on such a def (worker crash or no-Worker paths).
  const needsParked = def.family === 'blackjack-reel' || def.family === 'lock-reel'
  const syncCompute = async (): Promise<ExactRtpReport> => {
    if (needsParked) await import('~/engine/parked')
    return exactRtp(def, toEngineOpts(opts))
  }

  const w = getWorker()
  if (w === null) {
    // Sync-path fallback: compute now, cache BEFORE resolving (floor families
    // stay fully synchronous — parked ones await their solver module first).
    if (!needsParked) {
      const report = exactRtp(def, toEngineOpts(opts))
      reports.set(key, report)
      return Promise.resolve(report)
    }
    const p = syncCompute().then((report) => {
      reports.set(key, report)
      pending.delete(key)
      return report
    })
    pending.set(key, p)
    return p
  }

  const reqId = nextReqId++
  const p = new Promise<ExactRtpReport>((resolve, reject) => {
    waiters.set(reqId, { resolveReport: resolve, reject })
    const msg: RtpWorkerIncoming = { type: 'exactRtp', reqId, machineId: def.id, opts: toEngineOpts(opts) }
    w.postMessage(msg)
  })
    .catch(() => syncCompute()) // degraded to jank, never to missing numbers
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
