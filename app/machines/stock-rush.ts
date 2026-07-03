import type { PachisloMachineDef } from '../engine/types'

/**
 * 4th-generation pachislo archetype with a stock system (Pachislo How-To
 * Manual, 2006). The lottery — not the reels — decides every game; drawn
 * flags queue ("stock") and are NEVER lost: control slips reels up to 4 stops
 * to land the front flag when the player's timing allows, and provably avoids
 * every win when no flag is pending. Player timing moves wins around in time;
 * the six operator odds levels move the RTP: L1 66.0012% .. L6 120.0028%,
 * every level inside the manual's published band (p.11).
 *
 * Bonuses (manual 3.1): REG = 15 tokens + 8 guaranteed 15-token JAC wins;
 * BIG = 15 + 3 rounds of 8 JAC wins with 2 increased-odds interludes between
 * rounds (each ends on a free game or 5 bells) — E[BIG] = 34595/81 = 427.1
 * tokens, ceiling 525 = the manual's "up to 35 payouts (500 tokens)".
 */
export const STOCK_RUSH: PachisloMachineDef = {
  id: 'stock-rush',
  name: 'Stock Rush',
  family: 'pachislo',
  denominationCents: 25,
  maxCoins: 3,
  topAwardEntryId: 'big',
  symbols: {
    R7: { label: 'Red Seven', icon: 'seven-red' },
    BB: { label: 'Bonus Bar', icon: 'bar-bonus' },
    BE: { label: 'Bell', icon: 'bell' },
    RP: { label: 'Replay', icon: 'replay' },
    WM: { label: 'Watermelon', icon: 'watermelon' },
    CH: { label: 'Cherry', icon: 'cherry' },
    BL: { label: 'Blank', icon: 'blank' }
  },
  strips: [
    ['CH', 'WM', 'RP', 'BE', 'WM', 'BL', 'BL', 'CH', 'RP', 'R7', 'BE', 'WM', 'BE', 'RP', 'CH', 'BL', 'RP', 'BE', 'BE', 'R7', 'RP'],
    ['BB', 'R7', 'RP', 'BB', 'RP', 'WM', 'BL', 'BE', 'RP', 'WM', 'BE', 'RP', 'BE', 'BL', 'WM', 'R7', 'R7', 'BE', 'BL', 'RP', 'BE'],
    ['RP', 'BB', 'BE', 'WM', 'BE', 'RP', 'RP', 'RP', 'BB', 'BB', 'WM', 'BE', 'BL', 'RP', 'WM', 'BB', 'BE', 'R7', 'BE', 'R7', 'R7']
  ],
  slip: 4,
  roles: {
    cherry: 'CH',
    watermelon: 'WM',
    bell: 'BE',
    replay: 'RP',
    seven: 'R7',
    bar: 'BB',
    blank: 'BL'
  },
  baseRates: { cherryPerRow: 167, watermelon: 256, replay: 2245 },
  oddsLevels: [
    { bell: 86, reg: 33, big: 46 },
    { bell: 212, reg: 36, big: 48 },
    { bell: 303, reg: 40, big: 51 },
    { bell: 371, reg: 47, big: 59 },
    { bell: 551, reg: 55, big: 66 },
    { bell: 670, reg: 66, big: 74 }
  ],
  defaultOddsLevel: 4,
  pays: { cherryPerLine: 2, watermelon: 8, bell: 15, bonusLined: 15 },
  jac: { perRound: 8, pay: 15, cost: 1 },
  bigRounds: 3,
  interlude: { bellWeight: 8, endWeight: 4, weightDenom: 16, bellPay: 15, maxBells: 5, cost: 1 },
  progressive: null,
  history: 'A Japanese parlor skill-stop machine of the stock era. You stop the reels yourself — '
    + 'but a lottery decided the game before they spun. Flagged wins slip onto the line when your '
    + 'timing allows; missed flags stock and come back; unflagged reels provably cannot pay. The '
    + 'operator key switches six odds levels straight from the service manual: 66% robbery up to a '
    + '120% loss-leader. Your fingers control WHEN — never HOW MUCH. Like all stock-era machines, '
    + 'the full 3-token bet is required: bonus flags are gated by max bet, which is why parlor '
    + 'practice never plays short.'
}
