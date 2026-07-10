import type { WheelMachineDef } from '../engine/types'

/**
 * The Wheel-of-Fortune archetype (IGT, 1996 — the most profitable slot machine
 * ever built): a modern-gaudy 3-reel Telnaes stepper whose reel-3 WHEEL symbol,
 * AT MAX COINS ONLY, arms a free spin of the 24-wedge topper. Wedges are drawn
 * equal-sized and weighted unequal — the visual share is 1/24 (4.17%) each,
 * the true odds are weight/1164 — and every weight is published in the X-ray
 * and PAR sheet. Wedge values are FIXED credits (the classic contract: the bet
 * gates the wheel, it does not scale it).
 *
 * Frozen exact math (calibration 2026-07-10, scripts/verify-floor + tests):
 * RTP 92.4880% per coin AT MAX COINS (wheel term 21.9609%), 70.5271% at 1-2
 * coins — the per-coin cliff the PAR ladder prints out loud. HF 18.599% at max
 * (line pays + arms), P(arm) = 1/96 per spin, E[wedge] = 63.25 credits,
 * MEGA 2,500 wedge = 1 in 55,872 spins. Variance/coin 38.05 at max.
 */
export const WONDER_WHEEL: WheelMachineDef = {
  id: 'wonder-wheel',
  name: 'Wonder Wheel',
  family: 'wheel',
  denominationCents: 25,
  maxCoins: 3,
  topAwardEntryId: 'wedge-2500',
  symbols: {
    W7: { label: 'Neon Seven', icon: 'seven-neon' },
    ST: { label: 'Shooting Star', icon: 'star-shoot' },
    B3: { label: 'Triple Neon Bar', icon: 'bar3' },
    B2: { label: 'Double Neon Bar', icon: 'bar2' },
    B1: { label: 'Single Neon Bar', icon: 'bar1' },
    CH: { label: 'Cherry Bomb', icon: 'cherry' },
    WH: { label: 'WHEEL', icon: 'wheel' },
    BL: { label: 'Blank', icon: 'blank' }
  },
  history: 'In 1996 IGT bolted a physical prize wheel on top of a slant-top slot, licensed a game-show brand, and created the most profitable slot machine in history — floor managers learned to place them where the WHEEL! chant would carry. The topper wheel became the defining sound of the late-90s floor and never left; every modern video cabinet with a spin-the-wheel bonus is this machine\'s descendant. This build keeps the era-authentic contract: the wheel arms only at max coins (the original\'s quietest trick), the wedges pay fixed credits, and — unlike any real cabinet — the wedge weights behind the equal-looking slices are printed on the glass.',
  physicalStrips: [
    ['CH', 'B1', 'ST', 'BL', 'B2', 'B1', 'BL', 'B3', 'W7', 'BL', 'B2', 'B1', 'BL', 'ST', 'B3', 'BL', 'B1', 'B2', 'BL', 'CH', 'B3', 'BL'],
    ['B1', 'CH', 'B3', 'BL', 'B1', 'ST', 'BL', 'B2', 'B1', 'BL', 'W7', 'B2', 'BL', 'B3', 'B1', 'BL', 'B2', 'ST', 'BL', 'B1', 'CH', 'BL'],
    ['B2', 'B1', 'ST', 'BL', 'B3', 'B1', 'BL', 'CH', 'B2', 'BL', 'B1', 'W7', 'BL', 'B2', 'B1', 'BL', 'WH', 'B3', 'BL', 'B1', 'ST', 'BL']
  ],
  virtualMaps: [
    [0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9, 9, 10, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15, 15, 16, 16, 16, 17, 17, 18, 18, 18, 18, 18, 19, 19, 20, 20, 21, 21, 21, 21, 21],
    [0, 0, 0, 1, 1, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 6, 6, 6, 7, 7, 7, 8, 8, 9, 9, 9, 9, 9, 10, 10, 11, 11, 11, 12, 12, 12, 12, 12, 13, 13, 13, 14, 14, 15, 15, 15, 15, 15, 16, 16, 17, 17, 18, 18, 18, 18, 18, 19, 19, 20, 20, 21, 21, 21, 21, 21],
    [0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 7, 7, 7, 8, 8, 8, 9, 9, 9, 9, 9, 9, 9, 9, 10, 10, 10, 11, 11, 12, 12, 12, 12, 12, 12, 12, 12, 13, 13, 13, 14, 14, 14, 15, 15, 15, 15, 15, 15, 15, 15, 16, 17, 17, 17, 18, 18, 18, 18, 18, 18, 18, 18, 19, 19, 20, 20, 21, 21, 21, 21, 21, 21, 21, 21]
  ],
  wildSymbol: null,
  wildMultiplier: 1,
  paytable: [
    { id: '3w7', kind: 'allSame', symbol: 'W7', pay: 500 },
    { id: '3st', kind: 'allSame', symbol: 'ST', pay: 200 },
    { id: '3b3', kind: 'allSame', symbol: 'B3', pay: 80 },
    { id: '3b2', kind: 'allSame', symbol: 'B2', pay: 50 },
    { id: '3b1', kind: 'allSame', symbol: 'B1', pay: 25 },
    { id: 'anybar', kind: 'anyOf', symbols: ['B3', 'B2', 'B1'], pay: 5 },
    { id: 'ch2', kind: 'count', symbol: 'CH', n: 2, pay: 6 },
    { id: 'ch1', kind: 'count', symbol: 'CH', n: 1, pay: 2 }
  ],
  wheelSymbol: 'WH',
  wedges: [
    { credits: 2500, weight: 2 },
    { credits: 1000, weight: 1 },
    { credits: 500, weight: 2 },
    { credits: 400, weight: 3 },
    { credits: 300, weight: 4 },
    { credits: 250, weight: 6 },
    { credits: 200, weight: 8 },
    { credits: 150, weight: 12 },
    { credits: 120, weight: 16 },
    { credits: 110, weight: 20 },
    { credits: 100, weight: 26 },
    { credits: 90, weight: 34 },
    { credits: 80, weight: 44 },
    { credits: 75, weight: 52 },
    { credits: 70, weight: 62 },
    { credits: 65, weight: 72 },
    { credits: 60, weight: 82 },
    { credits: 55, weight: 88 },
    { credits: 50, weight: 96 },
    { credits: 45, weight: 100 },
    { credits: 40, weight: 104 },
    { credits: 35, weight: 108 },
    { credits: 30, weight: 110 },
    { credits: 25, weight: 112 }
  ],
  progressive: null
}
