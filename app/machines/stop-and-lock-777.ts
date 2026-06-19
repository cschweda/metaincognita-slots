import type { LockReelMachineDef, SymbolId } from '../engine/types'

/**
 * Stop & Lock 777 — the floor's Featured "big daddy" (the `lock-reel` engine
 * family: a player-stopped hold-and-spin cash-collect machine).
 *
 * Five reels over a 5 × 4 grid. The reels spin nonstop; you press STOP to lock
 * each reel left-to-right, and every locked cash symbol + fixed prize BANKS —
 * nothing is ever wiped out (no bust, no crash). When all five reels are stopped
 * you collect the bet-scaled sum. Lock three 7s in one stop-through and the
 * 777 BONUS fires: a free Stop-&-Lock respin feature where everything held stays
 * put and every still-empty cell respins off DEDICATED, denser bonus reels (so
 * cash genuinely keeps locking — this is a real hold-and-spin, not a re-roll of
 * the sparse base). Any new lock resets the respins, the trigger's 7s are sticky
 * and upgrade, and filling the whole 20-cell grid awards the GRAND (a reachable
 * ~1-in-10,600 dream). Two 7s leave a one-reel re-stop "tease" (EV 0, wired by
 * the UI later).
 *
 * Honest stop: each STOP is a uniform window draw from the reel's strip — the
 * timing feels skillful but does not change the odds (same stance as the pachislo
 * skill-stop). The X-ray / PAR surface the real edge: per-reel cash EV, the
 * 3-seven bonus odds, and the bonus EV. See app/engine/lockReelRtp.ts.
 *
 * ── Economy / RTP ──────────────────────────────────────────────────────────
 * Per-coin credits: the payout is ante × collect and the cost is the ante, so
 * RTP (return/stake) equals E[collect] in per-coin credits directly — there is
 * NO /coins normalization. cashValues are small positive integers (the $-labels
 * are cosmetic; the credit weight is the math, standard for cash-collect virtual
 * reels), so the BASE strips are long and very blank-heavy to dilute the 20-cell
 * collect down to a sub-1.0 expectation. The 777 BONUS is the engine of the
 * machine: it is a TRUE hold-and-spin over its own DEDICATED, ~25× denser bonus
 * strips (see below), so cash really locks during respins, the grid can fill, and
 * a filled grid pays the GRAND — a rare-but-reachable dream, not a showcase you
 * can never hit.
 *
 * Calibrated (an exact-RTP sweep; the throwaway scripts/_sl-calibrate.ts was
 * deleted after baking the numbers in) to:
 *   - RTP/coin       94.5073%   (target ~94.5%, the floor's slightly-generous band)
 *   - hit frequency  22.89%     (high variance — small base collects + a rare,
 *                                big bonus tail; SD ≈ 6.66 credits/coin)
 *   - 777 bonus      ~1 in 96 rounds; bonus EV given trigger ≈ 43.6 credits/coin
 *   - the GRAND (a full 20-cell grid) is now REACHABLE: ~1 in 10,600 rounds
 *     (P(fill | bonus) ≈ 0.94%), contributing ~4.6% of RTP — a real, load-bearing
 *     dream payout rather than the old ~1-in-270M, ~0% lottery
 * The RTP breakdown is base-cash 52.0% / bonus-cash 25.8% / sticky-7 17.6% /
 * GRAND 4.6% — value now sits in real bonus locking and the GRAND, NOT in flat
 * sticky-7 upgrades (the pre-rework split was ~56% / 3.5% / 40% / ~0%, an
 * "upgrade-dominated" bonus that never filled). The exact figure is FROZEN in
 * tests/machines-lockreel.test.ts and cross-checked by the seeded multi-million-
 * round sim inside `pnpm verify`'s 3.5σ band.
 *
 * Denomination $0.25, bet 1–20 coins (a small-bet, big-payout featured cabinet,
 * matching the floor's other bet ranges). A bigger bet scales every cash value
 * and every prize proportionally; there are no paylines (collection, not
 * matching).
 *
 * ── Strips ─────────────────────────────────────────────────────────────────
 * BASE: five 692-cell virtual strips produced by a deterministic builder (a long
 * blank-heavy reel is impractical as a literal). `buildStrip` reproduces the
 * exact calibrated placement: cash cells spread by an even stride (collisions
 * advance forward), the 7s as one contiguous cluster near 47% (so one window can
 * catch 2–3 of them — the lever that sets the 3-seven trigger rate), and the
 * prize tucked near 80%. RTP depends only on the per-symbol COUNTS; placement
 * only moves the hit frequency and the bonus rate.
 *
 * BONUS: five DEDICATED 40-cell strips (`buildBonusStrip`), cash + BLANK only (no
 * prize/GRAND symbol — the GRAND is strictly the grid-fill award). Each carries 4
 * cash cells of 40 (a ~10% per-cell lock rate, vs the base's ~1.5%), so respins
 * lock readily but the long tail of the 20-cell grid usually starves before a
 * full fill — that ~0.94% fill rate is exactly what makes the GRAND a rare dream
 * while keeping bonus-cash a real, frequent payout. The frozen RTP test pins both
 * builders' output exactly.
 */

