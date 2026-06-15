// Lucky 21: engine bodies replaced with throwing stubs (Task 1).
// Real implementations land in later tasks.

import type { ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { BlackjackReelMachineDef, BlackjackReelSessionState } from './types'

export function blackjackReelExactRtp(
  _def: BlackjackReelMachineDef,
  _opts: ExactRtpOptions = {}
): ExactRtpReport {
  throw new Error('blackjackReelExactRtp: not implemented — later task')
}

export function optimalStop(): never {
  throw new Error('optimalStop: not implemented — later task')
}

export function optimalAction(
  _def: BlackjackReelMachineDef,
  _partialState: BlackjackReelSessionState
): 'hit' | 'stand' {
  throw new Error('optimalAction: not implemented — later task')
}

export function decisionEvs(
  _def: BlackjackReelMachineDef,
  _partialState: BlackjackReelSessionState
): { evHit: number, evStand: number, action: 'hit' | 'stand' } | null {
  throw new Error('decisionEvs: not implemented — later task')
}

export function strategyMatrixCell(
  _def: BlackjackReelMachineDef,
  _hardTotal: number,
  _numCards: number,
  _opts: { saveHeld?: boolean, multSum?: number } = {}
): 'hit' | 'stand' {
  throw new Error('strategyMatrixCell: not implemented — later task')
}
