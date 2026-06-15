/**
 * Hit or Bust — RETIRED in Task 1 (Lucky 21 types evolution).
 *
 * The old def body used the pre-Lucky-21 BlackjackReelMachineDef shape
 * (strips/cardValues/aceSymbol/bustSaveSymbol/charlieBonus) which no longer
 * compiles. This file is no longer imported from app/machines/index.ts.
 *
 * Lucky 21: the real machine def is added in a later task.
 */
import type { BlackjackReelMachineDef } from '../engine/types'

// Lucky 21: stub export so the file typechecks while unused; real def in a later task.
export const HIT_OR_BUST: BlackjackReelMachineDef = {
  id: 'hit-or-bust',
  name: 'Hit or Bust (retired stub)',
  family: 'blackjack-reel',
  denominationCents: 25,
  maxCoins: 3,
  history: 'Retired — Lucky 21 machine replaces this in a later task.',
  symbols: {},
  reels: [[], [], [], [], []],
  multiplierSymbols: {},
  minusSymbols: {},
  bustSymbol: 'BUST',
  paytable: [],
  qualifyMin: 15,
  naturalPay: 3,
  charlieMultiplier: 3,
  progressive: null
}
