import type { ExactRtpBreakdownEntry, ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { SymbolId, VideoMachineDef } from './types'

/**
 * Exact video math.
 *
 * RTP comes from closed forms over strip statistics; hit frequency and
 * variance need the joint distribution across reels, so the COMPLETE cycle is
 * enumerated — strips are 24 cells, 24^5 = 7,962,624 equally likely states —
 * accumulating integer sums (every accumulator stays far below 2^53: the
 * dominant sumB2 term is E[B^2]*24^5 ~ 6e10). Feature moments fold in
 * analytically:
 *  - free spins, no retrigger:  S = sum of `count` i.i.d. spins at x`mult`
 *  - free spins with retrigger: branching process, E[S] via Wald
 *      E[S]  = n*m*E[B] / (1 - n*q)
 *      E[S2] = (n*m^2*E[B2] + 2n*m*E[B*1tr]*E[S] + n(n-1)*E[C]^2) / (1 - n*q)
 *      where C = one batch member's subtree value, E[C] = m*E[B] + q*E[S]
 *  - hold-and-spin: absorbing Markov chain over (locked k, respins r);
 *      E[F|T=t] and E[F^2|T=t] from the final-count distribution and the
 *      orb-value moments; cross terms use E[B*1(T=t)] from the joint pass.
 * Results are memoized per (machine, coins, meter): the joint pass costs
 * seconds, and tests/PAR sheets call it repeatedly.
 */

interface JointAccumulators {
  denom: number
  anyWinOrTrigger: number
  sumB: number
  sumB2: number
  sumBTrig: number
  nTrig: number
  tCounts: number[]
  sumBT: number[]
}

function jointCycle(def: VideoMachineDef, coins: number): JointAccumulators {
  const L = def.strips[0]!.length
  const reels = def.strips.length
  const symIds = new Map<SymbolId, number>()
  for (const s of Object.keys(def.symbols)) symIds.set(s, symIds.size)
  const wildId = def.wildSymbol === null ? -1 : symIds.get(def.wildSymbol)!
  const nSym = symIds.size

  const payLut = new Int32Array(nSym * 6)
  for (const e of def.paytable) {
    if (!Number.isInteger(e.pay)) {
      throw new Error(`${def.id ?? 'video def'}: paytable pays must be integers (got ${e.pay})`)
    }
    payLut[symIds.get(e.symbol)! * 6 + e.length] = e.pay
  }

  // per-reel per-cell window data
  const rowSym: Int32Array[][] = []
  const scFlag: Int32Array[] = []
  const orbCnt: Int32Array[] = []
  const waysCnt: Int32Array[][] = []
  for (let r = 0; r < reels; r++) {
    const strip = def.strips[r]!
    const rows = [new Int32Array(L), new Int32Array(L), new Int32Array(L)]
    const sc = new Int32Array(L)
    const orb = new Int32Array(L)
    const wc: Int32Array[] = []
    for (let s = 0; s < nSym; s++) wc.push(new Int32Array(L))
    for (let c = 0; c < L; c++) {
      for (let row = 0; row < 3; row++) {
        const sym = strip[(c + row) % L]!
        const id = symIds.get(sym)!
        rows[row]![c] = id
        if (def.scatter !== null && sym === def.scatter.symbol) sc[c] = 1
        if (def.holdAndSpin !== null && sym === def.holdAndSpin.orbSymbol) orb[c]!++
        for (let s = 0; s < nSym; s++) {
          if (id === s || id === wildId) wc[s]![c]!++
        }
      }
    }
    rowSym.push(rows)
    scFlag.push(sc)
    orbCnt.push(orb)
    waysCnt.push(wc)
  }

  const lines = def.betMode.kind === 'lines' ? def.betMode.lines.slice(0, coins) : []
  const lineRow: Int32Array[] = lines.map((pat) => {
    // resolve each line to its per-reel row LUT pointer index (0..2)
    return Int32Array.from(pat)
  })
  const payingSymIds = [...new Set(def.paytable.map(e => symIds.get(e.symbol)!))]
  const scPay = new Int32Array(reels + 1)
  if (def.scatter !== null) {
    for (const [k, p] of Object.entries(def.scatter.pays)) {
      if (!Number.isInteger(p)) {
        throw new Error(`${def.id ?? 'video def'}: scatter pays must be integers (got ${p})`)
      }
      scPay[Number(k)] = p * coins
    }
  }
  const scTrig = def.scatter?.triggerCount ?? 99
  const orbTrig = def.holdAndSpin?.triggerCount ?? 99

  const acc: JointAccumulators = {
    denom: L ** reels, anyWinOrTrigger: 0, sumB: 0, sumB2: 0,
    sumBTrig: 0, nTrig: 0, tCounts: new Array(16).fill(0), sumBT: new Array(16).fill(0)
  }
  const cs = [0, 0, 0, 0, 0]
  for (let c1 = 0; c1 < L; c1++) {
    cs[0] = c1
    for (let c2 = 0; c2 < L; c2++) {
      cs[1] = c2
      for (let c3 = 0; c3 < L; c3++) {
        cs[2] = c3
        for (let c4 = 0; c4 < L; c4++) {
          cs[3] = c4
          for (let c5 = 0; c5 < L; c5++) {
            cs[4] = c5
            let B = 0
            if (lines.length > 0) {
              for (let li = 0; li < lineRow.length; li++) {
                const pat = lineRow[li]!
                const a = rowSym[0]![pat[0]!]![c1]!
                let run = 1
                for (let r = 1; r < reels; r++) {
                  const id = rowSym[r]![pat[r]!]![cs[r]!]!
                  if (id === a || id === wildId) run++
                  else break
                }
                B += payLut[a * 6 + run]!
              }
            } else {
              for (const s of payingSymIds) {
                let run = 0
                let ways = 1
                for (let r = 0; r < reels; r++) {
                  const n = waysCnt[r]![s]![cs[r]!]!
                  if (n === 0) break
                  run++
                  ways *= n
                }
                if (run >= 3) B += payLut[s * 6 + run]! * ways
              }
            }
            let K = 0
            if (def.scatter !== null) {
              for (let r = 0; r < reels; r++) K += scFlag[r]![cs[r]!]!
            }
            B += scPay[K]!
            let T = 0
            if (def.holdAndSpin !== null) {
              for (let r = 0; r < reels; r++) T += orbCnt[r]![cs[r]!]!
            }
            const trig = K >= scTrig || T >= orbTrig
            if (B > 0 || trig) acc.anyWinOrTrigger++
            acc.sumB += B
            acc.sumB2 += B * B
            if (K >= scTrig) {
              acc.sumBTrig += B
              acc.nTrig++
            }
            if (def.holdAndSpin !== null) {
              acc.tCounts[T]!++
              acc.sumBT[T]! += B
            }
          }
        }
      }
    }
  }
  return acc
}

/** binomial pmf table for n trials at probability p */
function binomPmf(n: number, p: number): number[] {
  const out: number[] = []
  let c = 1
  for (let j = 0; j <= n; j++) {
    out.push(c * p ** j * (1 - p) ** (n - j))
    c = (c * (n - j)) / (j + 1)
  }
  return out
}

/**
 * Final locked-count distribution of the hold-and-spin chain from t locked
 * orbs with `respins` fresh respins; each respin every unlocked cell lands an
 * orb with probability numer/denom; any new orb resets the counter.
 */
export function hnsFinalDist(t: number, numer: number, denom: number, respins: number): Map<number, number> {
  const p = numer / denom
  const memo = new Map<string, Map<number, number>>()
  const dist = (k: number, r: number): Map<number, number> => {
    const key = `${k}:${r}`
    const hit = memo.get(key)
    if (hit !== undefined) return hit
    const out = new Map<number, number>()
    if (k === 15 || r === 0) {
      out.set(k, 1)
      memo.set(key, out)
      return out
    }
    const pmf = binomPmf(15 - k, p)
    for (let j = 0; j <= 15 - k; j++) {
      const pj = pmf[j]!
      if (pj === 0) continue
      const sub = j === 0 ? dist(k, r - 1) : dist(k + j, respins)
      for (const [kk, pk] of sub) out.set(kk, (out.get(kk) ?? 0) + pj * pk)
    }
    memo.set(key, out)
    return out
  }
  return dist(t, respins)
}

interface LineEntryStat {
  entryId: string
  pay: number
  probPerLine: number
}

/** Exact per-line entry probabilities by recursion over strip compositions. */
function lineEntryStats(def: VideoMachineDef): LineEntryStat[] {
  const L = def.strips[0]!.length
  const comps = def.strips.map((strip) => {
    const m = new Map<SymbolId, number>()
    for (const s of strip) m.set(s, (m.get(s) ?? 0) + 1)
    return [...m.entries()]
  })
  const denom = L ** def.strips.length
  const probs = new Map<string, number>()
  const rec = (reel: number, anchor: SymbolId | null, run: number, alive: boolean, w: number) => {
    if (reel === def.strips.length) {
      if (anchor === null) return
      const entry = def.paytable.find(e => e.symbol === anchor && e.length === run)
      if (entry !== undefined) probs.set(entry.id, (probs.get(entry.id) ?? 0) + w / denom)
      return
    }
    for (const [sym, cnt] of comps[reel]!) {
      if (reel === 0) {
        rec(1, sym, 1, true, w * cnt)
      } else if (alive && (sym === anchor || sym === def.wildSymbol)) {
        rec(reel + 1, anchor, run + 1, true, w * cnt)
      } else {
        rec(reel + 1, anchor, run, false, w * cnt)
      }
    }
  }
  rec(0, null, 0, false, 1)
  return def.paytable.map(e => ({ entryId: e.id, pay: e.pay, probPerLine: probs.get(e.id) ?? 0 }))
}

interface WaysEntryStat {
  entryId: string
  probability: number
  contributionCredits: number
}

/** Exact ways stats from window means (mu) and vacancies (z) per symbol/reel. */
function waysEntryStats(def: VideoMachineDef): WaysEntryStat[] {
  const L = def.strips[0]!.length
  const out: WaysEntryStat[] = []
  const seen = new Set<SymbolId>()
  for (const probe of def.paytable) {
    if (seen.has(probe.symbol)) continue
    seen.add(probe.symbol)
    const mu: number[] = []
    const z: number[] = []
    for (const strip of def.strips) {
      let total = 0
      let zero = 0
      for (let c = 0; c < L; c++) {
        let n = 0
        for (let row = 0; row < 3; row++) {
          const sym = strip[(c + row) % L]!
          if (sym === probe.symbol || sym === def.wildSymbol) n++
        }
        total += n
        if (n === 0) zero++
      }
      mu.push(total / L)
      z.push(zero / L)
    }
    for (const e of def.paytable) {
      if (e.symbol !== probe.symbol) continue
      let muProd = 1
      let pProd = 1
      for (let r = 0; r < e.length; r++) {
        muProd *= mu[r]!
        pProd *= 1 - z[r]!
      }
      const tail = e.length < def.strips.length ? z[e.length]! : 1
      out.push({
        entryId: e.id,
        probability: pProd * tail,
        contributionCredits: e.pay * muProd * tail
      })
    }
  }
  return out
}

/** Poisson-binomial over the reels that carry the scatter. */
function scatterDist(def: VideoMachineDef): number[] {
  const L = def.strips[0]!.length
  let d = [1]
  if (def.scatter === null) return d
  for (const strip of def.strips) {
    let visible = 0
    for (let c = 0; c < L; c++) {
      let any = false
      for (let row = 0; row < 3; row++) {
        if (strip[(c + row) % L] === def.scatter.symbol) any = true
      }
      if (any) visible++
    }
    const p = visible / L
    const nd = new Array<number>(d.length + 1).fill(0)
    for (let k = 0; k < d.length; k++) {
      nd[k]! += d[k]! * (1 - p)
      nd[k + 1]! += d[k]! * p
    }
    d = nd
  }
  return d
}

const cache = new Map<string, ExactRtpReport>()

export function videoExactRtp(def: VideoMachineDef, opts: ExactRtpOptions): ExactRtpReport {
  const coins = def.betMode.kind === 'lines' && !def.fixedBet
    ? (opts.coins ?? def.maxCoins)
    : def.maxCoins
  if (!Number.isInteger(coins) || coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }
  if (def.fixedBet && opts.coins !== undefined && opts.coins !== def.maxCoins) {
    throw new Error(`${def.id}: fixed bet machine requires ${def.maxCoins} coins`)
  }
  const meter = opts.progressiveValues?.meter ?? def.progressive?.reset ?? 0
  const key = `${def.id}:${coins}:${meter}`
  const cached = cache.get(key)
  if (cached !== undefined) return cached

  const bet = coins
  const acc = jointCycle(def, coins)
  const EB = acc.sumB / acc.denom
  const EB2 = acc.sumB2 / acc.denom
  const EBtr = acc.sumBTrig / acc.denom
  const ptr = acc.nTrig / acc.denom
  const varB = EB2 - EB * EB

  let EX = EB
  let EX2 = EB2
  const breakdown: ExactRtpBreakdownEntry[] = []

  // base-game breakdown (closed forms — also a cross-check on the joint pass)
  let closedBaseCredits = 0
  if (def.betMode.kind === 'lines') {
    for (const s of lineEntryStats(def)) {
      if (s.probPerLine === 0) continue
      const probability = s.probPerLine * coins
      const contribution = probability * (s.pay / bet)
      closedBaseCredits += probability * s.pay
      breakdown.push({ entryId: s.entryId, probability, avgPayPerCoin: s.pay / bet, contribution })
    }
  } else {
    for (const s of waysEntryStats(def)) {
      if (s.probability === 0) continue
      closedBaseCredits += s.contributionCredits
      breakdown.push({
        entryId: s.entryId,
        probability: s.probability,
        avgPayPerCoin: s.contributionCredits / s.probability / bet,
        contribution: s.contributionCredits / bet
      })
    }
  }
  const scD = scatterDist(def)
  if (def.scatter !== null) {
    for (const [k, pay] of Object.entries(def.scatter.pays)) {
      const p = scD[Number(k)] ?? 0
      if (p === 0) continue
      closedBaseCredits += p * pay * bet
      breakdown.push({ entryId: `sc${k}`, probability: p, avgPayPerCoin: pay, contribution: p * pay })
    }
  }
  if (Math.abs(closedBaseCredits - EB) > 1e-9 * Math.max(1, EB)) {
    throw new Error(`${def.id}: joint pass disagrees with closed forms: ${EB} vs ${closedBaseCredits}`)
  }

  if (def.freeSpins !== null) {
    const n = def.freeSpins.count
    const m = def.freeSpins.multiplier
    let ES: number
    let ES2: number
    if (!def.freeSpins.retrigger) {
      ES = n * m * EB
      ES2 = n * m * m * varB + ES * ES
    } else {
      const q = ptr
      if (n * q >= 1) {
        throw new Error(`${def.id}: free-spin retrigger is supercritical (n*q = ${n * q} >= 1)`)
      }
      ES = (n * m * EB) / (1 - n * q)
      const EC = m * EB + q * ES
      ES2 = (n * m * m * EB2 + 2 * n * m * EBtr * ES + n * (n - 1) * EC * EC) / (1 - n * q)
    }
    EX = EB + ptr * ES
    EX2 = EB2 + 2 * EBtr * ES + ptr * ES2
    breakdown.push({
      entryId: 'free-spins',
      probability: ptr,
      avgPayPerCoin: ptr > 0 ? (ptr * ES) / ptr / bet : 0,
      contribution: (ptr * ES) / bet
    })
  }

  if (def.holdAndSpin !== null) {
    const cfg = def.holdAndSpin
    const wsum = cfg.orbValues.reduce((s, e) => s + e.weight, 0)
    const muV = cfg.orbValues.reduce((s, e) => s + e.credits * e.weight, 0) / wsum
    const m2V = cfg.orbValues.reduce((s, e) => s + e.credits * e.credits * e.weight, 0) / wsum
    const varV = m2V - muV * muV
    let featEV = 0
    let pTrigger = 0
    let pFill = 0
    for (let t = cfg.triggerCount; t <= 15; t++) {
      const pt = acc.tCounts[t]! / acc.denom
      if (pt === 0) continue
      const kd = hnsFinalDist(t, cfg.respinOrbNumer, cfg.respinOrbDenom, cfg.respins)
      let EFt = 0
      let EFt2 = 0
      for (const [k, pk] of kd) {
        const g = k === 15 ? meter : 0
        const mean = k * muV + g
        EFt += pk * mean
        EFt2 += pk * (k * varV + mean * mean)
      }
      EX += pt * EFt
      EX2 += 2 * (acc.sumBT[t]! / acc.denom) * EFt + pt * EFt2
      featEV += pt * EFt
      pTrigger += pt
      pFill += pt * (kd.get(15) ?? 0)
    }
    const grandSlice = pFill * meter
    breakdown.push({
      entryId: 'hold-and-spin',
      probability: pTrigger,
      avgPayPerCoin: pTrigger > 0 ? (featEV - grandSlice) / pTrigger / bet : 0,
      contribution: (featEV - grandSlice) / bet
    })
    breakdown.push({
      entryId: 'grand',
      probability: pFill,
      avgPayPerCoin: pFill > 0 ? meter / bet : 0,
      contribution: grandSlice / bet
    })
  }

  const report: ExactRtpReport = {
    rtpPerCoin: EX / bet,
    hitFrequency: acc.anyWinOrTrigger / acc.denom,
    variancePerCoin: (EX2 - EX * EX) / (bet * bet),
    breakdown: breakdown.sort((a, b) => b.contribution - a.contribution)
  }
  cache.set(key, report)
  return report
}
