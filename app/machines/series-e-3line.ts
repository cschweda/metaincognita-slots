import type { BallyEmMachineDef } from '../engine/types'

/**
 * Modeled on the Bally Model E-1202 "3 Line Pay — Progressive" (Manual 7050,
 * 1981): 5 reels x 22 uniform physical stops, 3 paylines, dollar machine,
 * crowned by the 1989 FO-5140 Double Progressive controller. Outcomes are
 * uniform random stops — no weighting existed in this hardware; RTP emerges
 * purely from strip composition x paytable.
 *
 * Frozen exact math (plan calibration): RTP 89.035073% per line
 * (= 104285/117128 with jackpot at live-average 3000), HF 11.814445%,
 * P(5xS7) = 1/22^5 = 1/5,153,632.
 */
export const SERIES_E_3LINE: BallyEmMachineDef = {
  id: 'series-e-3line',
  name: 'Series E 3-Line',
  family: 'bally-em',
  denominationCents: 100,
  maxCoins: 3,
  topAwardEntryId: 's7x5',
  symbols: {
    S7: { label: 'Seven', icon: 'seven' },
    BAR: { label: 'Bar', icon: 'bar1' },
    BE: { label: 'Bell', icon: 'bell' },
    PL: { label: 'Plum', icon: 'plum' },
    OR: { label: 'Orange', icon: 'orange' },
    CH: { label: 'Cherry', icon: 'cherry' },
    BL: { label: 'Blank', icon: 'blank' }
  },
  stops: 22,
  strips: [
    ['BE', 'PL', 'S7', 'OR', 'BE', 'BAR', 'BE', 'OR', 'PL', 'BL', 'OR', 'OR', 'BL', 'BE', 'OR', 'BL', 'PL', 'CH', 'BL', 'PL', 'CH', 'BL'],
    ['PL', 'BE', 'BAR', 'S7', 'OR', 'PL', 'PL', 'OR', 'OR', 'BL', 'CH', 'BE', 'BL', 'BE', 'PL', 'BL', 'PL', 'OR', 'BL', 'OR', 'BE', 'BL'],
    ['PL', 'BAR', 'OR', 'S7', 'OR', 'BE', 'PL', 'PL', 'BE', 'BL', 'CH', 'BE', 'BL', 'PL', 'OR', 'BL', 'OR', 'PL', 'BL', 'BE', 'OR', 'BL'],
    ['PL', 'BE', 'PL', 'OR', 'BE', 'OR', 'PL', 'OR', 'S7', 'BL', 'PL', 'BE', 'BL', 'PL', 'CH', 'BL', 'BE', 'BAR', 'BL', 'OR', 'OR', 'BL'],
    ['OR', 'PL', 'CH', 'BE', 'CH', 'PL', 'OR', 'CH', 'OR', 'S7', 'BE', 'BE', 'OR', 'OR', 'OR', 'BL', 'PL', 'BAR', 'BL', 'BE', 'PL', 'BL']
  ],
  payMode: 'lines',
  paytable: [
    { id: 's7x5', kind: 'run', symbol: 'S7', length: 5, pay: 1, progressive: 'live' },
    { id: 's7x4', kind: 'run', symbol: 'S7', length: 4, pay: 500 },
    { id: 's7x3', kind: 'run', symbol: 'S7', length: 3, pay: 100 },
    { id: 'bars', kind: 'allOf', symbol: 'BAR', pay: 200 },
    { id: 'bex5', kind: 'run', symbol: 'BE', length: 5, pay: 250 },
    { id: 'bex4', kind: 'run', symbol: 'BE', length: 4, pay: 75 },
    { id: 'bex3', kind: 'run', symbol: 'BE', length: 3, pay: 22 },
    { id: 'plx5', kind: 'run', symbol: 'PL', length: 5, pay: 150 },
    { id: 'plx4', kind: 'run', symbol: 'PL', length: 4, pay: 40 },
    { id: 'plx3', kind: 'run', symbol: 'PL', length: 3, pay: 15 },
    { id: 'orx5', kind: 'run', symbol: 'OR', length: 5, pay: 75 },
    { id: 'orx4', kind: 'run', symbol: 'OR', length: 4, pay: 30 },
    { id: 'orx3', kind: 'run', symbol: 'OR', length: 3, pay: 12 },
    { id: 'chx5', kind: 'run', symbol: 'CH', length: 5, pay: 25 },
    { id: 'chx4', kind: 'run', symbol: 'CH', length: 4, pay: 20 },
    { id: 'chx3', kind: 'run', symbol: 'CH', length: 3, pay: 10 },
    { id: 'chx2', kind: 'run', symbol: 'CH', length: 2, pay: 5 },
    { id: 'chx1', kind: 'run', symbol: 'CH', length: 1, pay: 2 }
  ],
  progressive: {
    kind: 'dual',
    upper: { reset: 5000, max: 20000, rate1: { coinsPer: 5, amount: 1 }, rate1Limit: 9000, rate2: { coinsPer: 20, amount: 1 } },
    lower: { reset: 1000, max: 5000, rate1: { coinsPer: 20, amount: 1 }, rate1Limit: 2500, rate2: { coinsPer: 50, amount: 1 } },
    coinsPerToggle: 1
  },
  history: 'Replica of the Bally Model E-1202 dollar progressive (Parts Catalog 7050, April 1981). '
    + 'Five reels of 22 uniform mechanical stops read optically — the CPU only reads and pays, so every stop is a true 1-in-22. '
    + 'The twin jackpot meters alternate per coin played, exactly as the 1989 FO-5140 Double Progressive controller worked.'
}
