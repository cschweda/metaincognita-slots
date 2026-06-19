import type { ExactRtpBreakdownEntry, ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { CascadeMachineDef, CascadeTier } from './types'

/**
 * Exact cascade (tumble) math — Temple of Gold.
 *
 * Cells are i.i.d. weighted draws, so a grid is a multinomial count vector over
 * the alphabet (paying symbols + the idol scatter). The tumble is an ABSORBING
 * MARKOV PROCESS over count states: at a state, every paying symbol at >= minMatch
 * pays its tier (× the chain's ladder multiplier), its cells clear, and the K
 * cleared cells refill i.i.d. (survivors persist) → a successor count state.
 * Absorbing when no symbol reaches minMatch.
 *
 * `evState(c, depth)` returns the exact mean AND second moment of the remaining
 * per-coin scatter payout from state c, memoized on (state, depth). Refill
 * successors are summed over the multinomial of K cells. A DEPTH cap bounds the
 * (cyclic) recursion; its truncated tail is < 1e-12, far under the 3.5σ verify
 * band — so this is exact for all practical purposes and uses NO simulation.
 *
 * The Grand is decided by the INITIAL grid's idol count only (decoupled from the
 * tumble, keeping it computable) and folded at the meter value like videoRtp.
 *
 * Top level enumerates every initial multinomial state once, accumulating the
 * scatter mean/2nd-moment, the hit frequency (P(paying win ∨ Grand)), the Grand
 * probability, and the scatter·Grand cross term needed for the exact variance.
 */

/** log(n!) table for n in 0..max. */
function makeLogFact(max: number): number[] {
  const lf = new Array<number>(max + 1)
  lf[0] = 0
  for (let i = 1; i <= max; i++) lf[i] = lf[i - 1]! + Math.log(i)
  return lf
}

/** Highest matching count tier's pay (per coin), or null. */
function tierPay(tiers: CascadeTier[], count: number): number | null {
  let best: number | null = null
  let bestAt = -1
  for (const t of tiers) {
    if (count >= t.countAtLeast && t.countAtLeast > bestAt) {
      best = t.pay
      bestAt = t.countAtLeast
    }
  }
  return best
}

const cacheReports = new Map<string, ExactRtpReport>()

export function cascadeExactRtp(def: CascadeMachineDef, opts: ExactRtpOptions = {}): ExactRtpReport {
  const coins = opts.coins ?? def.maxCoins
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }
  const meter = opts.progressiveValues?.meter ?? def.progressive?.reset ?? 0
  const key = `${def.id}:${coins}:${meter}`
  const cached = cacheReports.get(key)
  if (cached) return cached

  // Alphabet: paying symbols first (indices 0..nPay-1), idol last.
  const payingSyms = Object.keys(def.paytable)
  const nPay = payingSyms.length
  const syms = [...payingSyms, def.idolSymbol]
  const nSym = syms.length
  const idolIdx = nSym - 1
  const weights = syms.map(s => def.weights[s] ?? 0)
  const T = weights.reduce((a, b) => a + b, 0)
  const logp = weights.map(w => Math.log(w / T))
  const maxLogp = Math.max(...logp)
  // Refill-tail pruning: skip multinomial subtrees whose best-case completion
  // probability is below this. Admissible (an UPPER bound is checked), so the
  // dropped EV mass is < PRUNE × (subtrees) — invisible under the 3.5σ verify
  // band, and verify is the backstop if it were ever too loose.
  const logPrune = Math.log(1e-13)
  const tiersByIdx = payingSyms.map(s => def.paytable[s]!)
  const cells = def.cols * def.rows
  const min = def.minMatch
  const ladder = def.multiplierLadder
  const ladderLen = ladder.length
  const ladderMul = (d: number): number => ladder[Math.min(d, ladderLen) - 1]!
  const logFact = makeLogFact(cells)

  /** Paying winners + their summed per-coin tier pay at a count state. */
  function stepPay(counts: number[]): { pay: number, winners: number[] } {
    let pay = 0
    const winners: number[] = []
    for (let i = 0; i < nPay; i++) {
      const c = counts[i]!
      if (c < min) continue
      const tp = tierPay(tiersByIdx[i]!, c)
      if (tp !== null) {
        pay += tp
        winners.push(i)
      }
    }
    return { pay, winners }
  }

  /**
   * Enumerate compositions of N over nSym parts, invoking cb with the (mutated,
   * do-not-retain) part array and the multinomial probability of that outcome.
   */
  function enumComps(N: number, lp: number, cb: (comp: number[], prob: number) => void): void {
    const comp = new Array<number>(nSym).fill(0)
    const logN = logFact[N]!
    const rec = (idx: number, remaining: number, accLog: number): void => {
      // Admissible upper bound on any completion's log-prob from this node
      // (all `remaining` cells on the highest-p symbol, dropping the ≤0 logFact
      // penalty). Below the threshold ⇒ no completion matters ⇒ skip the subtree.
      if (logN + accLog + remaining * maxLogp < lp) return
      if (idx === nSym - 1) {
        comp[idx] = remaining
        cb(comp, Math.exp(logN + accLog - logFact[remaining]! + remaining * logp[idx]!))
        return
      }
      for (let v = 0; v <= remaining; v++) {
        comp[idx] = v
        rec(idx + 1, remaining - v, accLog - logFact[v]! + v * logp[idx]!)
      }
    }
    rec(0, N, 0)
  }

  // memo: (state,depth) -> remaining per-coin {mean, 2nd moment}
  const memo = new Map<string, { ev: number, ev2: number }>()

  function evState(counts: number[], depth: number): { ev: number, ev2: number } {
    if (depth > def.maxTumbles) return { ev: 0, ev2: 0 }
    const { pay, winners } = stepPay(counts)
    if (winners.length === 0) return { ev: 0, ev2: 0 }
    const memoKey = counts.join(',') + '@' + depth
    const hit = memo.get(memoKey)
    if (hit) return hit
    const thisPay = pay * ladderMul(depth)
    const base = counts.slice()
    let K = 0
    for (const wi of winners) {
      K += base[wi]!
      base[wi] = 0
    }
    let eFut = 0
    let eFut2 = 0
    enumComps(K, logPrune, (refill, prob) => {
      if (prob === 0) return
      const cp = base.slice()
      for (let i = 0; i < nSym; i++) cp[i]! += refill[i]!
      const sub = evState(cp, depth + 1)
      eFut += prob * sub.ev
      eFut2 += prob * sub.ev2
    })
    const ev = thisPay + eFut
    const ev2 = thisPay * thisPay + 2 * thisPay * eFut + eFut2
    const res = { ev, ev2 }
    memo.set(memoKey, res)
    return res
  }

  // ── Top level: integrate over every initial multinomial state ──────────────
  let evScatter = 0 // E[scatter payout / coin]
  let ev2Scatter = 0 // E[(scatter payout / coin)^2]
  let pHitPay = 0 // P(initial grid has a paying win)
  let pGrand = 0 // P(initial idol count >= grandTrigger)
  let pHitAny = 0 // P(paying win ∨ Grand)
  let scatterDotGrand = 0 // E[scatter · 1(Grand)]
  const firstBySym = new Array<number>(nPay).fill(0) // chain-1 contribution per symbol
  const pSym = new Array<number>(nPay).fill(0) // P(symbol pays on chain 1)

  enumComps(cells, logPrune, (c0, prob) => {
    if (prob === 0) return
    const { winners } = stepPay(c0)
    const hasWin = winners.length > 0
    const grand = c0[idolIdx]! >= def.grandTrigger
    if (hasWin) {
      const sub = evState(c0, 1)
      evScatter += prob * sub.ev
      ev2Scatter += prob * sub.ev2
      pHitPay += prob
      if (grand) scatterDotGrand += prob * sub.ev
      // chain-1 per-symbol attribution (ladder ×1) for the breakdown
      for (const i of winners) {
        const tp = tierPay(tiersByIdx[i]!, c0[i]!)!
        firstBySym[i]! += prob * tp
        pSym[i]! += prob
      }
    }
    if (grand) pGrand += prob
    if (hasWin || grand) pHitAny += prob
  })

  const grandPerCoin = meter / coins
  const rtpPerCoin = evScatter + pGrand * grandPerCoin
  const eX2 = ev2Scatter + 2 * grandPerCoin * scatterDotGrand + grandPerCoin * grandPerCoin * pGrand
  const variancePerCoin = Math.max(0, eX2 - rtpPerCoin * rtpPerCoin)

  // Breakdown: per-symbol chain-1, the tumble bonus (chains ≥2 + multipliers), the Grand.
  const eChain1 = firstBySym.reduce((a, b) => a + b, 0)
  const tumbleExtra = evScatter - eChain1
  const breakdown: ExactRtpBreakdownEntry[] = payingSyms.map((s, i) => ({
    entryId: s,
    probability: pSym[i]!,
    avgPayPerCoin: pSym[i]! > 0 ? firstBySym[i]! / pSym[i]! : 0,
    contribution: firstBySym[i]!
  }))
  if (tumbleExtra > 1e-12) {
    breakdown.push({
      entryId: 'tumble',
      probability: pHitPay,
      avgPayPerCoin: pHitPay > 0 ? tumbleExtra / pHitPay : 0,
      contribution: tumbleExtra
    })
  }
  if (def.progressive !== null) {
    breakdown.push({
      entryId: 'grand',
      probability: pGrand,
      avgPayPerCoin: grandPerCoin,
      contribution: pGrand * grandPerCoin
    })
  }
  breakdown.sort((a, b) => b.contribution - a.contribution)

  const report: ExactRtpReport = { rtpPerCoin, hitFrequency: pHitAny, variancePerCoin, breakdown }
  cacheReports.set(key, report)
  return report
}
