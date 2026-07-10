// Wonder Wheel exact math — 72³ Telnaes enumeration for the line pays plus a
// closed-form topper term. The wheel is a disjoint-by-construction bonus: the
// WHEEL symbol occupies the reel-3 payline cell, so a tuple either arms the
// topper (and may still carry a cherry-count line pay on reels 1–2) or it
// doesn't. At max coins each arming tuple's outcome distribution is
// linePay + Wedge, where Wedge is the fixed-credit weighted draw; under max
// coins the wheel contributes NOTHING — the per-coin RTP ladder printed by
// the PAR sheet is the machine's honest confession.
import type { ExactRtpBreakdownEntry, ExactRtpOptions, ExactRtpReport } from './exactRtp'
import type { SymbolId, WheelMachineDef } from './types'
import { bestStepperAward } from './awards'
import { totalWedgeWeight } from './wheelGame'

function wheelWeights(def: WheelMachineDef): Map<SymbolId, number>[] {
  return def.virtualMaps.map((vmap, r) => {
    const strip = def.physicalStrips[r]!
    const w = new Map<SymbolId, number>()
    for (const idx of vmap) {
      const s = strip[idx]!
      w.set(s, (w.get(s) ?? 0) + 1)
    }
    return w
  })
}

export function wheelExactRtp(def: WheelMachineDef, opts: ExactRtpOptions = {}): ExactRtpReport {
  const coins = opts.coins ?? def.maxCoins
  if (coins < 1 || coins > def.maxCoins) {
    throw new Error(`${def.id}: coins ${coins} out of range 1..${def.maxCoins}`)
  }
  const wheelActive = coins === def.maxCoins

  const weights = wheelWeights(def)
  const totals = weights.map(w => [...w.values()].reduce((a, b) => a + b, 0))
  const denom = totals.reduce((a, b) => a * b, 1)

  const W = totalWedgeWeight(def)
  const eWedgeCredits = def.wedges.reduce((s, w) => s + w.credits * w.weight, 0) / W
  const e2WedgeCredits = def.wedges.reduce((s, w) => s + w.credits * w.credits * w.weight, 0) / W

  const alphabet = weights.map(w => [...w.entries()])
  const line: SymbolId[] = new Array(3).fill('')

  let evNum = 0 // Σ weightProduct × perCoinPay (wedge EV folded into arming tuples)
  let ev2Num = 0 // Σ weightProduct × E[perCoinPay²] (wedge second moment folded)
  let hitNum = 0 // Σ weightProduct over tuples that pay OR arm (feature hits count)
  let armNum = 0 // Σ weightProduct over arming tuples
  const byEntry = new Map<string, { pNum: number, evNum: number }>()

  const tally = (entryId: string, pNum: number, evPerCoin: number): void => {
    const slot = byEntry.get(entryId) ?? { pNum: 0, evNum: 0 }
    slot.pNum += pNum
    slot.evNum += evPerCoin
    byEntry.set(entryId, slot)
  }

  const recurse = (reel: number, weightProduct: number): void => {
    if (reel === 3) {
      const res = bestStepperAward(line, def)
      const linePerCoin = res !== null ? res.payCredits : 0
      const armed = wheelActive && line[2] === def.wheelSymbol
      if (armed) {
        const wedgePerCoin = eWedgeCredits / coins
        // E[(lp + V/coins)²] = lp² + 2·lp·E[V]/coins + E[V²]/coins²
        evNum += weightProduct * (linePerCoin + wedgePerCoin)
        ev2Num += weightProduct * (
          linePerCoin * linePerCoin
          + 2 * linePerCoin * wedgePerCoin
          + e2WedgeCredits / (coins * coins)
        )
        hitNum += weightProduct
        armNum += weightProduct
        if (res !== null) tally(res.entry.id, weightProduct, weightProduct * linePerCoin)
      } else {
        if (linePerCoin > 0) {
          evNum += weightProduct * linePerCoin
          ev2Num += weightProduct * linePerCoin * linePerCoin
          hitNum += weightProduct
          tally(res!.entry.id, weightProduct, weightProduct * linePerCoin)
        }
      }
      return
    }
    for (const [sym, w] of alphabet[reel]!) {
      line[reel] = sym
      recurse(reel + 1, weightProduct * w)
    }
  }
  recurse(0, 1)

  const rtpPerCoin = evNum / denom
  const variancePerCoin = ev2Num / denom - rtpPerCoin * rtpPerCoin
  const hitFrequency = hitNum / denom

  const breakdown: ExactRtpBreakdownEntry[] = [...byEntry.entries()].map(([entryId, s]) => ({
    entryId,
    probability: s.pNum / denom,
    avgPayPerCoin: s.pNum > 0 ? s.evNum / s.pNum : 0,
    contribution: s.evNum / denom
  }))
  if (wheelActive) {
    const pArm = armNum / denom
    for (const wedge of def.wedges) {
      const p = pArm * (wedge.weight / W)
      breakdown.push({
        entryId: `wedge-${wedge.credits}`,
        probability: p,
        avgPayPerCoin: wedge.credits / coins,
        contribution: p * (wedge.credits / coins)
      })
    }
  }
  breakdown.sort((a, b) => b.contribution - a.contribution)

  return { rtpPerCoin, hitFrequency, variancePerCoin, breakdown }
}
