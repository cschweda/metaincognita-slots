import type { VideoMachineDef } from '../engine/types'
import { LINES25 } from '../engine/videoAwards'

/**
 * Hold-and-spin archetype (Lightning Link lineage, 2017): lean 25-line base
 * game plus orb symbols carrying credit values; 6+ orbs lock and start 3
 * respins over the 15-cell grid; every new orb resets the counter; filling
 * all 15 pays the percentage-fed Grand progressive.
 *
 * Frozen exact math (plan calibration): RTP 90.294753% per coin at grand
 * reset 5000, HF 41.289906%, variancePerCoin 29.259962 (high volatility),
 * P(trigger) = 449/55296 = 1/123.2, Grand ~ 1/5,138 spins.
 */
export const THUNDER_VAULT: VideoMachineDef = {
  id: 'thunder-vault',
  name: 'Thunder Vault',
  family: 'video',
  denominationCents: 1,
  maxCoins: 25,
  symbols: {
    VA: { label: 'Vault' },
    LT: { label: 'Lightning' },
    GB: { label: 'Gold Bar' },
    AA: { label: 'Ace' },
    KK: { label: 'King' },
    QQ: { label: 'Queen' },
    JJ: { label: 'Jack' },
    OR: { label: 'Storm Orb' },
    EM: { label: 'Empty' }
  },
  strips: [
    ['OR', 'OR', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'JJ', 'AA', 'QQ', 'KK', 'LT', 'VA', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'AA', 'KK', 'JJ', 'LT', 'QQ', 'VA'],
    ['OR', 'OR', 'AA', 'JJ', 'QQ', 'KK', 'GB', 'OR', 'AA', 'JJ', 'QQ', 'LT', 'KK', 'AA', 'JJ', 'QQ', 'VA', 'GB', 'KK', 'AA', 'JJ', 'QQ', 'LT', 'VA'],
    ['OR', 'OR', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'JJ', 'AA', 'QQ', 'KK', 'LT', 'VA', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'AA', 'KK', 'JJ', 'LT', 'QQ', 'VA'],
    ['OR', 'OR', 'AA', 'JJ', 'QQ', 'KK', 'GB', 'OR', 'AA', 'JJ', 'QQ', 'LT', 'KK', 'AA', 'JJ', 'QQ', 'VA', 'GB', 'KK', 'AA', 'JJ', 'QQ', 'LT', 'VA'],
    ['OR', 'OR', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'JJ', 'AA', 'QQ', 'KK', 'LT', 'VA', 'AA', 'JJ', 'KK', 'QQ', 'GB', 'AA', 'KK', 'JJ', 'LT', 'QQ', 'VA']
  ],
  betMode: { kind: 'lines', lines: LINES25 },
  fixedBet: true,
  wildSymbol: null,
  scatter: null,
  freeSpins: null,
  holdAndSpin: {
    orbSymbol: 'OR',
    triggerCount: 6,
    respins: 3,
    respinOrbNumer: 2,
    respinOrbDenom: 24,
    orbValues: [
      { credits: 25, weight: 72 },
      { credits: 50, weight: 48 },
      { credits: 75, weight: 28 },
      { credits: 125, weight: 14 },
      { credits: 250, weight: 7 },
      { credits: 300, weight: 4, label: 'mini' },
      { credits: 625, weight: 2, label: 'minor' },
      { credits: 2500, weight: 1, label: 'major' }
    ],
    emptySymbol: 'EM'
  },
  paytable: [
    { id: 'va3', symbol: 'VA', length: 3, pay: 100 },
    { id: 'va4', symbol: 'VA', length: 4, pay: 400 },
    { id: 'va5', symbol: 'VA', length: 5, pay: 1600 },
    { id: 'lt3', symbol: 'LT', length: 3, pay: 60 },
    { id: 'lt4', symbol: 'LT', length: 4, pay: 200 },
    { id: 'lt5', symbol: 'LT', length: 5, pay: 640 },
    { id: 'gb3', symbol: 'GB', length: 3, pay: 40 },
    { id: 'gb4', symbol: 'GB', length: 4, pay: 130 },
    { id: 'gb5', symbol: 'GB', length: 5, pay: 400 },
    { id: 'aa3', symbol: 'AA', length: 3, pay: 24 },
    { id: 'aa4', symbol: 'AA', length: 4, pay: 80 },
    { id: 'aa5', symbol: 'AA', length: 5, pay: 240 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 20 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 65 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 190 },
    { id: 'qq3', symbol: 'QQ', length: 3, pay: 13 },
    { id: 'qq4', symbol: 'QQ', length: 4, pay: 40 },
    { id: 'qq5', symbol: 'QQ', length: 5, pay: 130 },
    { id: 'jj3', symbol: 'JJ', length: 3, pay: 10 },
    { id: 'jj4', symbol: 'JJ', length: 4, pay: 30 },
    { id: 'jj5', symbol: 'JJ', length: 5, pay: 95 }
  ],
  progressive: {
    kind: 'percent',
    reset: 5000,
    max: 50_000,
    feedRate: 0.01
  },
  history: 'The hold-and-spin mechanic conquered casino floors after 2017: a deliberately lean base '
    + 'game funds orb features where credits stick where they land. Six storm orbs lock and grant '
    + 'three respins; every new orb resets the count; fill all fifteen cells and the Grand — fed by '
    + '1% of every bet — pays in full. High volatility by design, and the math shows exactly where '
    + 'the missing base-game percentage went.'
}
