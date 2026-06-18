import type { BlackjackReelMachineDef } from '../engine/types'

/**
 * Flameout 21 — blackjack-meets-crash (the `blackjack-reel` engine family).
 *
 * Five reels, stopped left-to-right. Reels 1–2 deal two cards and set the
 * LAUNCH multiplier + the climb VELOCITY by your hand (closer to 21 = higher
 * launch and steeper climb; a 2-card natural launches to a special multiplier).
 * Reels 3–5 each CLIMB (multiplier ×= velocity) or CRASH (lose it all), with the
 * crash share escalating 20% → 33% → 43%. Cash out any reel to bank bet ×
 * multiplier; survive all five to top out. Decoupled from any bustable total —
 * the only thing that ends a run is a CRASH.
 *
 * Cent-denominated: denomination $1 (100¢), bet 1–20 coins; payout (credits) =
 * ante × multiplier (fractional), rounded to whole cents when banked.
 *
 * Calibrated to ~97% RTP (the Aviator standard) under optimal cash/climb play.
 * Because reels 1–2 never crash, a player can always cash the launch risk-free,
 * so RTP ≥ E[launch]; the launch table therefore averages below ×1.0 (profit
 * comes from the climb). Frozen figures: see tests/machines-blackjack.test.ts.
 */
export const FLAMEOUT_21: BlackjackReelMachineDef = {
  id: 'flameout-21',
  name: 'Flameout 21',
  family: 'blackjack-reel',
  denominationCents: 100,
  maxCoins: 20,
  history: 'A modern crash game wearing a blackjack coat. The first two reels '
    + 'deal a two-card hand that sets how high you launch and how steep you '
    + 'climb; each reel after multiplies your win — until one of them blows up. '
    + 'Cash out before the crash, or ride a hot hand all the way and top out. '
    + 'The casino genre it apes (Aviator-style crash) is the most transparent '
    + 'on the floor: a published ~97% and a single, honest question every reel — '
    + 'bank it, or push your luck.',
  symbols: {
    CLIMB: { label: 'Climb', icon: 'climb' },
    CRASH: { label: 'Crash', icon: 'crash' }
  },
  reels: [
    // Reels 1–2 — the deal (pure cards; validator-enforced all 'CARD')
    ['CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD'],
    ['CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD'],
    // Reel 3 — climb, ~20% crash (4 CLIMB + 1 CRASH)
    ['CLIMB', 'CLIMB', 'CLIMB', 'CLIMB', 'CRASH'],
    // Reel 4 — climb, ~33% crash (4 CLIMB + 2 CRASH)
    ['CLIMB', 'CLIMB', 'CLIMB', 'CLIMB', 'CRASH', 'CRASH'],
    // Reel 5 — climb, ~43% crash (4 CLIMB + 3 CRASH)
    ['CLIMB', 'CLIMB', 'CLIMB', 'CLIMB', 'CRASH', 'CRASH', 'CRASH']
  ],
  climbSymbol: 'CLIMB',
  crashSymbol: 'CRASH',
  // Calibrated values (scripts/calibrate-flameout21.ts, sL=0.36 / sV=0.70 / nat=2.0):
  // RTP 96.959%, crash 15.3%, hit 84.7%, var 2.259 — nearest to the 97% target.
  launchTable: [
    { atLeast: 20, mult: 1.15 },
    { atLeast: 18, mult: 0.97 },
    { atLeast: 16, mult: 0.83 },
    { atLeast: 14, mult: 0.72 },
    { atLeast: 12, mult: 0.65 },
    { atLeast: 10, mult: 0.58 },
    { atLeast: 0, mult: 0.5 }
  ],
  velocityTable: [
    { atLeast: 21, mult: 1.82 },
    { atLeast: 20, mult: 1.61 },
    { atLeast: 19, mult: 1.47 },
    { atLeast: 18, mult: 1.4 },
    { atLeast: 17, mult: 1.33 },
    { atLeast: 15, mult: 1.26 },
    { atLeast: 13, mult: 1.19 },
    { atLeast: 0, mult: 1.12 }
  ],
  naturalLaunch: 2.0,
  progressive: null
}
