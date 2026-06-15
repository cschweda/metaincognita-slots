import { describe, it, expect } from 'vitest'
import { initMachineState, mulberry32, nextSpinCost, spin } from '../app/engine'
import { FLOOR } from '../app/machines'

describe('nextSpinCost predicts every spin cost exactly', () => {
  for (const def of FLOOR) {
    // blackjack-reel is interactive (deal/hit/stand); spin() throws for this family
    if (def.family === 'blackjack-reel') continue
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
