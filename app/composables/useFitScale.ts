import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Scale-to-fit for fixed-pixel reel windows: watch the host's available width
 * and yield min(1, width / baseWidth), so a 556px cabinet shrinks as a
 * transform on phones instead of clipping inside overflow:hidden chrome.
 * Width 0 (hidden, SSR) reads as 1 so nothing collapses before first layout.
 */
export function useFitScale(baseWidth: number) {
  const host = ref<HTMLElement | null>(null)
  const scale = ref(1)
  let ro: ResizeObserver | null = null

  const measure = (): void => {
    const w = host.value?.clientWidth ?? 0
    scale.value = w > 0 ? Math.min(1, w / baseWidth) : 1
  }

  onMounted(() => {
    measure()
    if (typeof ResizeObserver !== 'undefined' && host.value !== null) {
      ro = new ResizeObserver(measure)
      ro.observe(host.value)
    }
  })
  onBeforeUnmount(() => {
    ro?.disconnect()
    ro = null
  })

  return { host, scale }
}
