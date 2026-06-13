<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCredits } from '~/utils/format'

const store = useSlotsStore()
const visible = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (timer !== null) clearTimeout(timer)
})

watch(() => [store.spinning, store.lastOutcome] as const, ([spinning, out]) => {
  if (!spinning && out !== null && out.totalPayout > 0) {
    visible.value = true
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(() => {
      visible.value = false
    }, 2500)
  } else if (spinning) {
    visible.value = false
  }
})
</script>

<template>
  <Transition
    enter-active-class="motion-safe:transition motion-safe:duration-200"
    enter-from-class="opacity-0 scale-95"
    leave-active-class="motion-safe:transition motion-safe:duration-500"
    leave-to-class="opacity-0"
  >
    <div
      v-if="visible && store.lastOutcome"
      class="absolute inset-x-0 top-6 mx-auto w-fit rounded-full bg-amber-500/15 border border-amber-500/40 px-6 py-2 backdrop-blur pointer-events-none"
    >
      <span class="text-amber-300 font-bold font-mono text-lg">
        +{{ formatCredits(store.lastOutcome.totalPayout) }} credits
      </span>
    </div>
  </Transition>
</template>
