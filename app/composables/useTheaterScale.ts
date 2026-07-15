import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

/** Largest scale that fits a natural natW×natH block into availW×availH, capped. */
export function fitScale(natW: number, natH: number, availW: number, availH: number, cap: number): number {
  if (natW <= 0 || natH <= 0) return 1
  return Math.min(cap, availW / natW, availH / natH)
}

/**
 * Scale the theater cabinet block to fill the screen. `host.offsetWidth/Height`
 * is the NATURAL layout size — CSS transforms don't affect it — so we can measure
 * once and scale visually without feedback. Available size is the viewport, which
 * equals the screen while the stage is in real fullscreen.
 */
export function useTheaterScale(active: Ref<boolean>, cap = 2.4) {
  const host = ref<HTMLElement | null>(null)
  const scale = ref(1)
  let ro: ResizeObserver | null = null

  const measure = (): void => {
    if (!active.value || host.value === null) {
      scale.value = 1
      return
    }
    scale.value = fitScale(
      host.value.offsetWidth, host.value.offsetHeight,
      window.innerWidth, window.innerHeight, cap
    )
  }

  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && host.value !== null) {
      ro = new ResizeObserver(measure)
      ro.observe(host.value)
    }
    window.addEventListener('resize', measure)
  })
  onBeforeUnmount(() => {
    ro?.disconnect()
    ro = null
    window.removeEventListener('resize', measure)
  })
  watch(active, measure)

  return { host, scale }
}
