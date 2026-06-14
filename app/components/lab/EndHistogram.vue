<!-- app/components/lab/EndHistogram.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import { FLOOR } from '~/machines'
import { formatCents } from '~/utils/format'
import ChartFrame from './ChartFrame.vue'

const props = defineProps<{ result: SimLabResult }>()
const X0 = 34
const X1 = 312
const Y0 = 10
const Y1 = 148
const denom = computed(() => FLOOR.find(m => m.id === props.result.machineId)?.denominationCents ?? 1)

const bars = computed(() => {
  const h = props.result.endHistogram
  const max = Math.max(1, ...h.counts)
  const bw = (X1 - X0) / h.counts.length
  return h.counts.map((c, i) => ({
    x: X0 + i * bw + 1,
    y: Y1 - (c / max) * (Y1 - Y0),
    w: Math.max(1, bw - 2),
    h: (c / max) * (Y1 - Y0),
    // i === 0 is the bust bin: the engine builds endHistogram over [0, maxEnd] and busted
    // sessions end at ~0 credits, so they always fall into the lowest bin.
    // endHistogram.bustCount is the canonical count of busted sessions.
    bust: i === 0
  }))
})
const summary = computed(() =>
  `Distribution of ending bankrolls across ${props.result.sessions} sessions; `
  + `${props.result.endHistogram.bustCount} busted (leftmost bar (near-zero balance)). Start was ${formatCents(Math.round(props.result.startCredits * denom.value))}.`
)
</script>

<template>
  <ChartFrame
    title="Ending bankroll"
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
      :fill="b.bust ? '#fb7185' : '#fbbf24'"
    />
  </ChartFrame>
</template>
