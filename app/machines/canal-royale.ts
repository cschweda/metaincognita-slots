import type { VideoMachineDef } from '../engine/types'
import { LINES25 } from '../engine/videoAwards'

/**
 * The bread-and-butter Venetian-floor archetype: 5x3 video, 25 selectable
 * lines, wilds on reels 2-4, gondola scatters on reels 1/2/4/5, 3+ scatters
 * = 10 free spins at x2.
 *
 * Frozen exact math (plan calibration over the full 24^5 cycle):
 * RTP 92.455942% per coin at ANY line count (= 628217093/679477248),
 * HF@25 55.534306%, variancePerCoin 8.792463 (medium volatility),
 * P(free spins) = 29/4096 = 1/141.2, P(5xLI on a line) = 1/31,104.
 */
export const CANAL_ROYALE: VideoMachineDef = {
  id: 'canal-royale',
  name: 'Canal Royale',
  family: 'video',
  denominationCents: 1,
  maxCoins: 25,
  symbols: {
    LI: { label: 'Winged Lion' },
    MA: { label: 'Carnival Mask' },
    FA: { label: 'Golden Fan' },
    AA: { label: 'Ace' },
    KK: { label: 'King' },
    QQ: { label: 'Queen' },
    JJ: { label: 'Jack' },
    TT: { label: 'Ten' },
    WD: { label: 'Wild Doge' },
    SC: { label: 'Gondola Scatter' }
  },
  strips: [
    ['JJ', 'TT', 'AA', 'KK', 'SC', 'QQ', 'FA', 'JJ', 'TT', 'LI', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'TT', 'KK', 'QQ', 'LI', 'MA'],
    ['WD', 'AA', 'JJ', 'KK', 'SC', 'QQ', 'TT', 'FA', 'LI', 'AA', 'JJ', 'KK', 'WD', 'QQ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'LI', 'MA'],
    ['WD', 'JJ', 'AA', 'KK', 'QQ', 'TT', 'FA', 'JJ', 'LI', 'AA', 'KK', 'QQ', 'WD', 'JJ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'LI', 'MA'],
    ['WD', 'AA', 'JJ', 'KK', 'SC', 'QQ', 'TT', 'FA', 'LI', 'AA', 'JJ', 'KK', 'WD', 'QQ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'KK', 'QQ', 'TT', 'LI', 'MA'],
    ['JJ', 'TT', 'AA', 'KK', 'SC', 'QQ', 'FA', 'JJ', 'TT', 'LI', 'AA', 'KK', 'QQ', 'JJ', 'TT', 'MA', 'FA', 'AA', 'JJ', 'TT', 'KK', 'QQ', 'LI', 'MA']
  ],
  betMode: { kind: 'lines', lines: LINES25 },
  fixedBet: false,
  wildSymbol: 'WD',
  scatter: { symbol: 'SC', pays: { 3: 2, 4: 20 }, triggerCount: 3 },
  freeSpins: { count: 10, multiplier: 2, retrigger: false },
  holdAndSpin: null,
  paytable: [
    { id: 'li3', symbol: 'LI', length: 3, pay: 50 },
    { id: 'li4', symbol: 'LI', length: 4, pay: 250 },
    { id: 'li5', symbol: 'LI', length: 5, pay: 1000 },
    { id: 'ma3', symbol: 'MA', length: 3, pay: 30 },
    { id: 'ma4', symbol: 'MA', length: 4, pay: 120 },
    { id: 'ma5', symbol: 'MA', length: 5, pay: 400 },
    { id: 'fa3', symbol: 'FA', length: 3, pay: 20 },
    { id: 'fa4', symbol: 'FA', length: 4, pay: 75 },
    { id: 'fa5', symbol: 'FA', length: 5, pay: 250 },
    { id: 'aa3', symbol: 'AA', length: 3, pay: 12 },
    { id: 'aa4', symbol: 'AA', length: 4, pay: 40 },
    { id: 'aa5', symbol: 'AA', length: 5, pay: 150 },
    { id: 'kk3', symbol: 'KK', length: 3, pay: 10 },
    { id: 'kk4', symbol: 'KK', length: 4, pay: 30 },
    { id: 'kk5', symbol: 'KK', length: 5, pay: 100 },
    { id: 'qq3', symbol: 'QQ', length: 3, pay: 8 },
    { id: 'qq4', symbol: 'QQ', length: 4, pay: 24 },
    { id: 'qq5', symbol: 'QQ', length: 5, pay: 80 },
    { id: 'jj3', symbol: 'JJ', length: 3, pay: 5 },
    { id: 'jj4', symbol: 'JJ', length: 4, pay: 15 },
    { id: 'jj5', symbol: 'JJ', length: 5, pay: 50 },
    { id: 'tt3', symbol: 'TT', length: 3, pay: 4 },
    { id: 'tt4', symbol: 'TT', length: 4, pay: 12 },
    { id: 'tt5', symbol: 'TT', length: 5, pay: 38 }
  ],
  progressive: null,
  history: 'The 25-line video slot is the bread and butter of every modern floor — this one wears '
    + 'Venetian colors. Lines pay left to right anchored on reel 1, wilds substitute on reels 2-4, '
    + 'and three gondolas start ten free spins at double pay. Its strips are 24 cells so the FULL '
    + 'cycle — all 7,962,624 reel states — is enumerated exactly for the PAR sheet; nothing here is '
    + 'sampled or approximated.'
}
