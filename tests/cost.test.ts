import { describe, it, expect } from 'vitest'
import { initMachineState, mulberry32, nextSpinCost, spin } from '../app/engine'
import { FLOOR } from '../app/machines'

// Interactive families (deal/stop/cash) are driven through their own actions;
// spin() throws for them. Every family must appear in exactly one set — a new
// family fails loudly here instead of silently skipping the property test.
const INTERACTIVE = new Set(['blackjack-reel', 'lock-reel'])
const SPINNABLE = new Set(['stepper', 'bally-em', 'video', 'pachislo', 'cascade', 'wheel'])

describe('nextSpinCost predicts every spin cost exactly', () => {
  for (const def of FLOOR) {
    if (INTERACTIVE.has(def.family)) continue
    if (!SPINNABLE.has(def.family)) {
      throw new Error(`cost.test: unhandled family '${def.family}' — add it to SPINNABLE or INTERACTIVE`)
    }
    it(`${def.id}: 5,000 seeded spins, prediction === outcome.coinsIn`, () => {
      const state = initMachineState(def)
      const rand = mulberry32(def.id.length * 7919 + 42)
      const coins = def.family === 'bally-em' && def.payMode === 'lines' ? 1 : def.maxCoins
      for (let i = 0; i < 5_000; i++) {
        const predicted = nextSpinCost(def, state, coins)
        const out = spin(def, state, coins, rand)
        expect(out.coinsIn).toBe(predicted)
      }
    })
  }
})
