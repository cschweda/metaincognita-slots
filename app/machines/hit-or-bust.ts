import type { BlackjackReelMachineDef } from '../engine/types'

/**
 * Hit or Bust — blackjack-reel, 25¢ / 3 coins, 5 strips.
 *
 * A press-your-luck card machine in the tradition of 1960s–80s novelty reel
 * machines. Two cards are dealt from reels 1–2; the player chooses hit or stand
 * after each draw. Survive all five cards without busting → Five-Card Charlie
 * bonus. Rare ×2 / ×3 multiplier cards stack additively; the even-rarer Bust
 * Save voids one busting card in place and keeps the hand alive.
 *
 * ── Strip design ────────────────────────────────────────────────────────────
 * Deal reels (0–1): 20 stops each — 40% ten-value cards (C10/CJ/CQ/CK),
 *   10% aces, 40% low cards (C2–C9), 5% special (MX2 or SAVE).
 *   Mirrors a rough single-deck distribution; tens dominate but don't swamp.
 * Hit reels (2–4): tensions escalate — reel 2 is 45% tens, reel 3 is 52%,
 *   reel 4 (the Charlie reel) is 59%. MX3 appears only on hit reels.
 *   SAVE is present on every reel but at one-in-twenty or rarer odds.
 *
 * ── Calibration (2026-06-14) ────────────────────────────────────────────────
 * Paytable: 18→0.25, 19→0.5, 20→0.75, 21→1.25 (all exact IEEE-754 = n/4)
 * charlieBonus: 1.1875 (= 19/16, exact IEEE-754) — added ON TOP of pay(total)
 *   when all five cards survive. The effective Five-Card Charlie payout is
 *   1.4375 (18-total) … 2.4375 (21-total) × max(1, multiplierSum) per coin.
 *
 * Frozen exact-math figures (blackjackReelExactRtp, optimal stopping):
 *   rtpPerCoin      = 0.8999786778089339  (≈ 89.998%)
 *   hitFrequency    = 0.6259376229830778  (≈ 62.59%)
 *   variancePerCoin = 1.9888723336949963
 *   bustRate        = 0.37406237701692263 (≈ 37.41%)
 *   charlieRate     = 0.1553207398661945  (≈ 15.53%)
 *
 * EV breakdown (per-coin contribution):
 *   charlie  15.53% hands → ~49.0% of EV (high-value survival payoff)
 *   total-20 23.70% hands → ~20.2% of EV
 *   total-21 11.95% hands → ~16.0% of EV
 *   total-19  7.16% hands →  ~3.8% of EV
 *   total-18  4.25% hands →  ~1.1% of EV
 *   bust     37.41% hands →   0% (loss)
 */
