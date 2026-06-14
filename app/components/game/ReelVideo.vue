<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReelSpin, REEL_CELL_PX, REEL_GAP_PX } from '~/composables/useReelSpin'
import { useReelSymbols } from '~/composables/useReelSymbols'
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

type LockedCell = { credits: number; label?: 'mini' | 'minor' | 'major' } | { mult: number }
function isCreditCell(c: LockedCell): c is { credits: number; label?: 'mini' | 'minor' | 'major' } {
  return 'credits' in c
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
            ? 'bg-sky-500/15 border-sky-500/50 text-sky-200'
            : 'bg-neutral-950 border-neutral-800 text-neutral-700'"
        >
          <template v-if="hns.locked[(r - 1) * 3 + (row - 1)]">
            <template v-if="isCreditCell(hns.locked[(r - 1) * 3 + (row - 1)]!)">
              {{ formatCredits((hns.locked[(r - 1) * 3 + (row - 1)]! as { credits: number; label?: 'mini' | 'minor' | 'major' }).credits) }}
              <span
                v-if="(hns.locked[(r - 1) * 3 + (row - 1)]! as { credits: number; label?: 'mini' | 'minor' | 'major' }).label"
                class="ml-1 uppercase text-[9px] text-amber-300"
              >
                {{ (hns.locked[(r - 1) * 3 + (row - 1)]! as { credits: number; label?: 'mini' | 'minor' | 'major' }).label }}
              </span>
            </template>
            <template v-else>
              {{ `x${(hns.locked[(r - 1) * 3 + (row - 1)]! as { mult: number }).mult}` }}
            </template>
          </template>
          <span v-else>·</span>
        </div>
      </template>
    </div>

    <!-- base / free-spin reel grid -->
    <div
      v-else
      class="relative mx-auto"
      :style="{ width: GUTTER + 5 * (REEL_CELL_PX + REEL_GAP_PX) + 'px' }"
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
</template>
