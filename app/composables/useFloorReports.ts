// app/composables/useFloorReports.ts
// Reactive exact-math reports for the WHOLE floor — the useExactRtp trick
// (call async, immediately re-peek) generalized to a list. Cache-warm and
// no-Worker environments (SSG, vitest) fill synchronously during setup, so
// pages render numbers on first paint; browsers fill from the rtp.worker as
// answers arrive. Computed at each machine's maxCoins (the headline figures).
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { ExactRtpReport } from '~/engine'
import { FLOOR } from '~/machines'
import { exactRtpAsync, peekExactRtp } from '~/utils/rtpClient'

export function useFloorReports(): { reports: Ref<Map<string, ExactRtpReport>>, ready: Ref<boolean> } {
  const reports = ref<Map<string, ExactRtpReport>>(new Map())
  const ready = ref(false)
  const settle = (id: string, r: ExactRtpReport): void => {
    const next = new Map(reports.value)
    next.set(id, r)
    reports.value = next
    if (next.size === FLOOR.length) ready.value = true
  }
  for (const def of FLOOR) {
    const opts = { coins: def.maxCoins }
    const promise = exactRtpAsync(def, opts)
    const hit = peekExactRtp(def, opts) // fallback/warm cache populate synchronously
    if (hit !== null) settle(def.id, hit)
    else void promise.then(r => settle(def.id, r))
  }
  return { reports, ready }
}
