import type { MachineDef, MachineSessionState, SpinOutcome } from './types'
import type { RandomFn } from './rng'
import { spinStepper } from './stepper'
import { spinBallyEm } from './ballyEm'
import { spinVideo } from './video'
import { spinPachislo } from './pachislo'
import { initProgressiveState } from './progressive'
import { freshBlackjackState, freshLockState } from './sessionState'
import { spinCascade } from './cascade'
import { spinWheel } from './wheelGame'

export * from './types'
export { mulberry32, cryptoSeed } from './rng'
export type { RandomFn } from './rng'
export { exactRtp } from './exactRtp'
export type { ExactRtpReport } from './exactRtp'
export { nearMisses } from './nearMiss'
export { validateMachineDef } from './validate'
export { initProgressiveState, addCoinToProgressive, feedProgressive } from './progressive'
export { freshBlackjackState, freshLockState } from './sessionState'

export function initMachineState(def: MachineDef): MachineSessionState {
  return {
    progressive: def.progressive === null ? null : initProgressiveState(def.progressive),
    videoFeature: null,
    pachislo: def.family === 'pachislo'
      ? {
          oddsLevel: def.defaultOddsLevel,
          smallQueue: [],
          bonusQueue: [],
          replayNext: false,
          bonus: null
        }
      : null,
    blackjackReel: def.family === 'blackjack-reel' ? freshBlackjackState() : null,
    lockReel: def.family === 'lock-reel' ? freshLockState(def) : null,
    wheel: def.family === 'wheel' ? { pending: false } : null
  }
}

/**
 * Cost in coins of the NEXT spin() call given the current session state —
 * what the store must charge before committing. Mirrors the evaluators'
 * routing: video feature spins are free; pachislo bonus games cost their
 * configured token; a granted replay is free.
 */
export function nextSpinCost(def: MachineDef, state: MachineSessionState, coins: number): number {
  switch (def.family) {
    case 'stepper':
    case 'bally-em':
      return coins
    case 'video':
      return state.videoFeature !== null ? 0 : coins
    case 'pachislo': {
      const ps = state.pachislo
      if (ps === null) return coins
      if (ps.bonus !== null) {
        return ps.bonus.interlude !== null ? def.interlude.cost : def.jac.cost
      }
      return ps.replayNext ? 0 : coins
    }
    case 'blackjack-reel':
      return coins
    // lock-reel is interactive; the ante is charged on dealStart
    case 'lock-reel':
      return coins
    // cascade is fixed-bet, non-interactive; the whole tumble is one paid spin
    case 'cascade':
      return coins
    // an armed wheel topper is a FREE spin (the classic contract)
    case 'wheel':
      return state.wheel?.pending === true ? 0 : coins
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled machine family: ${(exhaustive as MachineDef).family}`)
    }
  }
}

export function spin(
  def: MachineDef,
  state: MachineSessionState,
  coins: number,
  rand: RandomFn
): SpinOutcome {
  switch (def.family) {
    case 'stepper':
      return spinStepper(def, state, coins, rand)
    case 'bally-em':
      return spinBallyEm(def, state, coins, rand)
    case 'video':
      return spinVideo(def, state, coins, rand)
    case 'pachislo':
      return spinPachislo(def, state, coins, rand)
    case 'blackjack-reel':
      throw new Error('blackjack-reel is interactive; use dealReels/stopReel/cashOut')
    case 'lock-reel':
      throw new Error('lock-reel is interactive; use dealStart/stopReel/bonusStop')
    case 'cascade':
      return spinCascade(def, state, coins, rand)
    case 'wheel':
      return spinWheel(def, state, coins, rand)
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled machine family: ${(exhaustive as MachineDef).family}`)
    }
  }
}

// simulateMachine (Monte-Carlo over any family, parked included) lives in
// ./simulate — its parked-engine imports must not ride the app barrel.
