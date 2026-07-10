// app/engine/simulate.ts
// Headless Monte-Carlo over ANY machine family — including the parked
// interactive ones (blackjack-reel optimal-policy, lock-reel honest-stop).
// Split out of the barrel so its parked-engine imports live only where the
// callers do: verify-floor, the convergence/machine test suites, and the
// workers. App code never imports this module.
import type { MachineDef } from './types'
import { mulberry32 } from './rng'
import { feedProgressive } from './progressive'
import { initMachineState, spin } from './index'
import { playBlackjackHand } from './blackjackReel'
import { makeOptimalStopFn } from './blackjackReelRtp'
import { playLockRound } from './lockReel'

export interface SimOptions {
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

  // ── blackjack-reel (Flameout 21 crash): optimal-policy Monte-Carlo ─────────
  // Each cycle = one hand. dealReels charges the ante once (coinsIn = opts.coins);
  // stopReel and cashOut are free. The optimal cash/climb decision is driven by a
  // closed-form policy built once for def. optStop returns 'continue' for the deal
  // reels (the deal is always drawn) and cashOut is only ever called at idx >= 2.
  // jackpotHits is always 0 (blackjack-reel has no progressive; progressive: null).
  if (def.family === 'blackjack-reel') {
    const optStop = makeOptimalStopFn(def)
    let totalIn = 0
    let totalOut = 0
    let hits = 0
    let cycles = 0
    let net = 0
    let peak = 0
    let maxDrawdown = 0
    const byEntry: Record<string, number> = {}

    while (cycles < opts.spins) {
      const hand = playBlackjackHand(def, state, opts.coins, rand, optStop,
        (w) => { byEntry[w.entryId] = (byEntry[w.entryId] ?? 0) + 1 })
      totalIn += hand.coinsIn
      totalOut += hand.payout
      net += hand.payout - opts.coins
      if (net > peak) peak = net
      if (peak - net > maxDrawdown) maxDrawdown = peak - net
      if (hand.payout > 0) hits++
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

  // ── lock-reel (Stop & Lock 777 cash-collect): honest-stop Monte-Carlo ──────
  // Each cycle = one round. dealStart charges the ante once (coinsIn = opts.coins);
  // the five stops and the bonus respins are free. The honest stop is a uniform
  // window draw (skill-neutral), so there is no policy to optimise — the sim just
  // stops every reel and auto-plays the bonus to completion. The two-7s tease is
  // a flag-only affordance (no auto re-stop), so the sim's RTP is the clean
  // 5-stop collect + 3-seven bonus that the exact-RTP module enumerates.
  // jackpotHits is always 0 (lock-reel has no progressive; progressive: null).
  if (def.family === 'lock-reel') {
    let totalIn = 0
    let totalOut = 0
    let hits = 0
    let cycles = 0
    let net = 0
    let peak = 0
    let maxDrawdown = 0
    const byEntry: Record<string, number> = {}

    while (cycles < opts.spins) {
      const round = playLockRound(def, state, opts.coins, rand,
        (w) => { byEntry[w.entryId] = (byEntry[w.entryId] ?? 0) + 1 })
      totalIn += round.coinsIn
      totalOut += round.payout
      net += round.payout - opts.coins
      if (net > peak) peak = net
      if (peak - net > maxDrawdown) maxDrawdown = peak - net
      if (round.payout > 0) hits++
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
    if (opts.progressiveMode === 'live') feedProgressive(def, state.progressive, 'before', opts.coins)
    const out = spin(def, state, opts.coins, rand)
    if (opts.progressiveMode === 'live') feedProgressive(def, state.progressive, 'after', out.coinsIn)
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
        e.type === 'flag-realized' || e.type === 'free-spins-triggered' || e.type === 'orbs-locked'
        || e.type === 'wheel-armed')
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
    || state.wheel?.pending === true
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
