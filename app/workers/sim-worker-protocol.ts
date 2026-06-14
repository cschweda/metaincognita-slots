// app/workers/sim-worker-protocol.ts
import type { SimLabResult, SimLabOptions } from '~/engine/sessions'

export type SimWorkerIncoming
  = | { type: 'run', machineId: string, opts: Omit<SimLabOptions, 'machineId'> }
    | { type: 'cancel' }

export type SimWorkerOutgoing
  = | { type: 'progress', completed: number, total: number }
    | { type: 'done', result: SimLabResult }
    | { type: 'cancelled', result: SimLabResult }
    | { type: 'error', message: string }
