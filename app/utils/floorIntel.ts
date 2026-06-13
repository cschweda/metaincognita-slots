import { exactRtp } from '~/engine'
import type { ExactRtpReport, MachineDef } from '~/engine'

/** Which breakdown entry is "the top award" per machine (for 1-in-x odds). */
const TOP_AWARD_ENTRY: Record<string, string> = {
  'canal-royale': 'li5',
  'dragons-hoard': 'dr5',
  'thunder-vault': 'grand',
  'diamond-doubler': '3dw',
  'sevens-ablaze': '3f7',
  'series-e-3line': 's7x5',
  'series-e-multiplier': 's7x4',
  'stock-rush': 'big'
}

export interface FloorIntel {
  rtp: number
  hitFrequency: number
  /** standard deviation of per-coin pay — the computed volatility figure */
  sdPerCoin: number
  topAwardId: string | null
  topAwardProbability: number | null
}

const cache = new Map<string, FloorIntel>()

export function floorIntel(def: MachineDef, oddsLevel?: number): FloorIntel {
  const key = `${def.id}:${oddsLevel ?? ''}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const report: ExactRtpReport = exactRtp(def, oddsLevel === undefined ? {} : { oddsLevel })
  const topId = TOP_AWARD_ENTRY[def.id] ?? null
  const top = topId === null ? undefined : report.breakdown.find(b => b.entryId === topId)
  const intel: FloorIntel = {
    rtp: report.rtpPerCoin,
    hitFrequency: report.hitFrequency,
    sdPerCoin: Math.sqrt(report.variancePerCoin),
    topAwardId: topId,
    topAwardProbability: top?.probability ?? null
  }
  cache.set(key, intel)
  return intel
}
