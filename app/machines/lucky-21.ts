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
 * of BUST — the climb to a big hand or nothing. A two-card NATURAL 21 ends the
 * hand into a fair double-or-nothing bonus (see Tasks 1–5 / blackjackReel.ts).
 *
 * ── Reel roles (escalating danger + bonus; scattered BUST; ~90% RTP) ─────────
 * Reel 1: pure cards (deal card 1).
 * Reel 2: pure cards (deal card 2). Reels 1–2 are ALL 'CARD' (validator-enforced).
 * Reel 3: FRIENDLIER lock-in bonus, NO cards — modest multipliers (MX2, MX3) and a
 *   minus (MM3) over scattered BUST (6/9). Fewest BUST of the three special reels:
 *   the gentlest gate, where a multiplier is most reachable before cards return.
 * Reel 4: mix — two cards return alongside BIGGER bonus (the ×5 enters: MX3, MX5)
 *   and a minus (MM3) over scattered BUST (13/18). Danger steps up from reel 3.
 * Reel 5: the big one — the BIGGEST multipliers (the signature: 2×MX5 + MX10) over
 *   the densest scattered BUST (20/25) + two returning cards, NO minus. Danger
 *   peaks here. Escalation across the special reels: BUST 6 → 13 → 20, max-mult
 *   ×3 → ×5 → ×10. BUSTs are interleaved (scattered), never a contiguous wall.
 *
 * ── Payout model (RTP = E[base × max(1,multSum) × charlieMul]; the ante cancels) ─
 * The paytable pays are PER-COIN CREDITS and are deliberately SMALL — the house
 * edge (≈9.97%) comes from the high BUST + sub-qualifyMin (=0-pay) frequency under
 * optimal play, NOT from the pay magnitude. Under the exact optimal-stopping DP the
 * policy banks a qualifying two-card total at the first decision and otherwise rides
 * the BUST reels toward a multiplier-stacked Five-Card Charlie. The curve is a
 * GENTLE climb — "the closer to 21, the more you bank": totals 15–20 pay the floor
 * (1), a 21 pays 3, and a two-card natural 21 pays 5 (a strict premium over a
 * built-up 21). A natural ENDS the hand and opens the fair double-or-nothing bonus
 * (RTP-neutral — the gamble adds variance, not edge). The big upside lives in the
 * multipliers and the ×3 Charlie; the dollar *feel* lives in denominationCents
 * (25¢ × up-to-5 coins) too.
 *
 * Why the climb stops at 21/natural rather than stepping every total: reels 1–2
 * can't bust, so any base bump at the FREQUENT risk-free totals (esp. 20, ~10.3% of
 * hands) is amplified by the multiplier/Charlie factors and adds several % RTP —
 * bumping 20 to 2 forces several extra % RTP and (offsetting it with BUST) would
 * crush the Five-Card Charlie. Climbing ONLY the rarer top (21, of which a NATURAL
 * is the cheapest premium of all) buys a vivid 1→3→5 reward ladder for a modest RTP
 * cost, offset by the escalating BUST that keeps the Charlie near ~0.77% (a rare
 * jackpot-frequency event) and the reel roles + ×5/×10 signature intact.
 *
 * Integer-credit invariant: handPayout = base × max(1,multSum) × charlieMultiplier
 *   × ante is always a WHOLE number of credits because every paytable[].pay,
 *   naturalPay, and charlieMultiplier is a positive integer (and ante, multSum are
 *   integers). Verified: 0 fractional payouts over 4M optimal-policy hands with
 *   varying ante.
 *
 * ── Calibration (2026-06-16, blackjackReelExactRtp, optimal stopping) ────────
 * Paytable (per-coin): totals 15–20 pay 1; 21 pays 3.  naturalPay = 5 (> 21).
 * charlieMultiplier = 3 (Five-Card Charlie scales the whole payout). Reels
 * recalibrated for escalation + scattered BUST (Task 6): BUST 6 → 13 → 20 and
 * max-mult ×3 → ×5 → ×10 across reels 3 → 4 → 5; the natural now ends the hand
 * into the fair double-or-nothing bonus (Tasks 1–5), which is RTP-neutral.
 *
 * Frozen exact-math figures (see tests/machines-blackjack.test.ts):
 *   rtpPerCoin      = 0.9002547143073755   (≈ 90.03%)
 *   hitFrequency    = 0.5175336121913153   (≈ 51.75%)
 *   variancePerCoin = 7.751122922982434    (high-volatility, Charlie-driven)
 *   bustRate        = 0.48246638780868467  (≈ 48.25%)  [P(bust terminal)]
 *   charlieRate     = 0.00772969062268782  (≈  0.77%)  [P(Five-Card Charlie)]
 *
 * EV breakdown (per-coin contribution): the 0.77% Charlie hands carry a large
 * slice of the return via stacked multipliers × the ×3 Charlie; a 21 pays 3 and a
 * two-card natural pays 5 (virtually all 21 cashes are naturals, since reaching 21
 * AFTER the deal means surviving the BUST reels and drawing exactly right, which
 * optimal play almost never waits for); the frequent total-15..20 cashes pay 1
 * each; ~48.25% bust to 0. Cross-validated by pnpm verify (sim RTP vs the exact DP
 * inside its 3.5σ band).
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

    // ── Reel 3 — FRIENDLIER lock-in bonus, NO cards ─────────────────────
    // 6 BUST (scattered) + MX2 + MX3 + MM3 = 9. Fewest BUST of the special
    // reels: the gentlest gate. BUSTs interleaved, never a contiguous wall.
    ['MX2', 'BUST', 'BUST', 'MM3', 'BUST', 'MX3', 'BUST', 'BUST', 'BUST'],

    // ── Reel 4 — mix, cards return, bigger bonus ────────────────────────
    // 2 cards + 13 BUST (scattered) + MX3 + MX5 + MM3 = 18. The ×5 enters here;
    // danger steps up from reel 3. BUSTs evenly interleaved (no run > 3).
    ['BUST', 'BUST', 'CARD', 'BUST', 'BUST', 'MX3', 'BUST', 'BUST', 'CARD', 'BUST', 'BUST', 'MX5', 'BUST', 'BUST', 'MM3', 'BUST', 'BUST', 'BUST'],

    // ── Reel 5 — the big one: ×5/×10 over the densest BUST, NO minus ─────
    // 2 cards + 20 BUST (scattered) + MX5 + MX5 + MX10 = 25 (the signature
    // ×5/×10 lives here). Danger peaks. Only 5 non-BUST faces split the 20 BUST,
    // so the tightest even spread is runs of 3–4 — interleaved, never a wall.
    ['BUST', 'BUST', 'BUST', 'CARD', 'BUST', 'BUST', 'BUST', 'BUST', 'MX5', 'BUST', 'BUST', 'BUST', 'CARD', 'BUST', 'BUST', 'BUST', 'BUST', 'MX10', 'BUST', 'BUST', 'BUST', 'MX5', 'BUST', 'BUST', 'BUST']
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
  /**
   * A 2-card 21 (natural) pays a strict premium over a built-up 21
   * (5 > paytable[21] = 3) and ENDS the hand into the fair double-or-nothing
   * bonus (Tasks 1–5); the bonus is RTP-neutral so this stays the DP value.
   */
  naturalPay: 5,
  /** ×3 the whole payout for surviving all five reels (Five-Card Charlie) */
  charlieMultiplier: 3,

  progressive: null
}
