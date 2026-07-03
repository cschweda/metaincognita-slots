import type { BallyEmMachineDef } from '../engine/types'

/**
 * Modeled on the Bally Model E-1203 "3 Coin Mult. — Progressive" (Manual 7050,
 * 1981): 4 reels x 25 uniform physical stops, single center payline, 1-3 coin
 * multiplier; the progressive jackpot (4 sevens) only pays at max coins.
 *
 * Frozen exact math (plan calibration): RTP 89.126400% per coin at 3 coins
 * (= 13926/15625 with meter at reset 6000); 85.030400% at 1-2 coins —
 * the 4.1-point gap IS the "always max-coin on progressives" lesson.
 * HF 14.255872% (= 55687/390625), P(4xS7) = 16/25^4 = 1/24,414.
 */
export const SERIES_E_MULTIPLIER: BallyEmMachineDef = {
  id: 'series-e-multiplier',
  name: 'Series E Multiplier',
  family: 'bally-em',
  denominationCents: 100,
  maxCoins: 3,
  topAwardEntryId: 's7x4',
  symbols: {
    S7: { label: 'Seven', icon: 'seven' },
    BAR: { label: 'Bar', icon: 'bar1' },
    BE: { label: 'Bell', icon: 'bell' },
    PL: { label: 'Plum', icon: 'plum' },
    OR: { label: 'Orange', icon: 'orange' },
    CH: { label: 'Cherry', icon: 'cherry' },
    BL: { label: 'Blank', icon: 'blank' }
  },
  stops: 25,
  strips: [
    ['OR', 'S7', 'BE', 'BE', 'OR', 'S7', 'PL', 'PL', 'BE', 'PL', 'BE', 'CH', 'BL', 'OR', 'CH', 'BL', 'PL', 'OR', 'BL', 'BAR', 'PL', 'BL', 'OR', 'CH', 'BL'],
    ['PL', 'CH', 'BE', 'OR', 'OR', 'CH', 'OR', 'OR', 'CH', 'BE', 'PL', 'BE', 'BE', 'PL', 'OR', 'S7', 'OR', 'PL', 'BL', 'S7', 'BAR', 'BL', 'PL', 'BAR', 'BL'],
    ['BAR', 'PL', 'PL', 'CH', 'S7', 'BE', 'BE', 'OR', 'OR', 'BE', 'OR', 'OR', 'CH', 'BAR', 'S7', 'PL', 'BAR', 'BE', 'BL', 'OR', 'PL', 'BL', 'CH', 'OR', 'BL'],
    ['OR', 'S7', 'OR', 'PL', 'BAR', 'S7', 'BE', 'PL', 'PL', 'PL', 'OR', 'OR', 'BAR', 'PL', 'PL', 'BL', 'BE', 'CH', 'BL', 'OR', 'BE', 'BL', 'OR', 'BE', 'BL']
  ],
  payMode: 'multiplier',
  paytable: [
    { id: 's7x4', kind: 'run', symbol: 'S7', length: 4, pay: 1000, progressive: 'maxCoins' },
    { id: 's7x3', kind: 'run', symbol: 'S7', length: 3, pay: 100 },
    { id: 'bars', kind: 'allOf', symbol: 'BAR', pay: 150 },
    { id: 'bex4', kind: 'run', symbol: 'BE', length: 4, pay: 100 },
    { id: 'bex3', kind: 'run', symbol: 'BE', length: 3, pay: 20 },
    { id: 'plx4', kind: 'run', symbol: 'PL', length: 4, pay: 60 },
    { id: 'plx3', kind: 'run', symbol: 'PL', length: 3, pay: 14 },
    { id: 'orx4', kind: 'run', symbol: 'OR', length: 4, pay: 30 },
    { id: 'orx3', kind: 'run', symbol: 'OR', length: 3, pay: 10 },
    { id: 'chx4', kind: 'run', symbol: 'CH', length: 4, pay: 20 },
    { id: 'chx3', kind: 'run', symbol: 'CH', length: 3, pay: 10 },
    { id: 'chx2', kind: 'run', symbol: 'CH', length: 2, pay: 5 },
    { id: 'chx1', kind: 'run', symbol: 'CH', length: 1, pay: 2 }
  ],
  progressive: {
    kind: 'single',
    meter: { reset: 6000, max: 25000, rate1: { coinsPer: 4, amount: 1 }, rate1Limit: 8000, rate2: { coinsPer: 8, amount: 1 } }
  },
  history: 'Replica of the Bally Model E-1203 dollar multiplier (Parts Catalog 7050, April 1981). '
    + 'Four reels of 25 uniform stops, "Play One to Three Dollars" — pays multiply with coins, '
    + 'but the progressive sevens only pay the meter on the third coin. At one coin the same '
    + 'machine returns about four points less: the cheapest lesson on this floor.'
}
