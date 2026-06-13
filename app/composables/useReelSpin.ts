// app/composables/useReelSpin.ts
import { onUnmounted, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReducedMotion } from '~/composables/useReducedMotion'

export const REEL_CELL_PX = 96
export const REEL_GAP_PX = 8
const STRIDE = REEL_CELL_PX + REEL_GAP_PX
const BUFFER = 16 // filler cells above the landing window

export interface ReelSpinOptions {
  reelCount: number
  visibleRows: number
  grid: () => string[][] // resolved visible grid [reel][row]
  filler: () => string[] // candidate ids shown while spinning
}

export function useReelSpin(opts: ReelSpinOptions) {
  const store = useSlotsStore()
  const reduced = useReducedMotion()

  const strips = ref<string[][]>([])
  const offsetY = ref<number[]>([])
  const blur = ref<number[]>([])
  const durationMs = ref<number[]>([])
  const revealed = ref(opts.reelCount)
  let timers: ReturnType<typeof setTimeout>[] = []

  function pick(): string {
    const f = opts.filler()
    return f.length ? f[Math.floor(Math.random() * f.length)]! : ''
  }
  function clearTimers() {
    timers.forEach(clearTimeout)
    timers = []
  }

  function settle() {
    strips.value = Array.from({ length: opts.reelCount }, (_, r) => opts.grid()[r] ?? [])
    offsetY.value = Array(opts.reelCount).fill(0)
    blur.value = Array(opts.reelCount).fill(0)
    durationMs.value = Array(opts.reelCount).fill(0)
    revealed.value = opts.reelCount
  }

  watch(() => store.spinning, (spinning) => {
    clearTimers()
    if (!spinning) return
    const g = opts.grid()
    if (reduced.value) {
      settle()
      store.revealDone()
      return
    }

    revealed.value = 0
    durationMs.value = Array.from({ length: opts.reelCount }, (_, r) => 1100 + r * 220)
    strips.value = Array.from({ length: opts.reelCount }, (_, r) => {
      const out = g[r] ?? []
      return [...Array.from({ length: BUFFER }, pick), ...out]
    })
    offsetY.value = Array(opts.reelCount).fill(0)
    blur.value = Array(opts.reelCount).fill(0)

    const landing = BUFFER * STRIDE
    timers.push(setTimeout(() => {
      offsetY.value = offsetY.value.map(() => -landing)
      blur.value = blur.value.map(() => 2)
    }, 16))
    for (let r = 0; r < opts.reelCount; r++) {
      const dur = durationMs.value[r]!
      timers.push(setTimeout(() => {
        blur.value = blur.value.map((v, i) => i === r ? 0 : v)
      }, dur * 0.55))
      timers.push(setTimeout(() => {
        revealed.value = r + 1
        if (r === opts.reelCount - 1) store.revealDone()
      }, dur))
    }
  })

  onUnmounted(clearTimers)
  settle()

  return { strips, offsetY, blur, durationMs, revealed, cellPx: REEL_CELL_PX, gapPx: REEL_GAP_PX, stride: STRIDE, visibleRows: opts.visibleRows, buffer: BUFFER }
}
