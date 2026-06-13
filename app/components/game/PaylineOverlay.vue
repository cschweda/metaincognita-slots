<!-- app/components/game/PaylineOverlay.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { WinLine } from '~/utils/winLines'

const props = defineProps<{
  lines: WinLine[]
  gutter: number
  cellPx: number
  gapPx: number
  rows: number
  cols: number
}>()

const stride = computed(() => props.cellPx + props.gapPx)
const width = computed(() => props.gutter + props.cols * stride.value)
const height = computed(() => props.rows * stride.value - props.gapPx)
const cx = (c: number) => props.gutter + c * stride.value + props.cellPx / 2
const cy = (r: number) => r * stride.value + props.cellPx / 2

const drawn = computed(() => props.lines.filter(l => l.kind === 'line' && l.pattern !== null))

function points(pattern: number[]): string {
  return pattern.map((row, c) => `${cx(c)},${cy(row)}`).join(' ')
}

const badges = computed(() => {
  const used: Record<number, number> = {}
  const maxY = height.value - 12
  return drawn.value.map((l) => {
    let y = cy(l.pattern![0]!)
    while (used[y] !== undefined) y += 20
    if (y > maxY) y = maxY // keep the badge inside the SVG when many lines stack
    used[y] = 1
    return { n: l.lineNumber!, color: l.color, y }
  })
})
</script>

<template>
  <div
    class="pointer-events-none absolute inset-0 z-10"
    aria-hidden="true"
  >
    <svg
      :viewBox="`0 0 ${width} ${height}`"
      :width="width"
      :height="height"
      class="absolute inset-0"
    >
      <polyline
        v-for="(l, i) in drawn"
        :key="i"
        :points="points(l.pattern!.slice(0, l.count))"
        fill="none"
        :stroke="l.color"
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
        :style="{ filter: `drop-shadow(0 0 5px ${l.color})` }"
      />
    </svg>
    <span
      v-for="(b, i) in badges"
      :key="i"
      data-test="line-num"
      class="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-md text-xs font-extrabold text-neutral-950"
      :style="{ left: '18px', top: b.y + 'px', background: b.color }"
    >{{ b.n }}</span>
  </div>
</template>
