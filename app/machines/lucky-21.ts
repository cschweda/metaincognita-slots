import type { BlackjackReelMachineDef } from '../engine/types'

/**
 * Lucky 21 — blackjack-reel, 25¢ / 5 coins, 5 reels.
 *
 * A stop-the-reels card slot. Reels 1–2 deal two cards from a shuffled 52-deck;
 * the player then chooses, reel by reel, to CASH the current best total or
 * CONTINUE for a stronger one. Reels 3–5 mix returning cards with special
 * lock-in faces: additive ×N multipliers, minus-point cards, and instant-loss
 * BUST symbols. Surviving all five reels is a Five-Card Charlie (×3 the whole
 * payout). The signature is reel 5: rare ×5 / ×10 multipliers wrapped in a wall
 * of BUST — the climb to a big hand or nothing.
 *
 * ── Reel roles (counts tuned to ~90% RTP; roles preserved) ──────────────────
 * Reel 1: pure cards (deal card 1).
 * Reel 2: pure cards (deal card 2). Reels 1–2 are ALL 'CARD' (validator-enforced).
 * Reel 3: lock-in bonus, NO cards — multipliers (MX2, MX3) + a minus (MM3) over a
 *   wall of BUST (7/10). Heavy BUST here is the primary RTP dial: it gates whether
 *   the player can bank a multiplier before the card reels return.
 * Reel 4: mix — two cards return alongside a multiplier (MX3), a minus (MM3), and
 *   BUST (6/10).
 * Reel 5: the big one — ×5 / ×10 (the signature: 2×MX5 + MX10) + a wall of BUST
 *   (8/13) + two returning cards, NO minus.
 *
 * ── Payout model (RTP = E[base × max(1,multSum) × charlieMul]; the ante cancels) ─
 * The paytable pays are PER-COIN CREDITS and are deliberately SMALL — the house
 * edge (≈9.43%) comes from the high BUST + sub-qualifyMin (=0-pay) frequency under
 * optimal play, NOT from the pay magnitude. Under the exact optimal-stopping DP the
 * policy banks a qualifying two-card total at the first decision and otherwise rides
 * the BUST reels toward a multiplier-stacked Five-Card Charlie, so the paytable is
 * flat (every qualifying total pays 1) and the upside lives in the multipliers and
 * the ×3 Charlie. The dollar *feel* lives in denominationCents (25¢ × up-to-5
 * coins), NOT in the paytable magnitude.
 *
 * A climbing paytable or a richer natural premium each adds ~5% RTP here (cashes
 * at 20/21 and two-card naturals are frequent), which would require so much extra
 * BUST that reel 3 loses its multiplier faces and the Charlie becomes unreachable;
 * the flat curve (which satisfies the 21 ≥ 20 ≥ … ≥ 15 and naturalPay ≥ paytable[21]
 * constraints with equality) keeps the reel roles intact and the signature alive.
 *
 * Integer-credit invariant: handPayout = base × max(1,multSum) × charlieMultiplier
 *   × ante is always a WHOLE number of credits because every paytable[].pay,
 *   naturalPay, and charlieMultiplier is a positive integer (and ante, multSum are
 *   integers). Verified: 0 fractional payouts over 2M optimal-policy hands with
 *   varying ante; the per-coin payout set is {0, 1, 3, 6, 9, 15, 18, 21, 24, 30, …, 48}.
 *
 * ── Calibration (2026-06-15, blackjackReelExactRtp, optimal stopping) ────────
 * Paytable (per-coin): every total 15..21 pays 1.  naturalPay = 1.
 * charlieMultiplier = 3 (Five-Card Charlie scales the whole payout).
 *
 * Frozen exact-math figures (see tests/machines-lucky21.test.ts):
 *   rtpPerCoin      = 0.9056816544369226   (≈ 90.57%)
 *   hitFrequency    = 0.5285228202523613   (≈ 52.85%)
 *   variancePerCoin = 10.685766343483504   (high-volatility, Charlie-driven)
 *   bustRate        = 0.47147717974763875  (≈ 47.15%)  [P(bust terminal)]
 *   charlieRate     = 0.018718898683733852 (≈  1.87%)  [P(Five-Card Charlie)]
 *
 * EV breakdown (per-coin contribution): the 1.87% Charlie hands carry ~43.7% of
 * the return (avg ≈ 21 per coin via stacked multipliers × the ×3 Charlie); the
 * frequent total-15..21 cashes pay 1 each; 47.15% bust to 0. Cross-validated by
 * pnpm verify (sim RTP vs the exact DP inside its 3.5σ band).
 */
