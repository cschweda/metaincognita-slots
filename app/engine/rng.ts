// Seeded PRNG — same algorithm family as metaincognita-flameout.
// mulberry32: fast, solid 32-bit generator; deterministic per seed so
// simulations and tests are exactly reproducible.

export type RandomFn = () => number

export function mulberry32(seed: number): RandomFn {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Crypto-quality seed for live play; sims pass fixed seeds instead. */
export function cryptoSeed(): number {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0]!
}
