<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReelSpin, REEL_CELL_PX, REEL_GAP_PX } from '~/composables/useReelSpin'
import { useReelSymbols } from '~/composables/useReelSymbols'
import { useFitScale } from '~/composables/useFitScale'
import { summariseWins } from '~/utils/winLines'
import { formatCredits } from '~/utils/format'
import type { VideoMachineDef } from '~/engine'

const store = useSlotsStore()
const def = computed(() => store.currentDef as VideoMachineDef | null)
const feature = computed(() => store.currentState?.videoFeature ?? null)
const hns = computed(() => feature.value?.kind === 'holdAndSpin' ? feature.value : null)
const fs = computed(() => feature.value?.kind === 'freeSpins' ? feature.value : null)

const grid = computed<string[][]>(() => {
  const d = def.value
  if (d === null) return []
  const out = store.lastOutcome
  if (out !== null && out.machineId === d.id && out.grid.length === 5 && out.gameKind !== 'respin') return out.grid
  return d.strips.map(s => [s[0]!, s[1]!, s[2]!])
})
const fillerIds = computed(() => Object.keys(def.value?.symbols ?? {}))
const { strips, offsetY, blur, durationMs, revealed } = useReelSpin({
  reelCount: () => 5,
  visibleRows: 3,
  grid: () => grid.value,
  filler: () => fillerIds.value
})

const wins = computed(() => def.value && revealed.value >= 5 ? summariseWins(def.value, store.lastOutcome) : [])
const glow = computed(() => {
  const m = new Map<string, string>()
  for (const w of wins.value) {
    for (const c of w.cells) m.set(`${c.reel}:${c.row}`, w.color)
  }
  return m
})
const { iconFor, labelFor, isWild } = useReelSymbols(def)

const GUTTER = 36
const WINDOW_W = GUTTER + 5 * (REEL_CELL_PX + REEL_GAP_PX)
const WINDOW_H = REEL_CELL_PX * 3 + REEL_GAP_PX * 2 // ReelColumn's winH
// Phones: shrink the fixed-pixel window instead of clipping reels 4-5.
const { host: fitHost, scale: fitScale } = useFitScale(WINDOW_W)

type LockCell = { credits: number, label?: string } | { mult: number } | null | undefined
function lockText(cell: LockCell): { mult: boolean, text: string, label?: string } | null {
  if (cell == null) return null
  if ('mult' in cell) return { mult: true, text: `×${cell.mult}` }
  return { mult: false, text: formatCredits(cell.credits), label: cell.label }
}
</script>

<template>
  <div
    v-if="def"
    class="rounded-xl bg-neutral-900 border border-neutral-800 p-4 space-y-3"
  >
    <div class="flex items-center justify-between text-[11px] font-mono">
      <div class="flex items-center gap-2">
        <span
          v-if="fs"
          class="rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 px-2 py-0.5"
        >
          FREE SPINS ×{{ fs.multiplier }} — {{ fs.remaining }} left
        </span>
        <span
          v-if="hns"
          class="rounded-full bg-sky-500/15 border border-sky-500/40 text-sky-300 px-2 py-0.5"
        >
          HOLD &amp; SPIN — {{ hns.respins }} respins
        </span>
      </div>
      <GameProgressiveMeter
        v-if="def.progressive"
        :def="def"
        label="GRAND"
      />
    </div>

    <!-- hold-and-spin lock board -->
    <div
      v-if="hns"
      class="grid grid-cols-5 gap-1.5"
      data-test="lock-board"
    >
      <template
        v-for="r in 5"
        :key="r"
      >
        <div
          v-for="row in 3"
          :key="`${r}:${row}`"
          class="h-16 rounded-lg flex items-center justify-center font-mono text-sm border"
          :class="hns.locked[(r - 1) * 3 + (row - 1)]
            ? (lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.mult
              ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
              : 'bg-sky-500/15 border-sky-500/50 text-sky-200')
            : 'bg-neutral-950 border-neutral-800 text-neutral-700'"
        >
          <template v-if="lockText(hns.locked[(r - 1) * 3 + (row - 1)])">
            <span :class="lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.mult ? 'font-bold' : ''">
              {{ lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.text }}
            </span>
            <span
              v-if="lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.label"
              class="ml-1 uppercase text-[9px] text-amber-300"
            >
              {{ lockText(hns.locked[(r - 1) * 3 + (row - 1)])!.label }}
            </span>
          </template>
          <span v-else>·</span>
        </div>
      </template>
    </div>

    <!-- base / free-spin reel grid (scaled to fit narrow viewports) -->
    <div
      v-else
      ref="fitHost"
      class="overflow-hidden"
      :style="{ height: fitScale < 1 ? WINDOW_H * fitScale + 'px' : undefined }"
      data-test="reel-window-fit"
    >
      <div
        class="relative mx-auto"
        :style="{
          width: WINDOW_W + 'px',
          transform: fitScale < 1 ? `scale(${fitScale})` : undefined,
          transformOrigin: 'top left'
        }"
      >
        <div
          class="flex"
          :style="{ paddingLeft: GUTTER + 'px', gap: REEL_GAP_PX + 'px' }"
        >
          <GameReelColumn
            v-for="(strip, r) in strips"
            :key="r"
            :reel="r"
            :strip="strip"
            :offset-y="offsetY[r] ?? 0"
            :blur="blur[r] ?? 0"
            :duration-ms="durationMs[r] ?? 0"
            :revealed="revealed"
            :reel-count="5"
            :glow="glow"
            :icon-for="iconFor"
            :label-for="labelFor"
            :is-wild="isWild"
          />
        </div>
        <GamePaylineOverlay
          :lines="wins"
          :gutter="GUTTER"
          :cell-px="REEL_CELL_PX"
          :gap-px="REEL_GAP_PX"
          :rows="3"
          :cols="5"
        />
      </div>
    </div>
  </div>
</template>
