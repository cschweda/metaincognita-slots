// app/utils/mythsExperiment.ts
// The /learn/myths live experiment, shared by the rtp.worker, the no-Worker
// sync fallback, and the tests (the ldwExperiment pattern). Seeded
// (mulberry32(20260709)) so the page can promise "reload and the numbers
// repeat exactly". Leaf-module imports on purpose: the worker bundle needs
// the stepper evaluator, the RNG, and the exact math — not the engine barrel.
import { SEVENS_ABLAZE } from '~/machines/sevens-ablaze'
import { spinStepper } from '~/engine/stepper'
import { mulberry32 } from '~/engine/rng'
import { exactRtp } from '~/engine/exactRtp'
import type { MachineSessionState } from '~/engine/types'

export const MYTHS_SPINS = 250_000

export interface MythsBucket {
  label: string
  samples: number
  hitRate: number
}

export interface MythsExperimentResult {
  spins: number
  /** P(any pay) across all spins — the number every bucket must match */
  overallHitRate: number
  /** hit rate conditioned on what just happened — the refutation, as data */
  buckets: MythsBucket[]
  /** longest run of consecutive no-pay spins observed */
  longestDrought: number
  /** 3×F7 top-award hits ('3f7') */
  jackpots: number
  /** spins between consecutive jackpots (n−1 gaps) */
  jackpotGaps: { min: number, max: number, mean: number } | null
  /** engine-exact expected spins per jackpot: 1 / P('3f7') */
  expectedGap: number
}

/** Which conditional bucket does a spin belong to, given the streak BEFORE it? */
function bucketIndex(lossStreak: number, winStreak: number): number | null {
  if (winStreak >= 2) return 7 // after 2+ straight wins
  if (winStreak === 1) return 6 // after a win
  if (lossStreak >= 10) return 5
  if (lossStreak >= 5) return 4
  if (lossStreak >= 1) return lossStreak - 1 // 1..4 → 0..3
  return null // very first spin: no history yet
}

const BUCKET_LABELS = [
  'after 1 straight loss', 'after 2 straight losses', 'after 3 straight losses',
  'after 4 straight losses', 'after 5–9 straight losses', 'after 10+ straight losses',
  'after a win', 'after 2+ straight wins'
]

export function runMythsExperiment(): MythsExperimentResult {
  const def = SEVENS_ABLAZE
  // 1 coin on purpose: the top award is the fixed 1000-credit pay, so there is
  // no progressive meter to explain away. All-null session state is safe — the
  // meter branch requires maxCoins AND live progressive state.
  const state: MachineSessionState = {
    progressive: null, videoFeature: null, pachislo: null, blackjackReel: null, lockReel: null
  }
  const rand = mulberry32(20260709)
  const samples = new Array<number>(BUCKET_LABELS.length).fill(0)
  const bucketHits = new Array<number>(BUCKET_LABELS.length).fill(0)
  let hits = 0
  let lossStreak = 0
  let winStreak = 0
  let longestDrought = 0
  let jackpots = 0
  let lastJackpotSpin = -1
  const gaps: number[] = []
  for (let i = 0; i < MYTHS_SPINS; i++) {
    const idx = bucketIndex(lossStreak, winStreak)
    const out = spinStepper(def, state, 1, rand)
    const hit = out.totalPayout > 0
    if (idx !== null) {
      samples[idx]!++
      if (hit) bucketHits[idx]!++
    }
    if (hit) {
      hits++
      winStreak++
      lossStreak = 0
    } else {
      lossStreak++
      winStreak = 0
      if (lossStreak > longestDrought) longestDrought = lossStreak
    }
    if (out.wins.some(w => w.entryId === '3f7')) {
      jackpots++
      if (lastJackpotSpin >= 0) gaps.push(i - lastJackpotSpin)
      lastJackpotSpin = i
    }
  }
  const p3f7 = exactRtp(def).breakdown.find(b => b.entryId === '3f7')?.probability ?? 0
  return {
    spins: MYTHS_SPINS,
    overallHitRate: hits / MYTHS_SPINS,
    buckets: BUCKET_LABELS.map((label, i) => ({
      label, samples: samples[i]!, hitRate: samples[i]! > 0 ? bucketHits[i]! / samples[i]! : 0
    })),
    longestDrought,
    jackpots,
    jackpotGaps: gaps.length > 0
      ? { min: Math.min(...gaps), max: Math.max(...gaps), mean: gaps.reduce((a, b) => a + b, 0) / gaps.length }
      : null,
    expectedGap: p3f7 > 0 ? 1 / p3f7 : 0
  }
}
