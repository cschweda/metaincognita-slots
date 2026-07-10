// app/engine/sessionState.ts
// Fresh-session-state factories for the INTERACTIVE (parked) families. Pure
// data, no game logic — split from blackjackReel.ts/lockReel.ts so the store's
// synchronous restore path and the barrel's initMachineState can build state
// for a saved parked session WITHOUT dragging the parked engines onto the
// boot path (those live behind ~/engine/parked).
import type {
  BlackjackReelSessionState,
  LockReelMachineDef,
  LockReelSessionState,
  SymbolId
} from './types'

export function freshBlackjackState(): BlackjackReelSessionState {
  return {
    phase: 'idle',
    reelStrips: [],
    landed: [null, null, null, null, null],
    idx: 0,
    hand: [],
    velocity: 0,
    multiplier: 1,
    crashed: false,
    natural: false,
    ante: 0
  }
}

export function freshLockState(def: LockReelMachineDef): LockReelSessionState {
  return {
    phase: 'idle',
    grid: Array.from({ length: 5 }, () => new Array<SymbolId | null>(def.rows).fill(null)),
    idx: 0,
    sevenCount: 0,
    collectCredits: 0,
    respinsLeft: 0,
    ante: 0
  }
}