export const LUCKY_21: BlackjackReelMachineDef = {
  id: 'lucky-21',
  name: 'Lucky 21',
  family: 'blackjack-reel',
  denominationCents: 25,
  maxCoins: 5,
  history: 'A stop-the-reels descendant of the novelty blackjack machines that '
    + 'shared casino floors with the first stepper slots. The first two reels '
    + 'deal a two-card hand; from there each reel is a decision — bank the total '
    + 'you have, or spin the next reel for more and risk a bust. The middle reels '
    + 'trade cards for lock-in faces: additive multipliers, minus-point cards, and '
    + 'the dreaded BUST. Reach 21, hold a natural, or survive all five reels for '
    + 'the Five-Card Charlie. The last reel is the gamble made plain: rare ×5 and '
    + '×10 multipliers buried in a wall of BUST.',
  symbols: {
    MX2: { label: '×2', icon: 'mult-x2' },
    MX3: { label: '×3', icon: 'mult-x3' },
    MX5: { label: '×5', icon: 'mult-x5' },
    MX10: { label: '×10', icon: 'mult-x10' },
    MM2: { label: '−2', icon: 'minus-2' },
    MM3: { label: '−3', icon: 'minus-3' },
    BUST: { label: 'Bust', icon: 'bust' }
  },
  multiplierSymbols: { MX2: 2, MX3: 3, MX5: 5, MX10: 10 },
  minusSymbols: { MM2: 2, MM3: 3 },
  bustSymbol: 'BUST',

  reels: [
    // ── Reel 1 — deal card 1 (pure cards) ───────────────────────────────
    ['CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD'],

    // ── Reel 2 — deal card 2 (pure cards) ───────────────────────────────
    ['CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD', 'CARD'],

    // ── Reel 3 — lock-in bonus, NO cards ────────────────────────────────
    // 7 BUST + MX2 + MX3 + MM3. BUST density here is the primary RTP dial.
    ['BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'MX2', 'MX3', 'MM3'],

    // ── Reel 4 — mix, cards return ──────────────────────────────────────
    // 2 cards + 6 BUST + MX3 + MM3.
    ['CARD', 'CARD', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'MX3', 'MM3'],

    // ── Reel 5 — the big one: ×5/×10 over a wall of BUST, NO minus ───────
    // 2 cards + 8 BUST + MX5 + MX5 + MX10 (the signature ×5/×10 lives here).
    ['CARD', 'CARD', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'MX5', 'MX10', 'MX5']
  ],

  /**
   * Per-coin payout for a resolved hand by best total. Flat (every qualifying
   * total pays 1): the house edge is in the bust/0-pay frequency, and the upside
   * is carried by the multiplier faces and the ×3 Five-Card Charlie, not by the
   * base curve. Satisfies the 21 ≥ 20 ≥ … ≥ 15 ordering with equality.
   */
  paytable: [
    { total: 15, pay: 1 },
    { total: 16, pay: 1 },
    { total: 17, pay: 1 },
    { total: 18, pay: 1 },
    { total: 19, pay: 1 },
    { total: 20, pay: 1 },
    { total: 21, pay: 1 }
  ],

  qualifyMin: 15,
  /** a 2-card 21 (natural) pays the same per-coin base as any other 21 here (≥ paytable[21]) */
  naturalPay: 1,
  /** ×3 the whole payout for surviving all five reels (Five-Card Charlie) */
  charlieMultiplier: 3,

  progressive: null
}
