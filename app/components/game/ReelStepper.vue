<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReducedMotion } from '~/composables/useReducedMotion'
import type { StepperMachineDef } from '~/engine'

const store = useSlotsStore()
const reduced = useReducedMotion()
const def = computed(() => store.currentDef as StepperMachineDef | null)

const grid = computed<string[][]>(() => {
  const d = def.value
  if (d === null) return []
  const out = store.lastOutcome
  if (out !== null && out.machineId === d.id) return out.grid
  return d.physicalStrips.map(s => [s[s.length - 1]!, s[0]!, s[1]!])
})
const paylineWin = computed(() =>
  revealed.value === 3 && (store.lastOutcome?.wins.length ?? 0) > 0)

const revealed = ref(3)
let timers: ReturnType<typeof setTimeout>[] = []
watch(() => store.spinning, (spinning) => {
  timers.forEach(clearTimeout)
  timers = []
  if (!spinning) return
  if (reduced.value) {
    revealed.value = 3
    store.revealDone()
    return
  }
  revealed.value = 0
  for (let r = 1; r <= 3; r++) {
    timers.push(setTimeout(() => {
      revealed.value = r
      if (r === 3) store.revealDone()
    }, 250 + r * 150))
  }
})

onUnmounted(() => {
  timers.forEach(clearTimeout)
  timers = []
})

function labelFor(sym: string): string {
  return def.value?.symbols[sym]?.label ?? sym
}
</script>

<template>
  <div
    v-if="def"
    class="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3"
  >
    <div class="flex items-center justify-between text-[11px] font-mono">
      <span class="text-neutral-500 uppercase tracking-widest">{{ def.physicalStrips.length }} reels · single payline</span>
      <GameProgressiveMeter
        :def="def"
        label="Jackpot"
      />
    </div>
    <div class="relative grid grid-cols-3 gap-2 max-w-[420px] mx-auto">
      <!-- payline glass -->
      <div
        class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[4.5rem] rounded border pointer-events-none z-10 transition-colors"
        :class="paylineWin ? 'border-amber-400/80 bg-amber-400/5' : 'border-amber-500/25'"
      />
      <div
        v-for="(col, r) in grid"
        :key="r"
        class="space-y-2"
      >
        <div
          v-for="(cell, row) in col"
          :key="row"
          class="h-16 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center text-xs font-bold text-center px-1"
          :class="[
            row === 1 ? 'text-neutral-100' : 'text-neutral-600',
            r < revealed ? '' : 'opacity-30 motion-safe:blur-[2px]'
          ]"
        >
          {{ r < revealed ? labelFor(cell) : '···' }}
        </div>
      </div>
    </div>
  </div>
</template>
