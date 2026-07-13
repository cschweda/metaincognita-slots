// app/utils/bankrollSeries.ts
// Reconstruct a running-balance series (in cents) ending at `currentCents`,
// from the per-spin history records (each carries coinsInCents/payoutCents),
// tagging every point with what that spin actually did to the bankroll.
import type { SpinRecord } from '~/stores/slots'

type Booked = Pick<SpinRecord, 'coinsInCents' | 'payoutCents'>

/**
 * What a spin did to the BANKROLL — which is not what the machine called it:
 *
 *  - `win`   the bankroll rose: the pay beat the bet.
 *  - `ldw`   the machine paid, and the bankroll did NOT rise — a pay under the
 *            bet (or exactly the bet handed back). The cabinet still sings and
 *            flashes. This is the loss-disguised-as-a-win that
 *            /learn/ldw-near-miss exists to expose, so it gets its own colour
 *            rather than hiding inside "win".
 *  - `loss`  no pay at all.
 */
export type SpinKind = 'win' | 'ldw' | 'loss'

export interface SeriesPoint {
  cents: number
  /** null on the leading point: it is a balance to draw from, not a spin. */
  kind: SpinKind | null
}

export function spinKind(rec: Booked): SpinKind {
  if (rec.payoutCents - rec.coinsInCents > 0) return 'win'
  return rec.payoutCents > 0 ? 'ldw' : 'loss'
}

export function bankrollSeries(
  history: Booked[],
  currentCents: number,
  window = 30
): SeriesPoint[] {
  const recent = history.slice(-window)
  const out: SeriesPoint[] = []
  let bal = currentCents
  for (let i = recent.length - 1; i >= 0; i--) {
    const rec = recent[i]!
    out.unshift({ cents: bal, kind: spinKind(rec) })
    bal -= rec.payoutCents - rec.coinsInCents
  }
  // the balance the run started from — no spin landed on it, so it takes no dot
  out.unshift({ cents: bal, kind: null })
  return out
}
