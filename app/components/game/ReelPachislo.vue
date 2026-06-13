<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { usePachisloPress } from '~/composables/usePachisloPress'
import type { PachisloMachineDef } from '~/engine'

const store = useSlotsStore()
const { armed, positions, pressed, cancelPress } = usePachisloPress()
onBeforeUnmount(() => cancelPress())

const def = computed(() => store.currentDef as PachisloMachineDef | null)
const ps = computed(() => store.currentState?.pachislo ?? null)

const grid = computed<string[][]>(() => {
  const d = def.value
  if (d === null) return []
  if (armed.value) {
    // live view: frozen reels hold the pressed position, the rest cycle
    return d.strips.map((strip, r) => {
      const pos = pressed.value[r] ?? Math.floor(positions.value[r]!)
      return [strip[pos % 21]!, strip[(pos + 1) % 21]!, strip[(pos + 2) % 21]!]
    })
  }
  const out = store.lastOutcome
  if (out !== null && out.machineId === d.id) return out.grid
  return d.strips.map(s => [s[0]!, s[1]!, s[2]!])
})
const presses = computed(() =>
  armed.value ? null : store.lastOutcome?.trace.presses ?? null)
const queueDepth = computed(() => ps.value === null
  ? 0
  : ps.value.smallQueue.length + ps.value.bonusQueue.length)

function labelFor(sym: string): string {
  return def.value?.symbols[sym]?.label ?? sym
}
function iconFor(sym: string) {
  return def.value?.symbols[sym]?.icon
}
</script>

<template>
  <div
    v-if="def && ps"
    class="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3"
  >
    <div class="flex items-center justify-between text-[11px] font-mono">
      <div class="flex items-center gap-3">
        <span
          class="flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-colors"
          :class="queueDepth > 0 ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-neutral-800 text-neutral-600'"
          data-test="stock-lamp"
        >
          <span
            class="w-1.5 h-1.5 rounded-full"
            :class="queueDepth > 0 ? 'bg-amber-400 motion-safe:animate-pulse' : 'bg-neutral-700'"
          />
          STOCK {{ queueDepth > 0 ? `· ${queueDepth}` : '' }}
        </span>
        <span class="text-neutral-400">Level {{ ps.oddsLevel }}</span>
      </div>
      <span
        v-if="ps.replayNext"
        class="text-emerald-400"
      >REPLAY — next game free</span>
    </div>

    <div
      v-if="ps.bonus"
      class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 font-mono text-sm text-amber-200"
      data-test="bonus-panel"
    >
      {{ ps.bonus.type.toUpperCase() }} BONUS —
      <template v-if="ps.bonus.interlude">
        interlude {{ ps.bonus.interlude.index }} · {{ ps.bonus.interlude.bells }} bells
      </template>
      <template v-else>
        round {{ ps.bonus.round }} of {{ ps.bonus.type === 'big' ? def.bigRounds : 1 }} · {{ ps.bonus.jacLeft }} guaranteed wins left
      </template>
    </div>

    <div
      class="grid grid-cols-3 gap-2 max-w-[420px] mx-auto"
      :aria-hidden="armed ? 'true' : undefined"
    >
      <div
        v-for="(col, r) in grid"
        :key="r"
        class="space-y-2"
      >
        <div
          v-for="(cell, row) in col"
          :key="row"
          class="h-16 rounded-lg bg-neutral-950 border flex items-center justify-center text-xs font-bold text-center px-1"
          :class="[row === 1 ? 'border-amber-500/30 text-neutral-100' : 'border-neutral-800 text-neutral-600']"
        >
          <GameSymbolIcon :icon="iconFor(cell)" :label="labelFor(cell)" :size="48" />
        </div>
        <div
          v-if="presses"
          class="text-center text-[10px] font-mono text-neutral-400"
        >
          press {{ presses[r]!.press }} → stop {{ presses[r]!.stop }}
          <span :class="presses[r]!.slipUsed > 0 ? 'text-amber-400' : ''">(slip {{ presses[r]!.slipUsed }})</span>
        </div>
      </div>
    </div>
  </div>
</template>
