import { exactRtp } from '~/engine'
import type { ExactRtpReport, MachineDef } from '~/engine'

export interface FloorIntel {
  rtp: number
  hitFrequency: number
  /** standard deviation of per-coin pay — the computed volatility figure */
  sdPerCoin: number
  topAwardId: string | null
  topAwardProbability: number | null
}

export interface FloorIntelOptions {
  /** pachislo operator level 1..6 */
  oddsLevel?: number
  /**
   * Active line/coin count. For 'lines' machines (Bally lines, selectable-line
   * video) the per-spin hit frequency and volatility depend on this; RTP/coin
   * does not. Omit to use the machine's maxCoins (the headline figure).
   */
  coins?: number
}

/** Derive the floor-card figures from an already-computed report. */
export function intelFromReport(def: MachineDef, report: ExactRtpReport): FloorIntel {
  const topId = def.topAwardEntryId ?? null
  const top = topId === null ? undefined : report.breakdown.find(b => b.entryId === topId)
  return {
    rtp: report.rtpPerCoin,
    hitFrequency: report.hitFrequency,
    sdPerCoin: Math.sqrt(report.variancePerCoin),
    topAwardId: topId,
    topAwardProbability: top?.probability ?? null
  }
}

const cache = new Map<string, FloorIntel>()

/**
 * Sync intel (tests, SSG, cheap one-offs). The interactive hot paths use
 * useExactRtp + intelFromReport instead so video-family enumeration runs in
 * the rtp.worker, off the main thread.
 */
export function floorIntel(def: MachineDef, opts: FloorIntelOptions = {}): FloorIntel {
  const key = `${def.id}:${opts.oddsLevel ?? ''}:${opts.coins ?? ''}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const report: ExactRtpReport = exactRtp(def, {
    ...(opts.oddsLevel === undefined ? {} : { oddsLevel: opts.oddsLevel }),
    ...(opts.coins === undefined ? {} : { coins: opts.coins })
  })
  const intel = intelFromReport(def, report)
  cache.set(key, intel)
  return intel
}
