import type { ExactRtpBreakdownEntry, ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { PachisloMachineDef } from './types'
import { linesThroughRow } from './pachislo'

/**
 * Closed-form pachislo math (renewal-reward over lottery draws). Flags are
 * never lost, so every drawn flag contributes its full value exactly once and
 * player timing cancels out of the long-run quotient:
 *   RTP = OUT / IN
 *   OUT = sum of p_flag x flagValue        (replay's value sits in IN)
 *   IN  = tokens x (1 - p_replay) + p_reg x regIn + p_big x bigIn
 */

export interface InterludeMoments {
  eBells: number
  eBells2: number
  eGames: number
}

export function interludeMoments(def: PachisloMachineDef): InterludeMoments {
  const cfg = def.interlude
  const w = cfg.bellWeight / cfg.weightDenom
  const e = cfg.endWeight / cfg.weightDenom
  const rho = w / (w + e)
  const cap = cfg.maxBells
  let eBells = 0
  let eBells2 = 0
  let eEvents = 0
  for (let k = 0; k < cap; k++) {
    const p = rho ** k * (1 - rho)
    eBells += k * p
    eBells2 += k * k * p
    eEvents += (k + 1) * p
  }
  const pCap = rho ** cap
  eBells += cap * pCap
  eBells2 += cap * cap * pCap
  eEvents += cap * pCap
  return { eBells, eBells2, eGames: eEvents / (w + e) }
}

export interface PachisloBonusValues {
  regOut: number
  regIn: number
  bigOut: number
  bigIn: number
  /** hard ceiling: every payout at 15 tokens, both interludes capped */
  bigMaxOut: number
}

export function pachisloBonusValues(def: PachisloMachineDef): PachisloBonusValues {
  const m = interludeMoments(def)
  const jacOut = def.jac.perRound * def.jac.pay
  const jacIn = def.jac.perRound * def.jac.cost
  const interludes = def.bigRounds - 1
  return {
    regOut: def.pays.bonusLined + jacOut,
    regIn: jacIn,
    bigOut: def.pays.bonusLined + def.bigRounds * jacOut + interludes * m.eBells * def.interlude.bellPay,
    bigIn: def.bigRounds * jacIn + interludes * m.eGames * def.interlude.cost,
    bigMaxOut: def.pays.bonusLined + def.bigRounds * jacOut
      + interludes * def.interlude.maxBells * def.interlude.bellPay
  }
}

export function pachisloExactRtp(def: PachisloMachineDef, opts: ExactRtpOptions = {}): ExactRtpReport {
  const tokens = opts.coins ?? def.maxCoins
  if (tokens !== def.maxCoins) {
    throw new Error(`${def.id}: exact RTP is defined at exactly ${def.maxCoins} tokens in v0.2`)
  }
  const level = opts.oddsLevel ?? def.defaultOddsLevel
  if (!Number.isInteger(level) || level < 1 || level > def.oddsLevels.length) {
    throw new Error(`${def.id}: oddsLevel ${level} out of range 1..${def.oddsLevels.length}`)
  }
  const rates = def.oddsLevels[level - 1]!
  const D = 16384
  const pChRow = def.baseRates.cherryPerRow / D
  const pCh = 3 * pChRow
  const pWm = def.baseRates.watermelon / D
  const pBell = rates.bell / D
  const pRp = def.baseRates.replay / D
  const pReg = rates.reg / D
  const pBig = rates.big / D

  // cherry value: the flag picks the row uniformly; pay = perLine x lines through it
  let eCh = 0
  let eCh2 = 0
  for (const row of [0, 1, 2]) {
    const pay = def.pays.cherryPerLine * linesThroughRow(row, tokens)
    eCh += pay / 3
    eCh2 += pay * pay / 3
  }

  const b = pachisloBonusValues(def)
  const m = interludeMoments(def)

  const OUT = pCh * eCh + pWm * def.pays.watermelon + pBell * def.pays.bell
    + pReg * b.regOut + pBig * b.bigOut
  const IN = tokens * (1 - pRp) + pReg * b.regIn + pBig * b.bigIn
  const rtpPerCoin = OUT / IN
  const hitFrequency = pCh + pWm + pBell + pRp + pReg + pBig

  // attribution variance (descriptive volatility; convergence uses block SE)
  const interludes = def.bigRounds - 1
  const sumBase = def.pays.bonusLined + def.bigRounds * def.jac.perRound * def.jac.pay
  const eS = interludes * m.eBells
  const eS2 = interludes * (m.eBells2 - m.eBells ** 2) + eS * eS
  const eBig2 = sumBase * sumBase + 2 * sumBase * def.interlude.bellPay * eS
    + def.interlude.bellPay ** 2 * eS2
  const EX2 = pCh * eCh2 + pWm * def.pays.watermelon ** 2 + pBell * def.pays.bell ** 2
    + pReg * b.regOut ** 2 + pBig * eBig2
  const variancePerCoin = (EX2 - OUT * OUT) / (tokens * tokens)

  const entry = (entryId: string, p: number, out: number): ExactRtpBreakdownEntry => ({
    entryId,
    probability: p,
    /** for pachislo: the flag's full value per renewal token (out/IN), so
     * probability x avgPayPerCoin = contribution and contributions sum to RTP */
    avgPayPerCoin: p > 0 ? out / IN : 0,
    contribution: p * out / IN
  })
  const breakdown = [
    entry('cherry', pCh, eCh),
    entry('watermelon', pWm, def.pays.watermelon),
    entry('bell', pBell, def.pays.bell),
    entry('replay', pRp, 0),
    entry('reg', pReg, b.regOut),
    entry('big', pBig, b.bigOut)
  ].sort((a, c) => c.contribution - a.contribution)

  return { rtpPerCoin, hitFrequency, variancePerCoin, breakdown }
}
