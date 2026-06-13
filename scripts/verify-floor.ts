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
import { FLOOR } from '../app/machines'

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1 || i + 1 >= process.argv.length) return fallback
  return Number(process.argv[i + 1])
}

const spins = arg('spins', 5_000_000)
const seed = arg('seed', 20260612)

const pct = (x: number) => (x * 100).toFixed(4).padStart(9) + '%'

console.log('=== metaincognita-slots floor verification ===')
console.log(`spins/machine: ${spins.toLocaleString()}   base seed: ${seed}\n`)
console.log('machine               coins   exact RTP    sim RTP      Δ           HF exact     HF sim      jackpots  σ-band')

let allPass = true

FLOOR.forEach((def, i) => {
  validateMachineDef(def)
  const coins = def.family === 'bally-em' && def.payMode === 'lines' ? 1 : def.maxCoins
  const exact = exactRtp(def, { coins })
  const sim = simulateMachine(def, { spins, coins, seed: seed + i, progressiveMode: 'static' })
  // SE divisor is spins alone: within-spin coins are perfectly correlated on
  // coins-linear machines (see tests/convergence.test.ts)
  const se = Math.sqrt(exact.variancePerCoin / spins)
  const delta = Math.abs(sim.rtp - exact.rtpPerCoin)
  const pass = delta < 3.5 * se
  allPass &&= pass
  console.log(
    `${def.id.padEnd(22)}${String(coins).padStart(3)}   ${pct(exact.rtpPerCoin)}  ${pct(sim.rtp)}  ${pct(delta)}  ${pct(exact.hitFrequency)}  ${pct(sim.hitRate)}  ${String(sim.jackpotHits).padStart(8)}  ${pass ? 'PASS' : 'FAIL'}`
  )
})

console.log(allPass
  ? '\nPASS: every machine is inside its 3.5-sigma statistical band.'
  : '\nFAIL: at least one machine fell outside its band — engine bug or band misconfiguration.')
process.exit(allPass ? 0 : 1)
