<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useReelSpin, REEL_CELL_PX, REEL_GAP_PX } from '~/composables/useReelSpin'
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
  reelCount: 5,
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
function iconFor(sym: string) {
  return def.value?.symbols[sym]?.icon
}
function labelFor(sym: string) {
  return def.value?.symbols[sym]?.label ?? sym
}
function isWild(sym: string) {
  return def.value?.wildSymbol === sym
}

const GUTTER = 36
const winH = REEL_CELL_PX * 3 + REEL_GAP_PX * 2
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
            {{ formatCredits(hns.locked[(r - 1) * 3 + (row - 1)]!.credits) }}
            <span
              v-if="hns.locked[(r - 1) * 3 + (row - 1)]!.label"
              class="ml-1 uppercase text-[9px] text-amber-300"
            >
              {{ hns.locked[(r - 1) * 3 + (row - 1)]!.label }}
            </span>
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
              :class="(revealed >= 5 && idx >= strip.length - 3 && glow.has(`${r}:${idx - (strip.length - 3)}`))
                ? 'border-amber-400/80' : 'border-neutral-800'"
              :style="{
                height: REEL_CELL_PX + 'px',
                marginBottom: REEL_GAP_PX + 'px',
                boxShadow: (revealed >= 5 && idx >= strip.length - 3 && glow.has(`${r}:${idx - (strip.length - 3)}`))
                  ? `0 0 18px ${glow.get(`${r}:${idx - (strip.length - 3)}`)}55 inset` : 'none'
              }"
            >
              <GameSymbolIcon
                :icon="iconFor(cell)"
                :label="labelFor(cell)"
                :wild="isWild(cell)"
              />
            </div>
          </div>
        </div>
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
