// app/engine/parked.ts
// The ONLY doorway to the PARKED machine engines (Flameout 21's blackjack-reel
// crash, Stop & Lock 777's lock-reel collect). Importing this module registers
// their exactRtp solvers and exposes their interactive APIs.
//
// Static importers: the workers (rtp.worker needs PAR math for parked defs)
// and node-side callers (tests, verify, simulate consumers). The APP never
// imports it statically — the store and the rtpClient fallback dynamic-import
// it on the rare paths that can still reach a parked machine (a restored
// legacy session, a no-Worker PAR view) so ~58KB of parked engine stays off
// the boot path of a floor it isn't on.
import { blackjackReelExactRtp } from './blackjackReelRtp'
import { lockReelExactRtp } from './lockReelRtp'
import { registerExactRtpSolver } from './exactRtp'
import type { BlackjackReelMachineDef, LockReelMachineDef } from './types'

// The registry dispatches only when def.family already matches, so the
// narrowing casts are sound by construction.
registerExactRtpSolver('blackjack-reel', (def, opts) => blackjackReelExactRtp(def as BlackjackReelMachineDef, opts))
registerExactRtpSolver('lock-reel', (def, opts) => lockReelExactRtp(def as LockReelMachineDef, opts))

export { dealReels, stopReel, cashOut, playBlackjackHand } from './blackjackReel'
export { blackjackReelExactRtp, makeOptimalStopFn } from './blackjackReelRtp'
export { dealStart, stopReel as lockStopReel, bonusStop, playLockRound } from './lockReel'
export { lockReelExactRtp } from './lockReelRtp'
