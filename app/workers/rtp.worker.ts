// app/workers/rtp.worker.ts
/// <reference lib="webworker" />
// Long-lived RPC worker for the exact-math hot paths (floor X-ray, PAR sheet)
// and the LDW lab — unlike sim.worker it is NOT terminated per request; the
// rtpClient keeps one instance for the whole session and dispatches by reqId.
import { ALL_MACHINES } from '~/machines'
import { exactRtp } from '~/engine'
import '~/engine/parked' // registers the parked families' exactRtp solvers
import { runLdwExperiment } from '~/utils/ldwExperiment'
import { runMythsExperiment } from '~/utils/mythsExperiment'
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
    if (msg.type === 'myths') {
      const out: RtpWorkerOutgoing = { type: 'mythsResult', reqId: msg.reqId, result: runMythsExperiment() }
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
