<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReelSpin, REEL_CELL_PX, REEL_GAP_PX } from '~/composables/useReelSpin'
import { summariseWins } from '~/utils/winLines'
import { formatCents, formatCredits } from '~/utils/format'
import type { BallyEmMachineDef } from '~/engine'

const store = useSlotsStore()
const def = computed(() => store.currentDef as BallyEmMachineDef | null)
const dual = computed(() => {
  const prog = store.currentState?.progressive
  return prog !== undefined && prog !== null && prog.kind === 'dual' ? prog : null
})
const single = computed(() => {
  const prog = store.currentState?.progressive
  return prog !== undefined && prog !== null && prog.kind === 'single' ? prog : null
})
const reelCount = computed(() => def.value?.strips.length ?? 0)
const grid = computed<string[][]>(() => {
  const d = def.value
  if (d === null) return []
  const out = store.lastOutcome
  if (out !== null && out.machineId === d.id) return out.grid
  return d.strips.map(s => [s[0]!, s[1]!, s[2]!])
})
const fillerIds = computed(() => Object.keys(def.value?.symbols ?? {}))
const { strips, offsetY, blur, durationMs, revealed } = useReelSpin({
  reelCount: reelCount.value,
  visibleRows: 3,
  grid: () => grid.value,
  filler: () => fillerIds.value
})
const wins = computed(() => def.value && revealed.value >= reelCount.value ? summariseWins(def.value, store.lastOutcome) : [])
const glow = computed(() => {
  const m = new Map<string, string>()
  for (const w of wins.value) {
    for (const c of w.cells) m.set(`${c.reel}:${c.row}`, w.color)
  }
  return m
})
const payoutFlavor = computed<string | null>(() => {
  const out = store.lastOutcome
  if (out === null || store.spinning || out.totalPayout === 0) return null
  if (out.progressiveEvents.length > 0) return 'JACKPOT — attendant pays, machine locks up'
  if (out.totalPayout > 50) return 'Hopper pays — listen to it count'
  return 'Hopper pays'
})
function iconFor(sym: string) {
  return def.value?.symbols[sym]?.icon
}
function labelFor(sym: string) {
  return def.value?.symbols[sym]?.label ?? sym
}
function meterCents(credits: number): string {
  return formatCents(Math.floor(credits) * (def.value?.denominationCents ?? 100))
}
const winH = REEL_CELL_PX * 3 + REEL_GAP_PX * 2
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
      class="relative mx-auto"
      :style="{ width: reelCount * REEL_CELL_PX + (reelCount - 1) * REEL_GAP_PX + 'px' }"
    >
      <div
        class="flex"
        :style="{ gap: REEL_GAP_PX + 'px' }"
      >
        <div
          v-for="(strip, r) in strips"
          :key="r"
          class="overflow-hidden rounded-lg"
          :style="{ width: REEL_CELL_PX + 'px', height: winH + 'px' }"
        >
          <div
            class="flex flex-col"
            :style="{
              transform: `translateY(${offsetY[r] ?? 0}px)`,
              filter: `blur(${blur[r] ?? 0}px)`,
              transition: `transform ${durationMs[r] ?? 0}ms cubic-bezier(.16,.74,.18,1), filter ${(durationMs[r] ?? 0) * 0.5}ms ease-out`
            }"
          >
            <div
              v-for="(cell, idx) in strip"
              :key="idx"
              class="flex shrink-0 items-center justify-center rounded-lg border bg-neutral-950"
              :class="(revealed >= reelCount && idx >= strip.length - 3 && glow.has(`${r}:${idx - (strip.length - 3)}`))
                ? 'border-amber-400/80' : 'border-neutral-800'"
              :style="{
                height: REEL_CELL_PX + 'px',
                marginBottom: REEL_GAP_PX + 'px',
                boxShadow: (revealed >= reelCount && idx >= strip.length - 3 && glow.has(`${r}:${idx - (strip.length - 3)}`))
                  ? `0 0 18px ${glow.get(`${r}:${idx - (strip.length - 3)}`)}55 inset` : 'none'
              }"
            >
              <GameSymbolIcon
                :icon="iconFor(cell)"
                :label="labelFor(cell)"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="flex items-center justify-between text-[10px] font-mono text-neutral-400">
      <span>{{ def.stops }} uniform stops/reel — no weighting, 1979 honesty</span>
      <span
        v-if="payoutFlavor"
        class="text-amber-400/80"
      >{{ payoutFlavor }}</span>
      <span v-else>{{ formatCredits(store.creditBalance) }} credits</span>
    </div>
  </div>
</template>
