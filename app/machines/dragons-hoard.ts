import type { VideoMachineDef } from '../engine/types'

/**
 * 243-ways archetype (Reel Power lineage): any-adjacent left-to-right pays,
 * 2-cell stacked wilds on reels 2-4, scatters on reels 1/2/4/5, 8 free spins
 * with retriggers. Deliberately the loosest video machine on the floor.
 *
 * Frozen exact math (plan calibration): RTP 93.995040% per coin
 * (= 94747/100800), HF 53.553376%, variancePerCoin 10.696426,
 * retrigger q = 29/4096 -> E[total free spins] = 4096/483 = 8.4803.
 */
export const DRAGONS_HOARD: VideoMachineDef = {
  id: 'dragons-hoard',
  name: 'Dragon\'s Hoard',
  family: 'video',
  denominationCents: 1,
  maxCoins: 25,
  symbols: {
    DR: { label: 'Dragon', icon: 'dragon' },
    PH: { label: 'Phoenix', icon: 'phoenix' },
    KO: { label: 'Koi', icon: 'koi' },
    AA: { label: 'Ace', icon: 'ace' },
    KK: { label: 'King', icon: 'king' },
    QQ: { label: 'Queen', icon: 'queen' },
    JJ: { label: 'Jack', icon: 'jack' },
    TT: { label: 'Ten', icon: 'ten' },
    WD: { label: 'Pearl Wild', icon: 'pearl' },
    SC: { label: 'Gold Ingot Scatter', icon: 'ingot' }
  },
  strips: [
    ['JJ', 'TT', 'AA', 'KK', 'SC', 'QQ', 'DR', 'JJ', 'TT', 'KO', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'TT', 'KK', 'QQ', 'KO', 'PH'],
    ['WD', 'WD', 'AA', 'JJ', 'SC', 'KK', 'QQ', 'TT', 'DR', 'KO', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'KO', 'PH'],
    ['WD', 'WD', 'JJ', 'AA', 'KK', 'QQ', 'TT', 'DR', 'JJ', 'KO', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'KO', 'PH'],
    ['WD', 'WD', 'AA', 'JJ', 'SC', 'KK', 'QQ', 'TT', 'DR', 'KO', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'KO', 'PH'],
    ['JJ', 'TT', 'AA', 'KK', 'SC', 'QQ', 'DR', 'JJ', 'TT', 'KO', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'PH', 'DR', 'AA', 'JJ', 'TT', 'KK', 'QQ', 'KO', 'PH']
  ],
  betMode: { kind: 'ways' },
  fixedBet: true,
  wildSymbol: 'WD',
  scatter: { symbol: 'SC', pays: { 3: 2, 4: 10 }, triggerCount: 3 },
  freeSpins: { count: 8, multiplier: 1, retrigger: true },
  holdAndSpin: null,
  paytable: [
    { id: 'dr3', symbol: 'DR', length: 3, pay: 22 },
    { id: 'dr4', symbol: 'DR', length: 4, pay: 66 },
    { id: 'dr5', symbol: 'DR', length: 5, pay: 272 },
    { id: 'ph3', symbol: 'PH', length: 3, pay: 13 },
    { id: 'ph4', symbol: 'PH', length: 4, pay: 42 },
    { id: 'ph5', symbol: 'PH', length: 5, pay: 162 },
    { id: 'ko3', symbol: 'KO', length: 3, pay: 9 },
    { id: 'ko4', symbol: 'KO', length: 4, pay: 27 },
    { id: 'ko5', symbol: 'KO', length: 5, pay: 106 },
    { id: 'aa3', symbol: 'AA', length: 3, pay: 5 },
    { id: 'aa4', symbol: 'AA', length: 4, pay: 16 },
    { id: 'aa5', symbol: 'AA', length: 5, pay: 65 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 4 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 13 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 42 },
    { id: 'qq3', symbol: 'QQ', length: 3, pay: 3 },
    { id: 'qq4', symbol: 'QQ', length: 4, pay: 11 },
    { id: 'qq5', symbol: 'QQ', length: 5, pay: 32 },
    { id: 'jj3', symbol: 'JJ', length: 3, pay: 2 },
    { id: 'jj4', symbol: 'JJ', length: 4, pay: 9 },
    { id: 'jj5', symbol: 'JJ', length: 5, pay: 27 },
    { id: 'tt3', symbol: 'TT', length: 3, pay: 2 },
    { id: 'tt4', symbol: 'TT', length: 4, pay: 6 },
    { id: 'tt5', symbol: 'TT', length: 5, pay: 22 }
  ],
  progressive: null,
  history: 'A 243-ways game in the Reel Power lineage: no paylines — any symbol adjacent left to '
    + 'right pays, multiplied by how many of it land on each reel. Stacked pearl wilds on the middle '
    + 'reels and retriggerable free spins make it the loosest machine on this floor at 94.0% — '
    + 'machine-choosing literacy starts with reading numbers like that off the PAR sheet.'
}
