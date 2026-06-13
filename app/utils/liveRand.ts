import { cryptoSeed, mulberry32 } from '~/engine'
import type { RandomFn } from '~/engine'

let current: RandomFn = mulberry32(cryptoSeed())

/** Live-play RNG. A stable function identity that delegates to a swappable stream. */
export const liveRand: RandomFn = () => current()

/** Test seam: inject a seeded stream (tests) or reseed (new session). */
export function setLiveRand(fn: RandomFn): void {
  current = fn
}

export function reseedLiveRand(): void {
  current = mulberry32(cryptoSeed())
}
