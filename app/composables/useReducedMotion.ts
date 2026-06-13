import { getCurrentInstance, onBeforeUnmount, ref } from 'vue'

export function useReducedMotion() {
  const reduced = ref(false)
  if (typeof window !== 'undefined' && 'matchMedia' in window) {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    reduced.value = query.matches
    const onChange = (e: MediaQueryListEvent) => {
      reduced.value = e.matches
    }
    query.addEventListener('change', onChange)
    if (getCurrentInstance()) {
      onBeforeUnmount(() => query.removeEventListener('change', onChange))
    }
  }
  return reduced
}
