// Stop & Lock 777 — exact RTP (cash-collect + hold-and-spin bonus).
//
// RTP is computed, never asserted: the base collect is a closed-form enumeration
// over the five independent uniform-window stops, and the 7-chase BONUS EV is an
// EXACT absorbing-Markov computation (no Monte-Carlo), so the seeded sim that
// `pnpm verify` runs is a genuine convergence check, not a circular one.
//
// Boundary with the engine (see lockReel.ts): a round's per-coin collect is
//   collect = baseCash                                   (no-bonus round)
//   collect = baseCash + bonusCash + totalSevens·upgrade
//             + grand·1[fill]                            (bonus round, >= 3 sevens)
// where baseCash is the cash/prizes locked in the five stops, bonusCash is cash
// locked during the respins, totalSevens counts every 7 (base + bonus), and the
// upgrade/grand are only paid on bonus rounds. So
//   rtpPerCoin = E[baseCash]
//              + E[1[bonus]·bonusCash]
//              + E[1[bonus]·totalSevens·upgrade]
//              + E[1[bonus]·grand·1[fill]]
// the four breakdown buckets, which sum to E[collect].
//
// The BONUS is a hold-and-spin with reset-on-lock over a 5×rows grid whose
// columns have DIFFERENT strips (so different per-column lock/seven/value
// distributions — Ruby of Gargoyle's uniform hnsFinalDist does not apply
// directly). Each respin every still-empty cell re-draws one symbol uniformly
// from its OWN reel's strip; a non-blank locks (sticky), any lock resets the
// shared respin counter, a pure miss decrements it, a full grid ends with the
// GRAND. The only coupling between columns is the shared counter, and cells in a
// column are i.i.d., so the chain state is the per-column empty-cell counts plus
// respins left — (rows+1)^5 · respins states — and we propagate the exact first
// two moments of (bonusCash, bonusSevens, fill) through it. That yields exact
// E[collect] AND exact Var(collect) (the band `pnpm verify` checks).