export const HIT_OR_BUST: BlackjackReelMachineDef = {
  id: 'hit-or-bust',
  name: 'Hit or Bust',
  family: 'blackjack-reel',
  denominationCents: 25,
  maxCoins: 3,
  history: 'A press-your-luck blackjack-reel in the tradition of novelty card machines that '
    + 'appeared alongside early stepper slots in the 1960s–80s. Two cards are dealt from the '
    + 'first pair of reels; each subsequent draw lets the player choose hit or stand — risking '
    + 'a bust in pursuit of a stronger total. Reach 21 or survive all five cards for the '
    + 'Five-Card Charlie bonus. Rare multiplier cards (×2, ×3) stack additively on any payout; '
    + 'the even-rarer Bust Save voids one busting draw in place, keeping the hand alive for '
    + 'another chance.',
  symbols: {
    C2: { label: '2' },
    C3: { label: '3' },
    C4: { label: '4' },
    C5: { label: '5' },
    C6: { label: '6' },
    C7: { label: '7' },
    C8: { label: '8' },
    C9: { label: '9' },
    C10: { label: '10', icon: 'ten' },
    CJ: { label: 'Jack', icon: 'jack' },
    CQ: { label: 'Queen', icon: 'queen' },
    CK: { label: 'King', icon: 'king' },
    CA: { label: 'Ace', icon: 'ace' },
    MX2: { label: '×2' },
    MX3: { label: '×3' },
    SAVE: { label: 'Bust Save' }
  },
  cardValues: {
    C2: 2, C3: 3, C4: 4, C5: 5, C6: 6,
    C7: 7, C8: 8, C9: 9,
    C10: 10, CJ: 10, CQ: 10, CK: 10
  },
  aceSymbol: 'CA',
  multiplierSymbols: { MX2: 2, MX3: 3 },
  bustSaveSymbol: 'SAVE',

  /**
   * Per-coin payout for a resolved (non-busted, non-charlie) hand by total.
   * Values are exact IEEE-754 (multiples of 0.25). Under the casino convention
   * for a 25¢ / 3-coin machine: pay(20)=0.75 returns 75% of one coin wagered.
   */
  paytable: [
    { total: 18, pay: 0.25 },
    { total: 19, pay: 0.5 },
    { total: 20, pay: 0.75 },
    { total: 21, pay: 1.25 }
  ],

  /**
   * Five-Card Charlie bonus added ON TOP of pay(total).
   * 1.1875 = 19/16 (exact IEEE-754). Effective Charlie payouts:
   *   total-18 → 0.25 + 1.1875 = 1.4375 per coin
   *   total-21 → 1.25 + 1.1875 = 2.4375 per coin
   * Both scaled by max(1, multiplierSum) if any ×N cards were held.
   */
  charlieBonus: 1.1875,

  progressive: null,

  strips: [
    // ── Reel 0 — deal card 1 ─────────────────────────────────────────────
    // 20 stops: 8 ten-value (40%), 2 ace (10%), 8 low (40%), 2 special (10%)
    [
      'C10', 'C10', 'CJ', 'CJ', 'CQ', 'CQ', 'CK', 'CK',
      'CA', 'CA',
      'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
      'MX2', 'SAVE'
    ],

    // ── Reel 1 — deal card 2 ─────────────────────────────────────────────
    // Identical to reel 0: both deal cards come from the same deck model.
    [
      'C10', 'C10', 'CJ', 'CJ', 'CQ', 'CQ', 'CK', 'CK',
      'CA', 'CA',
      'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
      'MX2', 'SAVE'
    ],

    // ── Reel 2 — first hit ───────────────────────────────────────────────
    // 22 stops: 10 ten-value (45%), 1 ace, 8 low, 3 special (MX2, MX3, SAVE)
    // Slightly elevated tens: the first voluntary hit is already risky.
    [
      'C10', 'C10', 'C10', 'CJ', 'CJ', 'CJ', 'CQ', 'CQ', 'CK', 'CK',
      'CA',
      'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9',
      'MX2', 'MX3', 'SAVE'
    ],

    // ── Reel 3 — second hit ──────────────────────────────────────────────
    // 21 stops: 11 ten-value (52%), 1 ace, 6 low, 3 special
    // Over half the stops bust a mid-range hand; the pressure mounts.
    [
      'C10', 'C10', 'C10', 'CJ', 'CJ', 'CJ', 'CQ', 'CQ', 'CQ', 'CK', 'CK',
      'CA',
      'C2', 'C3', 'C4', 'C5', 'C6', 'C7',
      'MX2', 'MX3', 'SAVE'
    ],

    // ── Reel 4 — Five-Card Charlie reel ─────────────────────────────────
    // 22 stops: 13 ten-value (59%), 2 ace, 4 low, 3 special
    // Heaviest tens in the set — surviving to Charlie is rare and rewarded.
    [
      'C10', 'C10', 'C10', 'C10', 'CJ', 'CJ', 'CJ', 'CQ', 'CQ', 'CQ', 'CK', 'CK', 'CK',
      'CA', 'CA',
      'C2', 'C3', 'C4', 'C5',
      'MX2', 'MX3', 'SAVE'
    ]
  ]
}
