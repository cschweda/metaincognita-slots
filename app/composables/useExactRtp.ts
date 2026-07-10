// app/composables/useExactRtp.ts
// Reactive exact-math report for a (possibly changing) machine. Cache hits —
// and the no-Worker sync fallback — fill synchronously (no flash); cold video
// machines fill when the rtp.worker answers. Pass a null def to gate off the
// computation entirely (e.g. floor cards while X-ray is off).
import { ref, watchEffect } from 'vue'
import type { Ref } from 'vue'
import type { ExactRtpReport, MachineDef } from '~/engine'
import type { FloorIntelOptions } from '~/utils/floorIntel'
import { exactRtpAsync, peekExactRtp } from '~/utils/rtpClient'

export function useExactRtp(
  def: () => MachineDef | null,
  opts: () => FloorIntelOptions = () => ({})
): Ref<ExactRtpReport | null> {
  const report = ref<ExactRtpReport | null>(null)
  let token = 0
  watchEffect(() => {
    const d = def()
    const o = opts()
    const t = ++token
    if (d === null) {
      report.value = null
      return
    }
    const promise = exactRtpAsync(d, o)
    // Fallback mode (and warm cache) populate synchronously — re-peek so the
    // first paint already has the number.
    const hit = peekExactRtp(d, o)
    if (hit !== null) {
      report.value = hit
      return
    }
    report.value = null
    void promise.then((r) => {
      if (t === token) report.value = r // stale-token guard on machine switches
    })
  })
  return report
}