const STRIP_LEN = 692
const SEVEN: SymbolId = 'SEVEN'
const BLANK: SymbolId = 'BLANK'

/** One reel's symbol counts: cash cells (spread), 7s (one cluster), a prize. */
interface ReelSpec {
  cash: [SymbolId, number][]
  sevens: number
  prize: SymbolId | null
}

/**
 * Build a length-`STRIP_LEN` strip from a spec. Deterministic and pure:
 *  - BLANK background;
 *  - cash cells laid down at even stride `floor(i·L / count)` (advance past any
 *    occupied cell), so the cash is spread (each 4-window tends to catch ≤ 1);
 *  - the 7s as one contiguous run starting near 47% of the strip;
 *  - the prize near 80%.
 */
function buildStrip(spec: ReelSpec): SymbolId[] {
  const strip: SymbolId[] = new Array<SymbolId>(STRIP_LEN).fill(BLANK)
  const cells: SymbolId[] = []
  for (const [sym, n] of spec.cash) for (let i = 0; i < n; i++) cells.push(sym)
  const count = cells.length
  for (let i = 0; i < count; i++) {
    let at = Math.floor((i * STRIP_LEN) / Math.max(1, count))
    while (strip[at % STRIP_LEN] !== BLANK) at++
    strip[at % STRIP_LEN] = cells[i]!
  }
  let s = Math.floor(STRIP_LEN * 0.47)
  for (let i = 0; i < spec.sevens; i++) {
    while (strip[s % STRIP_LEN] !== BLANK) s++
    strip[s % STRIP_LEN] = SEVEN
    s++
  }
  if (spec.prize !== null) {
    let p = Math.floor(STRIP_LEN * 0.8)
    while (strip[p % STRIP_LEN] !== BLANK) p++
    strip[p % STRIP_LEN] = spec.prize
  }
  return strip
}

// Per-reel calibrated BASE specs. Cash is C1-heavy (for the hit frequency) with a
// little $2/$3/$5 texture; reels 2/4 carry the single $5. The 7-cluster sizes
// [4,3,3,2,2] set the ~1-in-96 trigger; reel 2's MAJOR and reels 0/3's MINI give
// the base a little prize texture, while the GRAND is bonus-fill only. Thinned
// (C1 6/5/5/5/5) from the pre-rework strips so the much richer bonus keeps total
// RTP at ~0.945.
const REEL_SPECS: ReelSpec[] = [
  { cash: [['C1', 6], ['C2', 2]], sevens: 4, prize: 'MINI' },
  { cash: [['C1', 5], ['C2', 2], ['C3', 1]], sevens: 3, prize: null },
  { cash: [['C1', 5], ['C2', 2], ['C5', 1]], sevens: 3, prize: 'MAJOR' },
  { cash: [['C1', 5], ['C2', 1], ['C3', 1]], sevens: 2, prize: 'MINI' },
  { cash: [['C1', 5], ['C2', 2], ['C5', 1]], sevens: 2, prize: null }
]

// ── bonus strips ─────────────────────────────────────────────────────────────
// The 777 bonus is a TRUE hold-and-spin: respins draw from these DEDICATED bonus
// strips (NOT the sparse base reels), so cash really locks, the grid can fill,
// and the GRAND becomes a rare-but-reachable dream. A bonus strip carries only
// cash + BLANK — never a prize/GRAND symbol (the GRAND is the grid-fill award
// alone) and, here, no 7 either (we deliberately keep value out of flat sticky-7
// upgrades; sticky 7s come from the base trigger). Each strip is 4 cash cells of
// 40 — a ~10% per-cell lock rate, ~25× the base's ~0.4%/cell. That density is the
// whole lever: high enough that respins lock and reset the counter (real
// bonus-cash), low enough that the 20-cell grid's tail usually starves before a
// full fill (so the GRAND stays a ~1-in-10,600 dream, not a near-certainty).
const BONUS_STRIP_LEN = 40

