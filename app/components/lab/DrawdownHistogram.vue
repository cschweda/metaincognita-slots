<!-- app/components/lab/DrawdownHistogram.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import ChartFrame from './ChartFrame.vue'

const props = defineProps<{ result: SimLabResult }>()
const X0 = 34
const X1 = 312
const Y0 = 10
const Y1 = 148

const bars = computed(() => {
  const h = props.result.drawdownHistogram
  const max = Math.max(1, ...h.counts)
  const bw = (X1 - X0) / h.counts.length
  return h.counts.map((c, i) => ({
    x: X0 + i * bw + 1,
    y: Y1 - (c / max) * (Y1 - Y0),
    w: Math.max(1, bw - 2),
    h: (c / max) * (Y1 - Y0)
  }))
})
const summary = computed(() =>
  `Distribution of the worst peak-to-trough dip each of ${props.result.sessions} sessions suffered.`
)
</script>

<template>
  <ChartFrame
    title="Max drawdown"
    :summary="summary"
  >
    <line
      :x1="X0"
      :y1="Y1"
      :x2="X1"
      :y2="Y1"
      stroke="#404040"
      stroke-width="1"
    />
    <rect
      v-for="(b, i) in bars"
      :key="i"
      :x="b.x"
      :y="b.y"
      :width="b.w"
      :height="b.h"
      fill="#a78bfa"
    />
  </ChartFrame>
</template>
