import type { VideoMachineDef } from '../engine/types'
import { LINES25 } from '../engine/videoAwards'

const R1 = ['RU', 'RU', 'AA', 'JJ', 'KK', 'QQ', 'CR', 'JJ', 'AA', 'QQ', 'KK', 'CH', 'GA', 'AA', 'JJ', 'KK', 'QQ', 'CR', 'AA', 'KK', 'JJ', 'CH', 'QQ', 'GA']
const R2 = ['RU', 'RU', 'AA', 'JJ', 'QQ', 'KK', 'CR', 'RU', 'AA', 'JJ', 'QQ', 'CH', 'KK', 'AA', 'JJ', 'QQ', 'GA', 'CR', 'KK', 'AA', 'JJ', 'QQ', 'CH', 'GA']

/**
 * Hold-and-spin jewel machine (Dragon Link lineage): a lean 25-line base game
 * funds a ruby lock-and-collect feature; 6+ rubies lock and start 3 respins,
 * every new gem resets the counter, filling all 15 perches pays the percent-fed
 * Grand. Signature twist: the Gargoyle's Eye multiplier gem — ×2/×3 faces ADD
 * and scale the collected ruby credits at collect; the Grand pays clean.
 *
 * Frozen exact math: see tests/machines-video.test.ts (calibrated to the
 * ~90% RTP / high-volatility band, verified by exactRtp + pnpm verify).
 */
export const RUBY_OF_GARGOYLE: VideoMachineDef = {
  id: 'ruby-of-gargoyle',
  name: 'Ruby of Gargoyle',
  family: 'video',
  denominationCents: 1,
  maxCoins: 25,
  topAwardEntryId: 'grand',
  symbols: {
    GA: { label: 'Gargoyle', icon: 'gargoyle' },
    CH: { label: 'Chalice', icon: 'chalice' },
    CR: { label: 'Crown', icon: 'crown' },
    AA: { label: 'Ace', icon: 'ace' },
    KK: { label: 'King', icon: 'king' },
    QQ: { label: 'Queen', icon: 'queen' },
    JJ: { label: 'Jack', icon: 'jack' },
    RU: { label: 'Ruby', icon: 'ruby' },
    EM: { label: 'Empty', icon: 'blank' }
  },
  strips: [R1, R2, R1, R2, R1],
  betMode: { kind: 'lines', lines: LINES25 },
  fixedBet: true,
  wildSymbol: null,
  scatter: null,
  freeSpins: null,
  holdAndSpin: {
    orbSymbol: 'RU',
    triggerCount: 6,
    respins: 3,
    respinOrbNumer: 2,
    respinOrbDenom: 24,
    orbValues: [
      { credits: 25, weight: 76 },
      { credits: 50, weight: 50 },
      { credits: 75, weight: 28 },
      { credits: 125, weight: 14 },
      { credits: 250, weight: 2 },
      { credits: 300, weight: 2, label: 'mini' },
      { credits: 625, weight: 1, label: 'minor' },
      { credits: 2500, weight: 1, label: 'major' },
      { mult: 2, weight: 1 },
      { mult: 3, weight: 1 }
    ],
    emptySymbol: 'EM'
  },
  paytable: [
    { id: 'ga3', symbol: 'GA', length: 3, pay: 100 },
    { id: 'ga4', symbol: 'GA', length: 4, pay: 400 },
    { id: 'ga5', symbol: 'GA', length: 5, pay: 1600 },
    { id: 'ch3', symbol: 'CH', length: 3, pay: 60 },
    { id: 'ch4', symbol: 'CH', length: 4, pay: 200 },
    { id: 'ch5', symbol: 'CH', length: 5, pay: 640 },
    { id: 'cr3', symbol: 'CR', length: 3, pay: 40 },
    { id: 'cr4', symbol: 'CR', length: 4, pay: 130 },
    { id: 'cr5', symbol: 'CR', length: 5, pay: 400 },
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
  progressive: { kind: 'percent', reset: 5000, max: 50_000, feedRate: 0.01 },
  history: 'A moonlit cathedral whose gargoyles guard a hoard of gems. The '
    + 'hold-and-spin lineage that conquered floors after 2017, here with a '
    + 'twist: the Gargoyle\'s Eye gem multiplies the rubies you collect. Six '
    + 'rubies lock and grant three respins; every gem resets the count; the '
    + 'Eye gems\' faces add and scale the haul; fill all fifteen perches and '
    + 'the Grand — fed by 1% of every bet — pays in full.'
}
