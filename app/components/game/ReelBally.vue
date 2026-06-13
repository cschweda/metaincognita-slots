<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReducedMotion } from '~/composables/useReducedMotion'
import { formatCents, formatCredits } from '~/utils/format'
import type { BallyEmMachineDef } from '~/engine'

const store = useSlotsStore()
const reduced = useReducedMotion()
const def = computed(() => store.currentDef as BallyEmMachineDef | null)

const dual = computed(() => {
  const prog = store.currentState?.progressive
  return prog !== undefined && prog !== null && prog.kind === 'dual' ? prog : null
})
const single = computed(() => {
  const prog = store.currentState?.progressive
  return prog !== undefined && prog !== null && prog.kind === 'single' ? prog : null
})

const grid = computed<string[][]>(() => {
  const d = def.value
  if (d === null) return []
  const out = store.lastOutcome
  if (out !== null && out.machineId === d.id) return out.grid
  return d.strips.map(s => [s[0]!, s[1]!, s[2]!])
})
const reels = computed(() => def.value?.strips.length ?? 0)

const revealed = ref(99)
let timers: ReturnType<typeof setTimeout>[] = []
watch(() => store.spinning, (spinning) => {
  timers.forEach(clearTimeout)
  timers = []
  if (!spinning) return
  if (reduced.value) {
    revealed.value = reels.value
    store.revealDone()
    return
  }
  revealed.value = 0
  for (let r = 1; r <= reels.value; r++) {
    timers.push(setTimeout(() => {
      revealed.value = r
      if (r === reels.value) store.revealDone()
    }, 200 + r * 110))
  }
})

onUnmounted(() => {
  timers.forEach(clearTimeout)
  timers = []
})

const payoutFlavor = computed<string | null>(() => {
  const out = store.lastOutcome
  if (out === null || store.spinning || out.totalPayout === 0) return null
  if (out.progressiveEvents.length > 0) return 'JACKPOT — attendant pays, machine locks up'
  if (out.totalPayout > 50) return 'Hopper pays — listen to it count'
  return 'Hopper pays'
})

function labelFor(sym: string): string {
  return def.value?.symbols[sym]?.label ?? sym
}
function meterCents(credits: number): string {
  return formatCents(Math.floor(credits) * (def.value?.denominationCents ?? 100))
}
</script>

<template>
  <div
    v-if="def"
    class="rounded-xl bg-neutral-900 border-2 border-neutral-700 p-4 space-y-3"
  >
    <!-- dual progressive header (E-1202): two meters, live one alternates per coin -->
    <div
      v-if="dual"
      class="grid grid-cols-2 gap-2"
      data-test="dual-meters"
    >
      <div
        v-for="meter in (['upper', 'lower'] as const)"
        :key="meter"
        class="rounded-lg border px-3 py-1.5 font-mono text-center transition-colors"
        :class="dual.live === meter ? 'border-amber-400/70 bg-amber-500/10' : 'border-neutral-800 bg-neutral-950'"
      >
        <div
          class="text-[9px] uppercase tracking-widest"
          :class="dual.live === meter ? 'text-amber-400' : 'text-neutral-600'"
        >
          {{ meter }} {{ dual.live === meter ? '· live' : '' }}
        </div>
        <div
          class="text-lg"
          :class="dual.live === meter ? 'text-amber-300' : 'text-neutral-400'"
        >
          {{ meterCents(meter === 'upper' ? dual.upper : dual.lower) }}
        </div>
      </div>
    </div>
    <div
      v-else-if="single"
      class="rounded-lg border border-amber-500/30 bg-neutral-950 px-3 py-1.5 font-mono text-center"
    >
      <div class="text-[9px] uppercase tracking-widest text-amber-400">
        Jackpot · max coins only
      </div>
      <div class="text-lg text-amber-300">
        {{ meterCents(single.value) }}
      </div>
    </div>

    <div
      class="grid gap-1.5"
      :style="{ gridTemplateColumns: `repeat(${reels}, minmax(0, 1fr))` }"
    >
      <div
        v-for="(col, r) in grid"
        :key="r"
        class="space-y-1.5"
      >
        <div
          v-for="(cell, row) in col"
          :key="row"
          class="h-14 rounded bg-neutral-950 border border-neutral-800 flex items-center justify-center text-[11px] font-bold text-center px-0.5"
          :class="[
            row === 1 || def.payMode === 'lines' ? 'text-neutral-100' : 'text-neutral-600',
            r < revealed ? '' : 'opacity-30 motion-safe:blur-[2px]'
          ]"
        >
          {{ r < revealed ? labelFor(cell) : '···' }}
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between text-[10px] font-mono text-neutral-500">
      <span>{{ def.stops }} uniform stops/reel — no weighting, 1979 honesty</span>
      <span
        v-if="payoutFlavor"
        class="text-amber-400/80"
      >{{ payoutFlavor }}</span>
      <span v-else>{{ formatCredits(store.creditBalance) }} credits</span>
    </div>
  </div>
</template>