/** One bonus strip's symbol counts (out of BONUS_STRIP_LEN): cash, 7s, rest BLANK. */
interface BonusSpec {
  cash: [SymbolId, number][]
  sevens: number
}

/**
 * Build a length-`BONUS_STRIP_LEN` bonus strip: cash spread by an even stride
 * (collisions advance forward), an optional small 7 cluster near 50%, the rest
 * BLANK. Pure and deterministic — RTP depends only on the per-symbol counts, so
 * the literal placement is cosmetic. NO prize/GRAND symbol is ever placed.
 */
function buildBonusStrip(spec: BonusSpec): SymbolId[] {
  const strip: SymbolId[] = new Array<SymbolId>(BONUS_STRIP_LEN).fill(BLANK)
  const cells: SymbolId[] = []
  for (const [sym, n] of spec.cash) for (let i = 0; i < n; i++) cells.push(sym)
  const count = cells.length
  for (let i = 0; i < count; i++) {
    let at = Math.floor((i * BONUS_STRIP_LEN) / Math.max(1, count))
    while (strip[at % BONUS_STRIP_LEN] !== BLANK) at++
    strip[at % BONUS_STRIP_LEN] = cells[i]!
  }
  let s = Math.floor(BONUS_STRIP_LEN * 0.5)
  for (let i = 0; i < spec.sevens; i++) {
    while (strip[s % BONUS_STRIP_LEN] !== BLANK) s++
    strip[s % BONUS_STRIP_LEN] = SEVEN
    s++
  }
  return strip
}

// Per-reel bonus specs: 4 cash cells of 40 (p ≈ 0.10 lock/cell) on every reel,
// {C1, C2, C2, C5} so a locked cell averages 2.5 credits — the lever that lifts
// bonus-cash to ~26% of RTP. No 7s on the bonus strips (value stays in real locks
// + the GRAND, not flat sticky-7 upgrades). Uniform across reels: the fill rate
// (hence the GRAND rate) depends on the per-column lock probability, which is the
// same on all five.
const BONUS_SPECS: BonusSpec[] = [
  { cash: [['C1', 1], ['C2', 2], ['C5', 1]], sevens: 0 },
  { cash: [['C1', 1], ['C2', 2], ['C5', 1]], sevens: 0 },
  { cash: [['C1', 1], ['C2', 2], ['C5', 1]], sevens: 0 },
  { cash: [['C1', 1], ['C2', 2], ['C5', 1]], sevens: 0 },
  { cash: [['C1', 1], ['C2', 2], ['C5', 1]], sevens: 0 }
]

export const STOP_AND_LOCK_777: LockReelMachineDef = {
  id: 'stop-and-lock-777',
  name: 'Stop & Lock 777',
  family: 'lock-reel',
  denominationCents: 25,
  maxCoins: 20,
  rows: 4,
  reels: REEL_SPECS.map(buildStrip),
  bonusReels: BONUS_SPECS.map(buildBonusStrip),
  symbols: {
    C1: { label: '$1', icon: 'cash' },
    C2: { label: '$2', icon: 'cash' },
    C3: { label: '$3', icon: 'cash' },
    C5: { label: '$5', icon: 'cash' },
    MINI: { label: 'MINI', icon: 'prize' },
    MAJOR: { label: 'MAJOR', icon: 'prize' },
    GRAND: { label: 'GRAND', icon: 'grand' },
    SEVEN: { label: '7', icon: 'seven' },
    BLANK: { label: '', icon: 'blank' }
  },
  cashValues: { C1: 1, C2: 2, C3: 3, C5: 5 },
  prizes: { MINI: 5, MAJOR: 15, GRAND: 460 },
  sevenSymbol: 'SEVEN',
  blankSymbol: 'BLANK',
  bonus: { respins: 2, sevenUpgrade: 5, grandOnFill: 'GRAND' },
  progressive: null,
  history: 'The "big daddy" of the floor — the lavish corner cabinet you have '
    + 'never seen, beckoning a big payout for a small bet. It is the hold-and-spin '
    + 'cash-collect genre (Lightning Link, Dragon Link, Buffalo Gold) that '
    + 'conquered casino floors, with our twist: the reels are player-stopped, so '
    + 'the skill-stop interaction is real even though every stop is an honest '
    + 'uniform draw. Stop the reels, lock the cash, collect — nothing is ever '
    + 'wiped out. Light all three vault-7s in one pass and the 777 bonus cracks '
    + 'the vault open into free Stop-&-Lock respins, sticky upgrading 7s, and a '
    + 'GRAND for filling the whole grid.'
}
