import type { StepperMachineDef } from '../engine/types'

/**
 * Blazing 7s archetype: 3 reels, single payline, 2-coin stepper whose top
 * award (3 flaming sevens) pays a percentage-fed PROGRESSIVE at max coins
 * (reset 2000 credits, 1.0% of coin-in feeds the meter) and 1000 at 1 coin.
 *
 * Frozen exact math (plan calibration): RTP 94.488115% per coin at 2 coins
 * with the meter at reset (long-run ~95.49% including the 1.0% feed),
 * HF 15.719307%, P(3xF7) = 27/72^3 = 1/13,824.
 */
export const SEVENS_ABLAZE: StepperMachineDef = {
  id: 'sevens-ablaze',
  name: 'Sevens Ablaze',
  family: 'stepper',
  denominationCents: 100,
  maxCoins: 2,
  symbols: {
    F7: { label: 'Flaming Seven' },
    S7: { label: 'Red Seven' },
    B3: { label: 'Triple Bar' },
    B2: { label: 'Double Bar' },
    B1: { label: 'Single Bar' },
    CH: { label: 'Cherry' },
    BL: { label: 'Blank' }
  },
  physicalStrips: [
    ['CH', 'B2', 'S7', 'BL', 'B2', 'B2', 'BL', 'B3', 'S7', 'BL', 'B3', 'F7', 'BL', 'B3', 'B1', 'BL', 'B1', 'B1', 'BL', 'B1', 'CH', 'BL'],
    ['CH', 'F7', 'S7', 'BL', 'B3', 'B1', 'BL', 'B3', 'B1', 'BL', 'B3', 'B1', 'BL', 'B2', 'B1', 'BL', 'B2', 'B2', 'BL', 'S7', 'CH', 'BL'],
    ['B1', 'B3', 'B1', 'BL', 'B3', 'B2', 'BL', 'CH', 'CH', 'BL', 'B2', 'S7', 'BL', 'B2', 'F7', 'BL', 'S7', 'B1', 'BL', 'B3', 'B1', 'BL']
  ],
  virtualMaps: [
    [0, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 8, 8, 9, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 12, 12, 13, 13, 14, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 16, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 20, 21, 21, 21, 21],
    [0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 13, 13, 13, 14, 14, 14, 15, 15, 15, 15, 15, 16, 16, 16, 17, 17, 18, 18, 18, 18, 19, 19, 19, 20, 21, 21, 21, 21],
    [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 7, 8, 9, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12, 12, 13, 13, 14, 14, 14, 15, 15, 15, 15, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 20, 20, 20, 20, 21, 21, 21, 21]
  ],
  wildSymbol: null,
  wildMultiplier: 1,
  paytable: [
    { id: '3f7', kind: 'allSame', symbol: 'F7', pay: 1000, progressiveAtMaxCoins: true },
    { id: '3s7', kind: 'allSame', symbol: 'S7', pay: 200 },
    { id: 'mix7', kind: 'anyOf', symbols: ['F7', 'S7'], pay: 50 },
    { id: '3b3', kind: 'allSame', symbol: 'B3', pay: 60 },
    { id: '3b2', kind: 'allSame', symbol: 'B2', pay: 30 },
    { id: '3b1', kind: 'allSame', symbol: 'B1', pay: 15 },
    { id: 'anybar', kind: 'anyOf', symbols: ['B1', 'B2', 'B3'], pay: 5 },
    { id: '3ch', kind: 'count', symbol: 'CH', n: 3, pay: 20 },
    { id: 'ch2', kind: 'count', symbol: 'CH', n: 2, pay: 5 },
    { id: 'ch1', kind: 'count', symbol: 'CH', n: 1, pay: 2 }
  ],
  progressive: {
    kind: 'percent',
    reset: 2000,
    max: 100_000,
    feedRate: 0.01
  },
  history: 'A Blazing 7s-style two-coin progressive stepper. One percent of every coin in feeds the meter; '
    + 'the flaming sevens only pay it on the second coin. The meter\'s break-even point — where this becomes '
    + 'a positive-EV machine — is computable, and this simulator computes it for you.'
}
