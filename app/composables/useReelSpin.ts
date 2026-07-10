// app/composables/useReelSpin.ts
import { computed, onUnmounted, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReducedMotion } from '~/composables/useReducedMotion'
import { voiceFor } from '~/utils/soundBank'

export const REEL_CELL_PX = 96
export const REEL_GAP_PX = 8
const STRIDE = REEL_CELL_PX + REEL_GAP_PX
const BUFFER = 16 // filler cells above the landing window

export interface ReelSpinOptions {
  reelCount: () => number // getter so a late/changed def is tracked reactively
  visibleRows: number
  grid: () => string[][] // resolved visible grid [reel][row]
  filler: () => string[] // candidate ids shown while spinning
}

export function useReelSpin(opts: ReelSpinOptions) {
  const store = useSlotsStore()
  const reduced = useReducedMotion()

  // The cabinet's period voice (silent for cascade/parked): reel thunks and
  // the payout-scaled reveal ride the SAME timers as the visuals.
  const voice = computed(() => voiceFor(store.currentDef?.family ?? 'cascade'))
  function revealSound() {
    const def = store.currentDef
    if (def !== null && store.lastOutcome !== null) voice.value.reveal(def, store.lastOutcome)
  }

  // Filler shown above the landing window; empty when settled (strips === grid).
  const buffer = ref<string[][]>([])
  const offsetY = ref<number[]>(Array(opts.reelCount()).fill(0))
  const blur = ref<number[]>(Array(opts.reelCount()).fill(0))
  const durationMs = ref<number[]>(Array(opts.reelCount()).fill(0))
  const revealed = ref(opts.reelCount())
  let timers: ReturnType<typeof setTimeout>[] = []

  // Strips are REACTIVE to grid(): the landing cells always reflect the live
  // resolved outcome, so the board can never display a stale grid relative to
  // the scored win (the snapshot version could capture the previous outcome
  // because spinOnce sets `spinning` before `lastOutcome`).
  const strips = computed<string[][]>(() => {
    const g = opts.grid()
    const b = buffer.value
    return Array.from({ length: opts.reelCount() }, (_, r) =>
      b.length ? [...(b[r] ?? []), ...(g[r] ?? [])] : (g[r] ?? []))
  })

  function pick(): string {
    const f = opts.filler()
    return f.length ? f[Math.floor(Math.random() * f.length)]! : ''
  }
  function clearTimers() {
    timers.forEach(clearTimeout)
    timers = []
  }
  function settle() {
    buffer.value = []
    offsetY.value = Array(opts.reelCount()).fill(0)
    blur.value = Array(opts.reelCount()).fill(0)
    durationMs.value = Array(opts.reelCount()).fill(0)
    revealed.value = opts.reelCount()
  }

  watch(() => store.spinning, (spinning) => {
    clearTimers()
    if (!spinning) return
    if (reduced.value) {
      settle()
      store.revealDone()
      voice.value.reelStop(opts.reelCount() - 1, opts.reelCount()) // one settle click
      revealSound()
      return
    }

    revealed.value = 0
    durationMs.value = Array.from({ length: opts.reelCount() }, (_, r) => 1100 + r * 220)
    buffer.value = Array.from({ length: opts.reelCount() }, () => Array.from({ length: BUFFER }, pick))
    offsetY.value = Array(opts.reelCount()).fill(0)
    blur.value = Array(opts.reelCount()).fill(0)
    voice.value.spinStart()

    const landing = BUFFER * STRIDE
    timers.push(setTimeout(() => {
      offsetY.value = offsetY.value.map(() => -landing)
      blur.value = blur.value.map(() => 2)
    }, 16))
    for (let r = 0; r < opts.reelCount(); r++) {
      const dur = durationMs.value[r]!
      timers.push(setTimeout(() => {
        blur.value = blur.value.map((v, i) => i === r ? 0 : v)
      }, dur * 0.55))
      timers.push(setTimeout(() => {
        revealed.value = r + 1
        voice.value.reelStop(r, opts.reelCount())
        if (r === opts.reelCount() - 1) {
          store.revealDone()
          settle() // collapse the buffer: strips === grid (exact outcome, clean a11y tree)
          revealSound()
        }
      }, dur))
    }
  })

  onUnmounted(() => {
    clearTimers()
    store.revealDone()
  })

  return { strips, offsetY, blur, durationMs, revealed, cellPx: REEL_CELL_PX, gapPx: REEL_GAP_PX, stride: STRIDE, visibleRows: opts.visibleRows, buffer: BUFFER }
}
