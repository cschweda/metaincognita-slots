/**
 * Headless floor verification — the family's non-graphical statistical
 * component (compare: holdem scripts/simulate.ts, craps unit suites).
 *
 *   pnpm verify                     # 5M spins per machine
 *   pnpm verify -- --spins 1000000  # custom N
 *   pnpm verify -- --seed 42
 *
 * Exit code 0 when every machine lands inside its 3.5-sigma band, 1 otherwise.
 */
import { exactRtp, simulateMachine } from '../app/engine'
import { validateMachineDef } from '../app/engine/validate'
import type { MachineDef } from '../app/engine/types'
import { FLOOR } from '../app/machines'

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1 || i + 1 >= process.argv.length) return fallback
  const n = Number(process.argv[i + 1])
  if (!Number.isFinite(n) || n <= 0) {
    console.error(`--${name} must be a positive number, got "${process.argv[i + 1]}"`)
    process.exit(2)
  }
  return n
}

const spins = arg('spins', 5_000_000)
const seed = arg('seed', 20260612)

const pct = (x: number) => (x * 100).toFixed(4).padStart(9) + '%'

function coinsFor(def: MachineDef): number {
  switch (def.family) {
    case 'stepper': return def.maxCoins
    case 'bally-em': return def.payMode === 'lines' ? 1 : def.maxCoins
    case 'video': return def.maxCoins
    case 'pachislo': return def.maxCoins
    default: {
      const exhaustive: never = def
      throw new Error(`unhandled family ${(exhaustive as MachineDef).family}`)
    }
  }
}

console.log('=== metaincognita-slots floor verification ===')
console.log(`spins/machine: ${spins.toLocaleString()}   base seed: ${seed}\n`)
console.log('machine               coins   exact RTP    sim RTP      Δ           HF exact     HF sim      jackpots  σ-band')

let allPass = true

FLOOR.forEach((def, i) => {
  validateMachineDef(def)
  const coins = coinsFor(def)
  const exact = exactRtp(def, { coins })
  let rtp: number
  let hf: number
  let jackpots: number
  let se: number
  if (def.family === 'pachislo') {
    // attribution variance is not an i.i.d. SE — use 10 independent sub-runs
    const blocks = 10
    const per = Math.max(1, Math.floor(spins / blocks))
    const rtps: number[] = []
    let inSum = 0
    let outSum = 0
    let hfSum = 0
    jackpots = 0
    for (let b = 0; b < blocks; b++) {
      const sim = simulateMachine(def, {
        spins: per, coins, seed: seed + i * 1000 + b, progressiveMode: 'static'
      })
      rtps.push(sim.rtp)
      inSum += sim.totalIn
      outSum += sim.totalOut
      hfSum += sim.hitFrequency
      jackpots += sim.jackpotHits
    }
    rtp = outSum / inSum
    hf = hfSum / blocks
    const mean = rtps.reduce((a, x) => a + x, 0) / blocks
    const sd = Math.sqrt(rtps.reduce((a, x) => a + (x - mean) ** 2, 0) / (blocks - 1))
    se = sd / Math.sqrt(blocks)
  } else {
    const sim = simulateMachine(def, { spins, coins, seed: seed + i, progressiveMode: 'static' })
    rtp = sim.rtp
    hf = sim.hitFrequency
    jackpots = sim.jackpotHits
    // SE divisor is cycles: within-spin coins are perfectly correlated on
    // coins-linear machines, and video variancePerCoin is full-cycle variance
    se = Math.sqrt(exact.variancePerCoin / spins)
  }
  const delta = Math.abs(rtp - exact.rtpPerCoin)
  const pass = delta < 3.5 * se
  allPass &&= pass
  console.log(
    `${def.id.padEnd(22)}${String(coins).padStart(3)}   ${pct(exact.rtpPerCoin)}  ${pct(rtp)}  ${pct(delta)}  ${pct(exact.hitFrequency)}  ${pct(hf)}  ${String(jackpots).padStart(8)}  ${pass ? 'PASS' : 'FAIL'}`
  )
})

console.log('\njackpots = progressive METER hits only (Bally dual/single, Thunder Vault Grand).')
console.log('Pachislo REG/BIG are bonus flags, not progressives; stock-rush reports at its default')
console.log(`odds level (4) with a block-empirical sigma. Spins are CYCLES: base/normal games.`)
console.log(allPass
  ? '\nPASS: every machine is inside its 3.5-sigma statistical band.'
  : '\nFAIL: at least one machine fell outside its band — engine bug or band misconfiguration.')
process.exit(allPass ? 0 : 1)
