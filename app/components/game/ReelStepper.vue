<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReelSpin, REEL_CELL_PX, REEL_GAP_PX } from '~/composables/useReelSpin'
import { summariseWins } from '~/utils/winLines'
import type { StepperMachineDef } from '~/engine'

const store = useSlotsStore()
const def = computed(() => store.currentDef as StepperMachineDef | null)
const reelCount = computed(() => def.value?.physicalStrips.length ?? 3)
const grid = computed<string[][]>(() => {
  const d = def.value
  if (d === null) return []
  const out = store.lastOutcome
  if (out !== null && out.machineId === d.id) return out.grid
  return d.physicalStrips.map(s => [s[s.length - 1]!, s[0]!, s[1]!])
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
const paylineWin = computed(() => wins.value.length > 0)
function iconFor(sym: string) {
  return def.value?.symbols[sym]?.icon
}
function labelFor(sym: string) {
  return def.value?.symbols[sym]?.label ?? sym
}
const winH = REEL_CELL_PX * 3 + REEL_GAP_PX * 2
</script>

<template>
  <div
    v-if="def"
    class="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3"
  >
    <div class="flex items-center justify-between text-[11px] font-mono">
      <span class="text-neutral-400 uppercase tracking-widest">{{ def.physicalStrips.length }} reels · single payline</span>
      <GameProgressiveMeter
        :def="def"
        label="Jackpot"
      />
    </div>
    <div
      class="relative mx-auto"
      :style="{ width: reelCount * REEL_CELL_PX + (reelCount - 1) * REEL_GAP_PX + 'px' }"
    >
      <!-- payline glass over the center row -->
      <div
        class="pointer-events-none absolute inset-x-0 z-10 rounded border transition-colors"
        :style="{ top: (REEL_CELL_PX + REEL_GAP_PX) + 'px', height: REEL_CELL_PX + 'px' }"
        :class="paylineWin ? 'border-amber-400/80 bg-amber-400/5' : 'border-amber-500/25'"
      />
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
  </div>
</template>
