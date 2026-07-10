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
