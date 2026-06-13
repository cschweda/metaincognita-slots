import type { MachineDef, MachineSessionState, SpinOutcome } from './types'
import type { RandomFn } from './rng'
import { mulberry32 } from './rng'
import { spinStepper } from './stepper'
import { spinBallyEm } from './ballyEm'
import { spinVideo } from './video'
import { spinPachislo } from './pachislo'
import { initProgressiveState, addCoinToProgressive } from './progressive'

export * from './types'
export { mulberry32, cryptoSeed } from './rng'
export type { RandomFn } from './rng'
export { exactRtp } from './exactRtp'
export type { ExactRtpReport, ExactRtpOptions, ExactRtpBreakdownEntry } from './exactRtp'
export { validateMachineDef } from './validate'
export { initProgressiveState, addCoinToProgressive } from './progressive'

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
      : null
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
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled machine family: ${(exhaustive as MachineDef).family}`)
    }
  }
}

export interface SimOptions {
  spins: number
  coins: number
  seed: number
  /**
   * 'static': meters never fed — progressive awards pay reset values, making
   *           results directly comparable to exactRtp at-reset numbers.
   * 'live':   meters fed per coin-in (FO-5140 / percent semantics) and pay
   *           their grown values.
   */
  progressiveMode: 'static' | 'live'
}

export interface SimResult {
  machineId: string
  spins: number
  coins: number
  totalIn: number
  totalOut: number
  rtp: number
  /** fraction of spins with at least one win (vocabulary matches ExactRtpReport.hitFrequency) */
  hitFrequency: number
  jackpotHits: number
  /** deepest credits-below-peak point of the cumulative net curve */
  maxDrawdown: number
  /** win COUNT per paytable entry id — multiple wins of one entry in a spin all count */
  byEntry: Record<string, number>
}

export function simulateMachine(def: MachineDef, opts: SimOptions): SimResult {
  const rand = mulberry32(opts.seed)
  const state = initMachineState(def)
  let totalOut = 0
  let hits = 0
  let jackpotHits = 0
  let net = 0
  let peak = 0
  let maxDrawdown = 0
  const byEntry: Record<string, number> = {}

  for (let i = 0; i < opts.spins; i++) {
    if (opts.progressiveMode === 'live' && def.progressive !== null && state.progressive !== null) {
      for (let c = 0; c < opts.coins; c++) addCoinToProgressive(state.progressive, def.progressive)
    }
    const out = spin(def, state, opts.coins, rand)
    totalOut += out.totalPayout
    if (out.wins.length > 0) hits++
    jackpotHits += out.progressiveEvents.length
    for (const w of out.wins) byEntry[w.entryId] = (byEntry[w.entryId] ?? 0) + 1
    net += out.totalPayout - opts.coins
    if (net > peak) peak = net
    if (peak - net > maxDrawdown) maxDrawdown = peak - net
  }

  const totalIn = opts.spins * opts.coins
  return {
    machineId: def.id,
    spins: opts.spins,
    coins: opts.coins,
    totalIn,
    totalOut,
    rtp: totalOut / totalIn,
    hitFrequency: hits / opts.spins,
    jackpotHits,
    maxDrawdown,
    byEntry
  }
}
