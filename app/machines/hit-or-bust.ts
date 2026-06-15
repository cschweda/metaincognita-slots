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
 * Deal reels (0–1): 20 stops each — 30% ten-value cards (C10/CJ/CQ/CK),
 *   5% aces, 55% low cards (C2–C9), 5% special (MX2 or SAVE).
 *   More lows than the original design pushes deal totals lower, creating
 *   more situations where the player must hit toward 18+.
 * Hit reels (2–4): tensions escalate rapidly — reel 2 is 77% tens (17/22),
 *   reel 3 is 71% (15/21), reel 4 is 80% (20/25). MX3 appears only on hit
 *   reels. SAVE is present on every reel at one-in-twenty or rarer odds.
 *
 * ── Calibration (2026-06-14) ────────────────────────────────────────────────
 * Paytable: 18→1, 19→1, 20→1, 21→2 (all integers — no fractional credits)
 * charlieBonus: 1 (integer) — added ON TOP of pay(total) when all five cards
 *   survive. Effective Five-Card Charlie payouts:
 *   total-18/19/20 → 1+1 = 2 per coin;  total-21 → 2+1 = 3 per coin
 *   (both scaled by max(1, multiplierSum) if any ×N cards were held).
 * Integer invariant: pay × max(1,multSum) × coins is always a whole number
 *   of credits since all three factors are integers.
 *
 * Frozen exact-math figures (blackjackReelExactRtp, optimal stopping):
 *   rtpPerCoin      = 0.8999774891774895  (≈ 90.00%)
 *   hitFrequency    = 0.5022662337662339  (≈ 50.23%)
 *   variancePerCoin = 2.18608640641967
 *   bustRate        = 0.497733766233766   (≈ 49.77%)
 *   charlieRate     = 0.11606493506493502 (≈ 11.61%)
 *
 * EV breakdown (per-coin contribution):
 *   charlie  11.61% hands → ~41.6% of EV (high-value survival payoff)
 *   total-20 17.11% hands → ~23.3% of EV
 *   total-21  6.07% hands → ~15.8% of EV (pays 2×, worth the extra risk)
 *   total-18  8.01% hands → ~10.0% of EV
 *   total-19  7.43% hands →  ~9.3% of EV
 *   bust     49.77% hands →   0% (loss)
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
    C2: { label: '2', icon: 'pip-2' },
    C3: { label: '3', icon: 'pip-3' },
    C4: { label: '4', icon: 'pip-4' },
    C5: { label: '5', icon: 'pip-5' },
    C6: { label: '6', icon: 'pip-6' },
    C7: { label: '7', icon: 'pip-7' },
    C8: { label: '8', icon: 'pip-8' },
    C9: { label: '9', icon: 'pip-9' },
    C10: { label: '10', icon: 'ten' },
    CJ: { label: 'Jack', icon: 'jack' },
    CQ: { label: 'Queen', icon: 'queen' },
    CK: { label: 'King', icon: 'king' },
    CA: { label: 'Ace', icon: 'ace' },
    MX2: { label: '×2', icon: 'mult-x2' },
    MX3: { label: '×3', icon: 'mult-x3' },
    SAVE: { label: 'Bust Save', icon: 'bust-save' }
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
   * All values are positive integers — no fractional credits possible.
   * 18, 19, 20 all pay 1 credit per coin (hold what you have);
   * 21 pays 2 credits per coin (the premium total, worth chasing).
   */
  paytable: [
    { total: 18, pay: 1 },
    { total: 19, pay: 1 },
    { total: 20, pay: 1 },
    { total: 21, pay: 2 }
  ],

  /**
   * Five-Card Charlie bonus added ON TOP of pay(total).
   * charlieBonus = 1 (integer). Effective Charlie payouts per coin:
   *   total-18/19/20 → 1 + 1 = 2   total-21 → 2 + 1 = 3
   * Both scaled by max(1, multiplierSum) if any ×N cards were held.
   */
  charlieBonus: 1,

  progressive: null,

  strips: [
    // ── Reel 0 — deal card 1 ─────────────────────────────────────────────
    // 20 stops: 6 ten-value (30%), 1 ace (5%), 11 low (55%), 1 MX2, 1 SAVE
    // More lows than the original design: many deals produce low starting
    // totals (4–16) that require hitting into the ten-heavy hit reels.
    [
      'C10', 'C10', 'CJ', 'CJ', 'CQ', 'CK',
      'CA',
      'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C2', 'C3', 'C4',
      'MX2', 'SAVE'
    ],

    // ── Reel 1 — deal card 2 ─────────────────────────────────────────────
    // Identical to reel 0: both deal cards come from the same deck model.
    [
      'C10', 'C10', 'CJ', 'CJ', 'CQ', 'CK',
      'CA',
      'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C2', 'C3', 'C4',
      'MX2', 'SAVE'
    ],

    // ── Reel 2 — first hit ───────────────────────────────────────────────
    // 22 stops: 17 ten-value (77%), 1 ace, 1 low, MX2 + MX3 + SAVE
    // The first voluntary hit is extremely risky — nearly 4-in-5 chance of
    // drawing a ten. Low-total hands must hit here and frequently bust.
    [
      'C10', 'C10', 'C10', 'C10', 'C10',
      'CJ', 'CJ', 'CJ', 'CJ',
      'CQ', 'CQ', 'CQ', 'CQ',
      'CK', 'CK', 'CK', 'CK',
      'CA',
      'C2',
      'MX2', 'MX3', 'SAVE'
    ],

    // ── Reel 3 — second hit ──────────────────────────────────────────────
    // 21 stops: 15 ten-value (71%), 1 ace, 2 lows, MX2 + MX3 + SAVE
    // Still very dangerous; survivors of reel 2 face continued bust pressure.
    [
      'C10', 'C10', 'C10', 'C10',
      'CJ', 'CJ', 'CJ', 'CJ',
      'CQ', 'CQ', 'CQ', 'CQ',
      'CK', 'CK', 'CK',
      'CA',
      'C2', 'C3',
      'MX2', 'MX3', 'SAVE'
    ],

    // ── Reel 4 — Five-Card Charlie reel ─────────────────────────────────
    // 25 stops: 20 ten-value (80%), 2 aces, 0 lows, MX2 + MX3 + SAVE
    // Heaviest tens in the set — an 80% bust probability per draw makes
    // the Five-Card Charlie very rare and correspondingly rewarded.
    [
      'C10', 'C10', 'C10', 'C10', 'C10',
      'CJ', 'CJ', 'CJ', 'CJ', 'CJ',
      'CQ', 'CQ', 'CQ', 'CQ', 'CQ',
      'CK', 'CK', 'CK', 'CK', 'CK',
      'CA', 'CA',
      'MX2', 'MX3', 'SAVE'
    ]
  ]
}
