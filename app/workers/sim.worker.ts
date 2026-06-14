// app/workers/sim.worker.ts
/// <reference lib="webworker" />
import { FLOOR } from '~/machines'
import { createSimLabRun } from '~/engine/sessions'
import type { SimLabOptions } from '~/engine/sessions'

declare const self: DedicatedWorkerGlobalScope

type RunOpts = Omit<SimLabOptions, 'machineId'>
type Incoming = { type: 'run', machineId: string, opts: RunOpts } | { type: 'cancel' }

let cancelled = false

self.onmessage = async (e: MessageEvent<Incoming>): Promise<void> => {
  const msg = e.data
  if (msg.type === 'cancel') {
    cancelled = true
    return
  }
  if (msg.type !== 'run') return
  cancelled = false

  const def = FLOOR.find(m => m.id === msg.machineId)
  if (!def) {
    self.postMessage({ type: 'error', message: `unknown machine ${msg.machineId}` })
    return
  }

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
      if (cancelled) {
        self.postMessage({ type: 'cancelled', result: run.result() })
        return
      }
    }
    self.postMessage({ type: 'done', result: run.result() })
  } catch (err) {
    self.postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) })
  }
}
