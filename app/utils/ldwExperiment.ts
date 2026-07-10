// app/utils/ldwExperiment.ts
// The /learn/ldw-near-miss live experiment, extracted so the rtp.worker, the
// no-Worker sync fallback, and the page all run the SAME code. Seeded
// (mulberry32(20260703)) — the page promises "reload and the numbers repeat
// exactly", and tests freeze the published 63.34% LDW share.
// Leaf-module imports on purpose: the worker bundle only needs the video
// evaluator, the RNG, and the near-miss detector — not the whole engine barrel.
import { CANAL_ROYALE } from '~/machines/canal-royale'
import { spinVideo } from '~/engine/video'
import { mulberry32 } from '~/engine/rng'
import { nearMisses } from '~/engine/nearMiss'
import type { MachineSessionState } from '~/engine/types'

export const LDW_PAID_SPINS = 10_000

export interface LdwExperimentResult {
  wins: number
  trueWins: number
  ldw: number
  nearMissLosses: number
  hitPct: number
  trueWinPct: number
  ldwPct: number
  ldwShareOfWins: number
}

export function runLdwExperiment(): LdwExperimentResult {
  const def = CANAL_ROYALE
  // canal-royale has no progressive and no interactive state — a fresh video
  // session is all-null (what initMachineState(def) would build).
  const state: MachineSessionState = {
    progressive: null, videoFeature: null, pachislo: null, blackjackReel: null, lockReel: null
  }
  const rand = mulberry32(20260703)
  const bet = def.maxCoins
  let paid = 0
  let wins = 0
  let trueWins = 0
  let ldw = 0
  let nearMissLosses = 0
  let guard = 0
  while (paid < LDW_PAID_SPINS && guard < LDW_PAID_SPINS * 4) {
    guard++
    const out = spinVideo(def, state, bet, rand)
    if (out.coinsIn === 0) continue // free-feature games: no stake at risk
    paid++
    if (out.totalPayout === 0) {
      if (nearMisses(def, out).length > 0) nearMissLosses++
    } else {
      wins++
      if (out.totalPayout >= out.coinsIn) trueWins++
      else ldw++
    }
  }
  return {
    wins,
    trueWins,
    ldw,
    nearMissLosses,
    hitPct: wins / LDW_PAID_SPINS,
    trueWinPct: trueWins / LDW_PAID_SPINS,
    ldwPct: ldw / LDW_PAID_SPINS,
    ldwShareOfWins: wins > 0 ? ldw / wins : 0
  }
}
