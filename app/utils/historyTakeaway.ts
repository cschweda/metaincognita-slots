// app/utils/historyTakeaway.ts
// The History page's expectation-vs-variance line (guidelines §2.3): what the
// machines' exact edges predicted for the recorded coin-in vs what actually
// happened. Pure sums — the page fetches the edges (rtpClient) and formats.
import type { SpinRecord } from '~/stores/slots'

export interface TakeawaySums {
  wageredCents: number
  /** Σ −(coin-in × edge) over covered rows — negative when the house has an edge */
  expectedNetCents: number
  actualNetCents: number
  coveredRows: number
  /** rows skipped because their machine's edge is unknown (retired machines) */
  excludedRows: number
}

export function edgeKey(machineId: string, coins: number): string {
  return `${machineId}:${coins}`
}

export function takeawaySums(rows: SpinRecord[], edgeByKey: Map<string, number>): TakeawaySums {
  const s: TakeawaySums = { wageredCents: 0, expectedNetCents: 0, actualNetCents: 0, coveredRows: 0, excludedRows: 0 }
  for (const r of rows) {
    const edge = edgeByKey.get(edgeKey(r.machineId, r.coins))
    if (edge === undefined) {
      s.excludedRows++
      continue
    }
    s.coveredRows++
    s.wageredCents += r.coinsInCents
    s.expectedNetCents -= r.coinsInCents * edge
    s.actualNetCents += r.payoutCents - r.coinsInCents
  }
  return s
}
