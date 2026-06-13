// app/utils/bankrollSeries.ts
// Reconstruct a running-balance series (in cents) ending at `currentCents`,
// from the per-spin history records (each carries coinsInCents/payoutCents).
import type { SpinRecord } from '~/stores/slots'

export function bankrollSeries(
  history: Pick<SpinRecord, 'coinsInCents' | 'payoutCents'>[],
  currentCents: number,
  window = 30
): number[] {
  const recent = history.slice(-window)
  const out: number[] = [currentCents]
  let bal = currentCents
  for (let i = recent.length - 1; i >= 0; i--) {
    bal -= (recent[i]!.payoutCents - recent[i]!.coinsInCents)
    out.unshift(bal)
  }
  return out
}