import type { ExactRtpBreakdownEntry, ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { LockReelMachineDef, SymbolId } from './types'

// ---------- per-reel strip statistics ----------

interface ReelStats {
  /** P(a single uniform strip draw is the blank) — a respin "miss" for one cell */
  pBlank: number
  /** P(a single draw locks), = 1 - pBlank */
  pLock: number
  /** P(symbol is a 7 | it locks) */
  pSevenGivenLock: number
  /** E[cash credits | it locks] (7s contribute 0 cash) */
  evCashGivenLock: number
  /** E[cash credits^2 | it locks] */
  ev2CashGivenLock: number
}

/** Per-coin credit value of a locked symbol: cash value, prize value, or 0 (seven/blank). */
function symbolCredits(def: LockReelMachineDef, sym: SymbolId): number {
  return def.cashValues[sym] ?? def.prizes[sym] ?? 0
}

function reelStats(def: LockReelMachineDef, r: number): ReelStats {
  const strip = def.reels[r]!
  const len = strip.length
  let blanks = 0
  let locks = 0
  let sevens = 0
  let sumCash = 0
  let sumCash2 = 0
  for (const sym of strip) {
    if (sym === def.blankSymbol) {
      blanks += 1
      continue
    }
    locks += 1
    if (sym === def.sevenSymbol) {
      sevens += 1
    } else {
      const v = symbolCredits(def, sym)
      sumCash += v
      sumCash2 += v * v
    }
  }
  return {
    pBlank: blanks / len,
    pLock: locks / len,
    pSevenGivenLock: locks === 0 ? 0 : sevens / locks,
    evCashGivenLock: locks === 0 ? 0 : sumCash / locks,
    ev2CashGivenLock: locks === 0 ? 0 : sumCash2 / locks
  }
}

// ---------- per-reel window distribution (the five base stops) ----------

/** A window outcome for one reel: locked cash, sevens, and still-empty cells. */
interface WindowOutcome {
  cash: number
  sevens: number
  empty: number
  p: number
}

/**
 * Distribution over a reel's window outcomes. Each of the `strip.length` uniform
 * windows is equally likely; identical (cash, sevens, empty) triples merge.
 */
function windowOutcomes(def: LockReelMachineDef, r: number): WindowOutcome[] {
  const strip = def.reels[r]!
  const len = strip.length
  const merged = new Map<string, WindowOutcome>()
  for (let start = 0; start < len; start++) {
    let cash = 0
    let sevens = 0
    let empty = 0
    for (let i = 0; i < def.rows; i++) {
      const sym = strip[(start + i) % len]!
      if (sym === def.sevenSymbol) sevens += 1
      else if (sym === def.blankSymbol) empty += 1
      else cash += symbolCredits(def, sym)
    }
    const key = `${cash}:${sevens}:${empty}`
    const hit = merged.get(key)
    if (hit === undefined) merged.set(key, { cash, sevens, empty, p: 1 / len })
    else hit.p += 1 / len
  }
  return [...merged.values()]
}

// ---------- bonus chain: exact moments of (cash, sevens, fill) ----------

/** First two moments (+ cross terms) of the future bonus payoff from a state. */
interface BonusMoments {
  /** E[bonus cash locked] */
  eC: number
  /** E[bonus sevens locked] */
  eV: number
  /** P(grid eventually fills) */
  eF: number
  eC2: number
  eV2: number
  eCV: number
  eCF: number
  eVF: number
}

const ZERO_MOMENTS: BonusMoments = { eC: 0, eV: 0, eF: 0, eC2: 0, eV2: 0, eCV: 0, eCF: 0, eVF: 0 }
// A grid that is ALREADY FULL absorbs with the GRAND awarded (fill F = 1, no
// further cash/sevens). Distinct from ZERO_MOMENTS (out of respins, NOT full).
const FULL_MOMENTS: BonusMoments = { eC: 0, eV: 0, eF: 1, eC2: 0, eV2: 0, eCV: 0, eCF: 0, eVF: 0 }

/** Binomial pmf for n i.i.d. trials at probability p (n small). */
function binom(n: number, p: number): number[] {
  const out = new Array<number>(n + 1)
  let c = 1
  for (let k = 0; k <= n; k++) {
    out[k] = c * p ** k * (1 - p) ** (n - k)
    c = (c * (n - k)) / (k + 1)
  }
  return out
}

/**
 * Solve the bonus chain for one entry empty-count vector. Returns the exact
 * moments of (bonusCash C, bonusSevens V, fill F) accumulated over the whole
 * feature, started with a FULL respin budget. Memoized over `(e, r)`.
 *
 * One respin: in each column j, the `e_j` empty cells each lock independently
 * w.p. `pLock_j`; `k_j ~ Binom(e_j, pLock_j)` of them lock this respin, adding
 *   cash  with per-cell mean `evCashGivenLock_j`, 2nd moment `ev2CashGivenLock_j`
 *   sevens with per-cell mean `pSevenGivenLock_j` (a 0/1 indicator)
 * independently across columns and cells. The grid then has empties `e - k`; if
 * full it absorbs (F=1), else if any cell locked (Σk≥1) the counter resets to N,
 * else it decrements (absorbs at 0 with F=0). The increment (ΔC, ΔV) of THIS
 * respin and the future (C', V', F') from the resulting state are independent
 * given k, so the moments compose by the usual sum rules.
 */
function makeBonusSolver(def: LockReelMachineDef): (empty: number[]) => BonusMoments {
  const stats = def.reels.map((_, r) => reelStats(def, r))
  const N = def.bonus.respins
  const memo = new Map<string, BonusMoments>()

  const solve = (e: number[], r: number): BonusMoments => {
    if (e.every(x => x === 0)) return FULL_MOMENTS // already full: GRAND awarded (F=1)
    const key = `${e.join(',')}|${r}`
    const hit = memo.get(key)
    if (hit !== undefined) return hit

    // Per-column distribution of (k_j locks, ΔC_j cash moments, ΔV_j seven moments).
    // Enumerate the joint over k = (k_0..k_4) as a product of per-column binomials.
    const pmfs = e.map((ej, j) => binom(ej, stats[j]!.pLock))

    const acc: BonusMoments = { eC: 0, eV: 0, eF: 0, eC2: 0, eV2: 0, eCV: 0, eCF: 0, eVF: 0 }

    const k = new Array<number>(5).fill(0)
    const recurse = (j: number, pk: number): void => {
      if (j === 5) {
        // increment moments of this respin (sum of independent per-column locks)
        let dC = 0
        let dV = 0
        let dC2 = 0
        let dV2 = 0
        let dCV = 0
        for (let c = 0; c < 5; c++) {
          const kc = k[c]!
          if (kc === 0) continue
          const s = stats[c]!
          const muCash = s.evCashGivenLock
          const m2Cash = s.ev2CashGivenLock
          const muSev = s.pSevenGivenLock // E[indicator]; E[indicator^2] = same
          // sum of kc i.i.d. cash values
          const ec = kc * muCash
          const vc = kc * (m2Cash - muCash * muCash) // variance of one cell × kc
          dC += ec
          dC2 += vc // accumulate variances; mean^2 folded below
          // sum of kc i.i.d. seven indicators
          const ev = kc * muSev
          const vv = kc * (muSev - muSev * muSev)
          dV += ev
          dV2 += vv
          // cash and seven of the SAME cell are dependent (a 7 has cash 0):
          // Cov(cashCell, sevenCell) = E[cash·seven] - E[cash]E[seven]
          //   = 0 - muCash·muSev  (a locked cell is a 7 XOR carries cash)
          dCV += kc * (0 - muCash * muSev)
        }
        // fold means into second moments: for independent column sums,
        // E[ΔC^2] = Var(ΔC) + E[ΔC]^2, etc.
        dC2 += dC * dC
        dV2 += dV * dV
        dCV += dC * dV

        // resulting state
        const e2 = e.map((ej, c) => ej - k[c]!)
        const full = e2.every(x => x === 0)
        const anyLock = k.some(x => x > 0)
        let fut: BonusMoments
        if (full) {
          fut = FULL_MOMENTS // this respin filled the grid → GRAND (F=1)
        } else if (anyLock) {
          fut = solve(e2, N) // reset
        } else if (r - 1 <= 0) {
          fut = ZERO_MOMENTS // out of respins, no fill
        } else {
          fut = solve(e, r - 1) // decrement (e2 == e here, no lock)
        }

        // compose: total = increment (this respin) + future (independent | k)
        // means
        acc.eC += pk * (dC + fut.eC)
        acc.eV += pk * (dV + fut.eV)
        acc.eF += pk * fut.eF
        // second moments: (a+b)^2 = a^2 + 2ab + b^2, a⊥b ⇒ E[ab]=E[a]E[b]
        acc.eC2 += pk * (dC2 + 2 * dC * fut.eC + fut.eC2)
        acc.eV2 += pk * (dV2 + 2 * dV * fut.eV + fut.eV2)
        acc.eCV += pk * (dCV + dC * fut.eV + dV * fut.eC + fut.eCV)
        // F is the future fill flag only (this respin can set it via `full`,
        // captured in fut.eF=1 with dC=dV=0 there): cross with increment cash/sevens
        acc.eCF += pk * (dC * fut.eF + fut.eCF)
        acc.eVF += pk * (dV * fut.eF + fut.eVF)
        return
      }
      const pmf = pmfs[j]!
      for (let kj = 0; kj < pmf.length; kj++) {
        const pj = pmf[kj]!
        if (pj === 0) continue
        k[j] = kj
        recurse(j + 1, pk * pj)
      }
      k[j] = 0
    }
    recurse(0, 1)

    memo.set(key, acc)
    return acc
  }

  return (empty: number[]) => solve(empty, N)
}

// ---------- the report ----------

interface RtpAcc {
  /** E[collect] (= rtpPerCoin) */
  eY: number
  /** E[collect^2] */
  eY2: number
  /** P(collect = 0) — the only zero mass is baseCash=0 on a no-bonus round */
  pZero: number
  baseCashEv: number
  bonusCashEv: number
  upgradeEv: number
  grandEv: number
  pBonus: number
}

function accumulate(def: LockReelMachineDef): RtpAcc {
  const u = def.bonus.sevenUpgrade
  const grand = def.prizes[def.bonus.grandOnFill]!
  const solveBonus = makeBonusSolver(def)
  const reels = def.reels.map((_, r) => windowOutcomes(def, r))

  const acc: RtpAcc = {
    eY: 0, eY2: 0, pZero: 0,
    baseCashEv: 0, bonusCashEv: 0, upgradeEv: 0, grandEv: 0, pBonus: 0
  }

  // entry-state moment cache keyed by the empty-count vector (shared across the
  // many window combos that reach the same empty shape and across base-seven /
  // base-cash values, since the bonus chain depends only on the empty counts)
  const bonusCache = new Map<string, BonusMoments>()
  const empty = new Array<number>(5).fill(0)

  const sel = new Array<WindowOutcome>(5)
  const recurse = (r: number, p: number, baseCash: number, sBase: number): void => {
    if (r === 5) {
      if (sBase < 3) {
        // no bonus: collect = baseCash, deterministic
        acc.eY += p * baseCash
        acc.eY2 += p * baseCash * baseCash
        acc.baseCashEv += p * baseCash
        if (baseCash === 0) acc.pZero += p
        return
      }
      // bonus round: assemble X = bonusCash + (sBase + bonusSevens)·u + grand·F
      for (let c = 0; c < 5; c++) empty[c] = sel[c]!.empty
      const key = empty.join(',')
      let m = bonusCache.get(key)
      if (m === undefined) {
        m = solveBonus(empty)
        bonusCache.set(key, m)
      }
      // E[X], E[X^2] from the bonus moments (constants: sBase, u, grand)
      const eX = m.eC + u * m.eV + grand * m.eF + sBase * u
      // W = C + u·V + grand·F ; X = sBase·u + W
      const eW = m.eC + u * m.eV + grand * m.eF
      const eW2 = m.eC2 + u * u * m.eV2 + grand * grand * m.eF
        + 2 * u * m.eCV + 2 * grand * m.eCF + 2 * u * grand * m.eVF
      const su = sBase * u
      const eX2 = su * su + 2 * su * eW + eW2
      // Y = baseCash + X (baseCash constant for this combo)
      acc.eY += p * (baseCash + eX)
      acc.eY2 += p * (baseCash * baseCash + 2 * baseCash * eX + eX2)
      // breakdown contributions (per coin)
      acc.baseCashEv += p * baseCash
      acc.bonusCashEv += p * m.eC
      acc.upgradeEv += p * (sBase + m.eV) * u
      acc.grandEv += p * grand * m.eF
      acc.pBonus += p
      // a bonus round with sevenUpgrade>0 always pays (>=3 sevens · u > 0), so
      // it never adds to pZero
      return
    }
    for (const w of reels[r]!) {
      sel[r] = w
      recurse(r + 1, p * w.p, baseCash + w.cash, sBase + w.sevens)
    }
  }
  recurse(0, 1, 0, 0)
  return acc
}

const reportCache = new Map<string, ExactRtpReport>()

/**
 * Exact per-coin RTP, hit frequency, per-round (per-coin) variance, and a
 * labelled breakdown for a lock-reel machine. Coin-linear: the payout is
 * `ante × collect` with collect a per-coin credit total, so RTP/coin and
 * Var/coin are independent of the coin level (the optional `coins` is validated
 * for parity with the other families but does not change the figures).
 */
export function lockReelExactRtp(def: LockReelMachineDef, opts: ExactRtpOptions = {}): ExactRtpReport {
  if (def.reels.length !== 5) throw new Error(`${def.id}: lock-reel needs exactly 5 reels`)
  if (def.bonus.sevenUpgrade <= 0) {
    // the hit-frequency closed form assumes every bonus round pays (>=3 sevens ·
    // upgrade > 0); a zero upgrade would need the bonus-pays-nothing mass too
    throw new Error(`${def.id}: bonus.sevenUpgrade must be > 0 for the exact hit-frequency form`)
  }
  const coins = opts.coins ?? def.maxCoins
  if (!Number.isInteger(coins) || coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }
  // Cache on the full RTP-relevant shape (not just id): two defs can share an id
  // in tests/calibration, and the figures are coin-independent so coins is out.
  const key = JSON.stringify([def.rows, def.reels, def.cashValues, def.prizes, def.sevenSymbol, def.blankSymbol, def.bonus])
  const cached = reportCache.get(key)
  if (cached !== undefined) return cached

  const acc = accumulate(def)
  const rtpPerCoin = acc.eY
  const variancePerCoin = acc.eY2 - acc.eY * acc.eY
  const hitFrequency = 1 - acc.pZero
  const grand = def.prizes[def.bonus.grandOnFill]!
  const pFill = grand > 0 ? acc.grandEv / grand : 0

  const breakdown: ExactRtpBreakdownEntry[] = [
    { entryId: 'base-cash', probability: 1, avgPayPerCoin: acc.baseCashEv, contribution: acc.baseCashEv },
    { entryId: 'bonus-cash', probability: acc.pBonus, avgPayPerCoin: acc.pBonus > 0 ? acc.bonusCashEv / acc.pBonus : 0, contribution: acc.bonusCashEv },
    { entryId: 'seven-upgrade', probability: acc.pBonus, avgPayPerCoin: acc.pBonus > 0 ? acc.upgradeEv / acc.pBonus : 0, contribution: acc.upgradeEv },
    { entryId: 'grand', probability: pFill, avgPayPerCoin: grand, contribution: acc.grandEv }
  ].filter(e => e.contribution > 0).sort((a, b) => b.contribution - a.contribution)

  const report: ExactRtpReport = { rtpPerCoin, hitFrequency, variancePerCoin, breakdown }
  reportCache.set(key, report)
  return report
}

// ---------- live X-ray / PAR helpers ----------

/** Per-reel expected locked cash from a single uniform stop (the base collect, reel by reel). */
export function reelCashEvs(def: LockReelMachineDef): number[] {
  return def.reels.map((_, r) => {
    let ev = 0
    for (const w of windowOutcomes(def, r)) ev += w.p * w.cash
    return ev
  })
}

/** P(a single uniform stop locks at least one 7 on this reel), reel by reel. */
export function reelSevenOdds(def: LockReelMachineDef): number[] {
  return def.reels.map((_, r) => {
    let p = 0
    for (const w of windowOutcomes(def, r)) if (w.sevens > 0) p += w.p
    return p
  })
}

/**
 * P(>= 3 sevens locked in a round) — the bonus trigger probability. Convolves
 * the five independent per-reel seven-count distributions.
 */
export function bonusOdds(def: LockReelMachineDef): number {
  // distribution of total sevens across the five reels
  let dist = new Map<number, number>([[0, 1]])
  for (let r = 0; r < 5; r++) {
    const reelDist = new Map<number, number>()
    for (const w of windowOutcomes(def, r)) {
      reelDist.set(w.sevens, (reelDist.get(w.sevens) ?? 0) + w.p)
    }
    const next = new Map<number, number>()
    for (const [s, ps] of dist) {
      for (const [k, pk] of reelDist) {
        next.set(s + k, (next.get(s + k) ?? 0) + ps * pk)
      }
    }
    dist = next
  }
  let p = 0
  for (const [s, ps] of dist) if (s >= 3) p += ps
  return p
}

/**
 * E[bonus addition per coin GIVEN the bonus triggers] — the average extra
 * credits a triggered 7-chase pays (bonus cash + the seven upgrades + the Grand
 * on a fill), the X-ray's "bonus EV" figure.
 */
export function bonusEv(def: LockReelMachineDef): number {
  const acc = accumulate(def)
  if (acc.pBonus === 0) return 0
  return (acc.bonusCashEv + acc.upgradeEv + acc.grandEv) / acc.pBonus
}

export interface LockReelParRow {
  label: string
  probability: number
  /** average credits per coin when it occurs */
  avgPayPerCoin: number
  /** probability × avgPayPerCoin (the RTP contribution per coin) */
  contribution: number
}

/** Labelled PAR rows (the paytable breakdown) for the PAR sheet. */
export function lockReelParRows(def: LockReelMachineDef): LockReelParRow[] {
  const report = lockReelExactRtp(def)
  const labels: Record<string, string> = {
    'base-cash': 'Base collect (5 stops)',
    'bonus-cash': '777 bonus — cash locked',
    'seven-upgrade': '777 bonus — 7 upgrades',
    'grand': '777 bonus — GRAND (grid fill)'
  }
  return report.breakdown.map(e => ({
    label: labels[e.entryId] ?? e.entryId,
    probability: e.probability,
    avgPayPerCoin: e.avgPayPerCoin,
    contribution: e.contribution
  }))
}
