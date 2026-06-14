// app/workers/sim.worker.ts
/// <reference lib="webworker" />
import { FLOOR } from '~/machines'
import { createSimLabRun } from '~/engine/sessions'
import type { SimWorkerIncoming, SimWorkerOutgoing } from './sim-worker-protocol'

declare const self: DedicatedWorkerGlobalScope

// The composable terminates the worker after each done/cancelled/error, so each run
// uses a fresh worker instance; this module is not designed for run reuse within one instance.
let cancelled = false

self.onmessage = async (e: MessageEvent<SimWorkerIncoming>): Promise<void> => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelled = true
    return
  }
  if (msg.type !== 'run') return
  cancelled = false

  const def = FLOOR.find(m => m.id === msg.machineId)
  if (!def) {
    const errMsg: SimWorkerOutgoing = { type: 'error', message: `unknown machine ${msg.machineId}` }
    self.postMessage(errMsg)
    return
  }

  try {
    const run = createSimLabRun(def, { ...msg.opts, machineId: msg.machineId })
    const BATCH = 200
    let done = false
    while (!done) {
      const r = run.runBatch(BATCH)
      done = r.done
      const progressMsg: SimWorkerOutgoing = { type: 'progress', completed: r.completed, total: run.total }
      self.postMessage(progressMsg)
      if (done) break
      // Yield so a queued 'cancel' message can be delivered, then honor it.
      await new Promise<void>(resolve => setTimeout(resolve, 0))
      if (cancelled) {
        const cancelledMsg: SimWorkerOutgoing = { type: 'cancelled', result: run.result() }
        self.postMessage(cancelledMsg)
        return
      }
    }
    const doneMsg: SimWorkerOutgoing = { type: 'done', result: run.result() }
    self.postMessage(doneMsg)
  } catch (err) {
    const catchMsg: SimWorkerOutgoing = { type: 'error', message: err instanceof Error ? err.message : String(err) }
    self.postMessage(catchMsg)
  }
}
