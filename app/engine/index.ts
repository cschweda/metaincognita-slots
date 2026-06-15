import type { MachineDef, MachineSessionState, SpinOutcome } from './types'
import type { RandomFn } from './rng'
import { mulberry32 } from './rng'
import { spinStepper } from './stepper'
import { spinBallyEm } from './ballyEm'
import { spinVideo } from './video'
import { spinPachislo } from './pachislo'
import { initProgressiveState, addCoinToProgressive } from './progressive'
import { dealHand, hitCard, standHand } from './blackjackReel'
import { optimalAction } from './blackjackReelRtp'

export * from './types'
export { mulberry32, cryptoSeed } from './rng'
export type { RandomFn } from './rng'
export { exactRtp } from './exactRtp'
export type { ExactRtpReport } from './exactRtp'
export { nearMisses } from './nearMiss'
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
      : null,
    blackjackReel: def.family === 'blackjack-reel'
      ? { phase: 'idle', cards: [], total: 0, isSoft: false, multSum: 0, saveHeld: false, busted: false, charlie: false, ante: 0 }
      : null
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
      throw new Error('blackjack-reel is interactive; use dealHand/hitCard/standHand')
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled machine family: ${(exhaustive as MachineDef).family}`)
    }
  }
}

interface SimOptions {
  /**
   * Number of CYCLES: base games (video) / normal games (pachislo) / spins
   * (stepper, bally-em). Free spins, respins, JAC and interlude games are
   * simulated and accounted but do not count toward `spins`.
   */
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
  /** pachislo operator level 1..6 (default: def.defaultOddsLevel) */
  oddsLevel?: number
}

interface SimResult {
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

  // ── blackjack-reel: play N hands under the optimal policy ──────────────────
  // Each "hand" is one paid cycle (ante = opts.coins). Hit/stand loop driven by
  // optimalAction; dealHand/hitCard/standHand mutate state.blackjackReel and
  // return SpinOutcome; coinsIn on hitCard and standHand is 0 (only dealHand
  // charges the ante). We mirror the existing accounting exactly.
  if (def.family === 'blackjack-reel') {
    let totalIn = 0
    let totalOut = 0
    let hits = 0
    let cycles = 0
    let net = 0
    let peak = 0
    let maxDrawdown = 0
    const byEntry: Record<string, number> = {}

    while (cycles < opts.spins) {
      // deal charges the ante
      const dealOut = dealHand(def, state, opts.coins, rand)
      totalIn += dealOut.coinsIn // = opts.coins

      // hit-loop under the optimal policy until resolved
      let handOut = 0
      const bj = state.blackjackReel!
      while (bj.phase === 'dealt') {
        if (optimalAction(def, bj) === 'hit') {
          const out = hitCard(def, state, rand)
          handOut += out.totalPayout
          for (const w of out.wins) byEntry[w.entryId] = (byEntry[w.entryId] ?? 0) + 1
        } else {
          const out = standHand(def, state)
          handOut += out.totalPayout
          for (const w of out.wins) byEntry[w.entryId] = (byEntry[w.entryId] ?? 0) + 1
        }
      }
      // also credit any payout from the deal itself (none in current impl, but
      // mirror the existing loop's pattern of accumulating all wins)
      for (const w of dealOut.wins) byEntry[w.entryId] = (byEntry[w.entryId] ?? 0) + 1
      totalOut += dealOut.totalPayout + handOut

      const spinPayout = dealOut.totalPayout + handOut
      net += spinPayout - opts.coins
      if (net > peak) peak = net
      if (peak - net > maxDrawdown) maxDrawdown = peak - net

      if (spinPayout > 0) hits++
      cycles++
    }

    return {
      machineId: def.id,
      spins: opts.spins,
      coins: opts.coins,
      totalIn,
      totalOut,
      rtp: totalIn > 0 ? totalOut / totalIn : 0,
      hitFrequency: hits / opts.spins,
      jackpotHits: 0,
      maxDrawdown,
      byEntry
    }
  }

  // ── all other families ──────────────────────────────────────────────────────
  if (def.family === 'pachislo' && opts.oddsLevel !== undefined && state.pachislo !== null) {
    if (!Number.isInteger(opts.oddsLevel) || opts.oddsLevel < 1 || opts.oddsLevel > def.oddsLevels.length) {
      throw new Error(`${def.id}: oddsLevel ${opts.oddsLevel} out of range 1..${def.oddsLevels.length}`)
    }
    state.pachislo.oddsLevel = opts.oddsLevel
  }
  let totalIn = 0
  let totalOut = 0
  let hits = 0
  let jackpotHits = 0
  let cycles = 0
  let net = 0
  let peak = 0
  let maxDrawdown = 0
  const byEntry: Record<string, number> = {}

  const playOne = (): void => {
    // FO-5140 semantics: stepper/bally meters feed per intended coin BEFORE
    // the spin (Plan 1 behavior, preserved bit-for-bit). Video's Grand feeds
    // AFTER the spin by actual coinsIn — feature spins cost 0 and feed nothing.
    if (
      opts.progressiveMode === 'live' && def.progressive !== null && state.progressive !== null
      && (def.family === 'stepper' || def.family === 'bally-em')
    ) {
      for (let c = 0; c < opts.coins; c++) addCoinToProgressive(state.progressive, def.progressive)
    }
    const out = spin(def, state, opts.coins, rand)
    if (
      opts.progressiveMode === 'live' && def.family === 'video'
      && def.progressive !== null && state.progressive !== null
    ) {
      for (let c = 0; c < out.coinsIn; c++) addCoinToProgressive(state.progressive, def.progressive)
    }
    totalIn += out.coinsIn
    totalOut += out.totalPayout
    jackpotHits += out.progressiveEvents.length
    for (const w of out.wins) byEntry[w.entryId] = (byEntry[w.entryId] ?? 0) + 1
    net += out.totalPayout - out.coinsIn
    if (net > peak) peak = net
    if (peak - net > maxDrawdown) maxDrawdown = peak - net
    if (out.gameKind === 'base' || out.gameKind === 'normal') {
      cycles++
      const eventHit = out.featureEvents.some(e =>
        e.type === 'flag-realized' || e.type === 'free-spins-triggered' || e.type === 'orbs-locked')
      if (out.totalPayout > 0 || eventHit) hits++
    }
  }

  while (cycles < opts.spins) playOne()
  // Drain in-flight features so every counted cycle's payout is collected.
  // (Queued pachislo small flags stay pending — a few tokens of tail value,
  // statistically invisible at convergence scales.)
  while (
    state.videoFeature !== null
    || (state.pachislo !== null && state.pachislo.bonus !== null)
  ) {
    playOne()
  }

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
