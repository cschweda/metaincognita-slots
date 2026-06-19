import { describe, it, expect } from 'vitest'
import { validateMachineDef } from '../app/engine/validate'
import type { LockReelMachineDef } from '../app/engine/types'

/**
 * A minimal, structurally-valid lock-reel def (Stop & Lock 777 family).
 * Five strips, each longer than `rows` (4); every non-seven/blank/prize symbol
 * is a cash symbol declared with a positive integer value; one MINI prize.
 */
function makeDef(): LockReelMachineDef {
  const strip = (): string[] => ['CASH25', 'BLANK', 'SEVEN', 'CASH50', 'MINI', 'BLANK', 'CASH25']
  return {
    id: 'stop-and-lock-777',
    name: 'Stop & Lock 777',
    family: 'lock-reel',
    denominationCents: 100,
    maxCoins: 10,
    history: 'A player-stopped cash-collect machine: stop each reel, lock the cash, collect.',
    rows: 4,
    reels: [strip(), strip(), strip(), strip(), strip()],
    symbols: {
      CASH25: { label: '$25' },
      CASH50: { label: '$50' },
      MINI: { label: 'Mini' },
      SEVEN: { label: '7' },
      BLANK: { label: '' }
    },
    cashValues: { CASH25: 25, CASH50: 50 },
    prizes: { MINI: 100 },
    sevenSymbol: 'SEVEN',
    blankSymbol: 'BLANK',
    bonus: { respins: 3, sevenUpgrade: 1, grandOnFill: 'MINI' },
    progressive: null
  }
}

describe('lock-reel validation', () => {
  it('accepts a well-formed def', () => {
    expect(() => validateMachineDef(makeDef())).not.toThrow()
  })

  it('rejects a reel count other than 5', () => {
    const def = makeDef()
    def.reels = def.reels.slice(0, 4)
    expect(() => validateMachineDef(def)).toThrow()
  })

  it('rejects a strip shorter than rows', () => {
    const def = makeDef()
    def.reels[2] = ['CASH25', 'BLANK', 'SEVEN'] // length 3 < rows 4
    expect(() => validateMachineDef(def)).toThrow()
  })

  it('rejects a cash symbol on a strip missing from cashValues', () => {
    const def = makeDef()
    def.reels[0] = ['CASH99', 'BLANK', 'SEVEN', 'CASH50', 'MINI', 'BLANK', 'CASH25']
    def.symbols.CASH99 = { label: '$99' } // declared, but no cashValues entry
    expect(() => validateMachineDef(def)).toThrow()
  })

  it('rejects a non-positive cash value', () => {
    const def = makeDef()
    def.cashValues.CASH25 = 0
    expect(() => validateMachineDef(def)).toThrow()
  })

  it('rejects bonus.respins < 1', () => {
    const def = makeDef()
    def.bonus.respins = 0
    expect(() => validateMachineDef(def)).toThrow()
  })
})
