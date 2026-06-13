import { describe, it, expect } from 'vitest'
import { validateMachineDef } from '../app/engine/validate'
import type { StepperMachineDef, BallyEmMachineDef } from '../app/engine/types'

function tinyStepper(): StepperMachineDef {
  return {
    id: 'tiny', name: 'Tiny', family: 'stepper',
    denominationCents: 100, maxCoins: 1,
    symbols: { A: { label: 'A' }, BL: { label: 'blank' } },
    physicalStrips: [['A', 'BL'], ['A', 'BL'], ['A', 'BL']],
    virtualMaps: [[0, 1], [0, 1], [0, 1]],
    wildSymbol: null, wildMultiplier: 1,
    paytable: [{ id: '3a', kind: 'allSame', symbol: 'A', pay: 8 }],
    progressive: null,
    history: 'test machine'
  }
}

function tinyBally(): BallyEmMachineDef {
  return {
    id: 'tiny-b', name: 'Tiny B', family: 'bally-em',
    denominationCents: 100, maxCoins: 3,
    symbols: { A: { label: 'A' }, BL: { label: 'blank' } },
    stops: 2,
    strips: [['A', 'BL'], ['A', 'BL'], ['A', 'BL']],
    payMode: 'lines',
    paytable: [{ id: '3a', kind: 'run', symbol: 'A', length: 3, pay: 8 }],
    progressive: null,
    history: 'test machine'
  }
}

describe('validateMachineDef', () => {
  it('accepts a well-formed stepper', () => {
    expect(() => validateMachineDef(tinyStepper())).not.toThrow()
  })

  it('accepts a well-formed bally-em', () => {
    expect(() => validateMachineDef(tinyBally())).not.toThrow()
  })

  it('rejects virtual map index out of range', () => {
    const def = tinyStepper()
    def.virtualMaps[0] = [0, 99]
    expect(() => validateMachineDef(def)).toThrow(/virtual map/i)
  })

  it('rejects strips/virtualMaps reel count mismatch', () => {
    const def = tinyStepper()
    def.virtualMaps = [[0, 1], [0, 1]]
    expect(() => validateMachineDef(def)).toThrow(/reel count/i)
  })

  it('rejects paytable symbols missing from the symbol set', () => {
    const def = tinyStepper()
    def.paytable = [{ id: 'bad', kind: 'allSame', symbol: 'ZZ', pay: 5 }]
    expect(() => validateMachineDef(def)).toThrow(/unknown symbol/i)
  })

  it('rejects strip symbols missing from the symbol set', () => {
    const def = tinyBally()
    def.strips[0] = ['A', 'ZZ']
    expect(() => validateMachineDef(def)).toThrow(/unknown symbol/i)
  })

  it('rejects bally strip length mismatch with stops', () => {
    const def = tinyBally()
    def.strips[0] = ['A', 'BL', 'A']
    expect(() => validateMachineDef(def)).toThrow(/stops/i)
  })

  it('rejects allWild entry when machine has no wild', () => {
    const def = tinyStepper()
    def.paytable = [{ id: 'aw', kind: 'allWild', pay: 100 }]
    expect(() => validateMachineDef(def)).toThrow(/wild/i)
  })

  it('rejects anyOf entries listing the wild symbol (would double-apply the wild)', () => {
    const def = tinyStepper()
    def.symbols = { A: { label: 'A' }, W: { label: 'wild' }, BL: { label: 'blank' } }
    def.wildSymbol = 'W'
    def.paytable = [{ id: 'any', kind: 'anyOf', symbols: ['A', 'W'], pay: 5 }]
    expect(() => validateMachineDef(def)).toThrow(/anyOf/i)
  })

  it('rejects count entries targeting the wild symbol', () => {
    const def = tinyStepper()
    def.symbols = { A: { label: 'A' }, W: { label: 'wild' }, BL: { label: 'blank' } }
    def.wildSymbol = 'W'
    def.paytable = [{ id: 'cw', kind: 'count', symbol: 'W', n: 1, pay: 2 }]
    expect(() => validateMachineDef(def)).toThrow(/count/i)
  })

  it('rejects nonpositive pays', () => {
    const def = tinyStepper()
    def.paytable = [{ id: '3a', kind: 'allSame', symbol: 'A', pay: 0 }]
    expect(() => validateMachineDef(def)).toThrow(/pay/i)
  })

  it('rejects lines machines with maxCoins above the 3 supported paylines', () => {
    const def = tinyBally()
    def.maxCoins = 4
    expect(() => validateMachineDef(def)).toThrow(/lines/i)
  })

  it('rejects progressive \'live\' awards without a dual progressive config', () => {
    const def = tinyBally()
    def.paytable = [{ id: 'jp', kind: 'run', symbol: 'A', length: 3, pay: 1, progressive: 'live' }]
    expect(() => validateMachineDef(def)).toThrow(/dual/i)
  })

  it('rejects progressive \'maxCoins\' awards without a single progressive config', () => {
    const def = tinyBally()
    def.paytable = [{ id: 'jp', kind: 'run', symbol: 'A', length: 3, pay: 1000, progressive: 'maxCoins' }]
    expect(() => validateMachineDef(def)).toThrow(/single/i)
  })

  it('rejects progressiveAtMaxCoins awards without a percent progressive config', () => {
    const def = tinyStepper()
    def.paytable = [{ id: 'jp', kind: 'allSame', symbol: 'A', pay: 1000, progressiveAtMaxCoins: true }]
    expect(() => validateMachineDef(def)).toThrow(/percent/i)
  })
})
