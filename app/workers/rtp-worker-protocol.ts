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
