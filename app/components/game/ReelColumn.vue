<!-- app/components/game/ReelColumn.vue -->
<script setup lang="ts">
import { REEL_CELL_PX, REEL_GAP_PX } from '~/composables/useReelSpin'

const props = withDefaults(defineProps<{
  /** reel index; used to build the `${reel}:${row}` glow key */
  reel: number
  strip: string[]
  offsetY?: number
  blur?: number
  durationMs?: number
  revealed: number
  reelCount: number
  glow: Map<string, string>
  iconFor: (sym: string) => string | undefined
  labelFor: (sym: string) => string
  isWild?: (sym: string) => boolean
}>(), { offsetY: 0, blur: 0, durationMs: 0, isWild: undefined })

const winH = REEL_CELL_PX * 3 + REEL_GAP_PX * 2

/** Maps the last 3 strip cells to rows 0–2 (idle len-3 and spun len-19 alike),
 * then reports whether that landed cell is part of a scored win. */
function lit(idx: number): boolean {
  return props.revealed >= props.reelCount
    && idx >= props.strip.length - 3
    && props.glow.has(`${props.reel}:${idx - (props.strip.length - 3)}`)
}
function litColor(idx: number): string | undefined {
  return props.glow.get(`${props.reel}:${idx - (props.strip.length - 3)}`)
}
</script>

<template>
  <div
    class="overflow-hidden rounded-lg"
    :style="{ width: REEL_CELL_PX + 'px', height: winH + 'px' }"
  >
    <div
      class="flex flex-col"
      :style="{
        transform: `translateY(${offsetY}px)`,
        filter: `blur(${blur}px)`,
        transition: `transform ${durationMs}ms cubic-bezier(.16,.74,.18,1), filter ${durationMs * 0.5}ms ease-out`
      }"
    >
      <div
        v-for="(cell, idx) in strip"
        :key="idx"
        class="flex shrink-0 items-center justify-center rounded-lg border bg-neutral-950"
        :class="lit(idx) ? 'border-amber-400/80' : 'border-neutral-800'"
        :style="{
          height: REEL_CELL_PX + 'px',
          marginBottom: REEL_GAP_PX + 'px',
          boxShadow: lit(idx) ? `0 0 18px ${litColor(idx)}55 inset` : 'none'
        }"
      >
        <GameSymbolIcon
          :icon="iconFor(cell)"
          :label="labelFor(cell)"
          :wild="isWild ? isWild(cell) : undefined"
        />
      </div>
    </div>
  </div>
</template>
