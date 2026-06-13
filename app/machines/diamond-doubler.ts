import type { StepperMachineDef } from '../engine/types'

/**
 * Double Diamond archetype: 3 reels, single payline, wild that doubles
 * (one wild 2x, two wilds 4x), weighted VIRTUAL reels over 22 physical stops
 * (Telnaes patent US 4,448,419) — 72 virtual entries per reel.
 *
 * Frozen exact math (plan calibration): RTP 94.744245% per coin
 * (= 117877/124416), HF 14.667460%, P(3xDW) = 12/72^3 = 1/31,104.
 * Pays are linear in coins (1-3): per-coin RTP identical at every coin level.
 */
export const DIAMOND_DOUBLER: StepperMachineDef = {
  id: 'diamond-doubler',
  name: 'Diamond Doubler',
  family: 'stepper',
  denominationCents: 100,
  maxCoins: 3,
  symbols: {
    DW: { label: 'Diamond Wild', icon: 'diamond' },
    S7: { label: 'Seven', icon: 'seven' },
    B3: { label: 'Triple Bar', icon: 'bar3' },
    B2: { label: 'Double Bar', icon: 'bar2' },
    B1: { label: 'Single Bar', icon: 'bar1' },
    CH: { label: 'Cherry', icon: 'cherry' },
    BL: { label: 'Blank', icon: 'blank' }
  },
  physicalStrips: [
    ['DW', 'B1', 'S7', 'BL', 'B1', 'CH', 'BL', 'B3', 'B2', 'BL', 'B2', 'B3', 'BL', 'CH', 'B1', 'BL', 'B1', 'B2', 'BL', 'B3', 'S7', 'BL'],
    ['B1', 'B2', 'B2', 'BL', 'S7', 'CH', 'BL', 'B3', 'CH', 'BL', 'B2', 'B1', 'BL', 'B3', 'B1', 'BL', 'S7', 'B1', 'BL', 'DW', 'B3', 'BL'],
    ['B3', 'DW', 'B2', 'BL', 'B1', 'S7', 'BL', 'B1', 'CH', 'BL', 'B1', 'B1', 'BL', 'S7', 'B2', 'BL', 'B2', 'CH', 'BL', 'B3', 'B3', 'BL']
  ],
  virtualMaps: [
    [0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 6, 6, 6, 6, 6, 6, 7, 7, 8, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 11, 11, 12, 12, 12, 12, 12, 13, 14, 14, 14, 15, 15, 15, 15, 15, 16, 16, 16, 17, 17, 18, 18, 18, 18, 18, 19, 20, 21, 21, 21, 21, 21],
    [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 5, 6, 6, 6, 6, 6, 6, 7, 7, 8, 9, 9, 9, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 12, 13, 13, 14, 14, 14, 15, 15, 15, 15, 15, 16, 17, 17, 17, 18, 18, 18, 18, 18, 19, 19, 20, 21, 21, 21, 21, 21],
    [0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 6, 6, 6, 6, 6, 6, 7, 7, 7, 7, 8, 9, 9, 9, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 13, 14, 14, 14, 15, 15, 15, 15, 15, 16, 16, 17, 18, 18, 18, 18, 18, 19, 19, 20, 21, 21, 21, 21, 21]
  ],
  wildSymbol: 'DW',
  wildMultiplier: 2,
  paytable: [
    { id: '3dw', kind: 'allWild', pay: 1000 },
    { id: '3s7', kind: 'allSame', symbol: 'S7', pay: 80 },
    { id: '3b3', kind: 'allSame', symbol: 'B3', pay: 40 },
    { id: '3b2', kind: 'allSame', symbol: 'B2', pay: 25 },
    { id: '3b1', kind: 'allSame', symbol: 'B1', pay: 10 },
    { id: '3ch', kind: 'allSame', symbol: 'CH', pay: 10 },
    { id: 'anybar', kind: 'anyOf', symbols: ['B1', 'B2', 'B3'], pay: 5 },
    { id: 'ch2', kind: 'count', symbol: 'CH', n: 2, pay: 5 },
    { id: 'ch1', kind: 'count', symbol: 'CH', n: 1, pay: 2 }
  ],
  progressive: null,
  history: 'A classic 1990s wild-multiplier stepper in the Double Diamond mold. The reels you watch have '
    + '22 physical stops, but the RNG picks from 72 weighted virtual entries per reel — the 1984 Telnaes '
    + 'patent that made big jackpots (and engineered near-misses) possible on small reels.'
}
