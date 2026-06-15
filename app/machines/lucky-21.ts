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
 *   wall of BUST (8/11). Heavy BUST here is the primary RTP dial: it gates whether
 *   the player can bank a multiplier before the card reels return.
 * Reel 4: mix — two cards return alongside a multiplier (MX3), a minus (MM3), and
 *   BUST (9/13).
 * Reel 5: the big one — ×5 / ×10 (the signature: 2×MX5 + MX10) + a wall of BUST
 *   (11/16) + two returning cards, NO minus.
 *
 * ── Payout model (RTP = E[base × max(1,multSum) × charlieMul]; the ante cancels) ─
 * The paytable pays are PER-COIN CREDITS and are deliberately SMALL — the house
 * edge (≈9.92%) comes from the high BUST + sub-qualifyMin (=0-pay) frequency under
 * optimal play, NOT from the pay magnitude. Under the exact optimal-stopping DP the
 * policy banks a qualifying two-card total at the first decision and otherwise rides
 * the BUST reels toward a multiplier-stacked Five-Card Charlie. The curve is a
 * GENTLE climb — "the closer to 21, the more you bank": totals 15–20 pay the floor
 * (1), a 21 pays 3, and a two-card natural 21 pays 4 (a strict premium over a
 * built-up 21). The big upside still lives in the multipliers and the ×3 Charlie;
 * the dollar *feel* lives in denominationCents (25¢ × up-to-5 coins) too.
 *
 * Why the climb stops at 21/natural rather than stepping every total: reels 1–2
 * can't bust, so any base bump at the FREQUENT risk-free totals (esp. 20, ~10.3% of
 * hands) is amplified by the multiplier/Charlie factors and adds several % RTP —
 * bumping 20 to 2 forces ~+12% RTP and (offsetting it with BUST) would crush the
 * Five-Card Charlie below ~0.6%. Climbing ONLY the rarer top (21 ≈ 4.8%, of which a
 * NATURAL is the cheapest premium of all) buys a vivid 1→3→4 reward ladder for a
 * modest +12% RTP, offset by a few extra BUSTs that keep the Charlie at ~1.06%
 * (≈27% of the return) and the reel roles + ×5/×10 signature intact.
 *
 * Integer-credit invariant: handPayout = base × max(1,multSum) × charlieMultiplier
 *   × ante is always a WHOLE number of credits because every paytable[].pay,
 *   naturalPay, and charlieMultiplier is a positive integer (and ante, multSum are
 *   integers). Verified: 0 fractional payouts over 4M optimal-policy hands with
 *   varying ante.
 *
 * ── Calibration (2026-06-15, blackjackReelExactRtp, optimal stopping) ────────
 * Paytable (per-coin): totals 15–20 pay 1; 21 pays 3.  naturalPay = 4 (> 21).
 * charlieMultiplier = 3 (Five-Card Charlie scales the whole payout).
 *
 * Frozen exact-math figures (see tests/machines-blackjack.test.ts):
 *   rtpPerCoin      = 0.9008462712680554   (≈ 90.08%)
 *   hitFrequency    = 0.5204396594571127   (≈ 52.04%)
 *   variancePerCoin = 8.627557473749649    (high-volatility, Charlie-driven)
 *   bustRate        = 0.47956034054288743  (≈ 47.96%)  [P(bust terminal)]
 *   charlieRate     = 0.010635737888485142 (≈  1.06%)  [P(Five-Card Charlie)]
 *
 * EV breakdown (per-coin contribution): the 1.06% Charlie hands carry ~27.3% of
 * the return (avg ≈ 23 per coin via stacked multipliers × the ×3 Charlie); a 21
 * pays 3 and a two-card natural pays 4 (~21.4% of the return — virtually all 21
 * cashes are naturals, since reaching 21 AFTER the deal means surviving the BUST
 * reels and drawing exactly right, which optimal play almost never waits for); the
 * frequent total-15..20 cashes pay 1 each; 47.96% bust to 0. Cross-validated by
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
    // 8 BUST + MX2 + MX3 + MM3. BUST density here is the primary RTP dial
    // (one extra BUST vs the flat curve, to offset the climbing 21/natural).
    ['BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'MX2', 'MX3', 'MM3'],

    // ── Reel 4 — mix, cards return ──────────────────────────────────────
    // 2 cards + 9 BUST + MX3 + MM3.
    ['CARD', 'CARD', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'MX3', 'MM3'],

    // ── Reel 5 — the big one: ×5/×10 over a wall of BUST, NO minus ───────
    // 2 cards + 11 BUST + MX5 + MX5 + MX10 (the signature ×5/×10 lives here).
    ['CARD', 'CARD', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'BUST', 'MX5', 'MX10', 'MX5']
  ],

  /**
   * Per-coin payout for a resolved hand by best total — a GENTLE climbing curve:
   * the closer to 21, the more you bank. Totals 15–20 pay the floor (1); a 21
   * pays 3. The base climb is deliberately concentrated at the rare top (21) — the
   * frequent risk-free 2-card totals (esp. 20) are too costly to bump (see the
   * header note), and the multiplier faces + the ×3 Five-Card Charlie still carry
   * the big upside. Totals are strictly ascending (validator-enforced); the pays
   * climb 1→3 with the natural premium below.
   */
  paytable: [
    { total: 15, pay: 1 },
    { total: 16, pay: 1 },
    { total: 17, pay: 1 },
    { total: 18, pay: 1 },
    { total: 19, pay: 1 },
    { total: 20, pay: 1 },
    { total: 21, pay: 3 }
  ],

  qualifyMin: 15,
  /** a 2-card 21 (natural) pays a strict premium over a built-up 21 (4 > paytable[21] = 3) */
  naturalPay: 4,
  /** ×3 the whole payout for surviving all five reels (Five-Card Charlie) */
  charlieMultiplier: 3,

  progressive: null
}
