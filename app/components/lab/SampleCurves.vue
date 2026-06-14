<!-- app/components/lab/SampleCurves.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import ChartFrame from './ChartFrame.vue'

const props = defineProps<{ result: SimLabResult }>()
const X0 = 6
const X1 = 314
const Y0 = 10
const Y1 = 148

const yMax = computed(() =>
  Math.max(props.result.startCredits, 1, ...props.result.sampleTrajectories.flatMap(t => t.points))
)

const curves = computed(() =>
  props.result.sampleTrajectories.map((t) => {
    const n = Math.max(1, t.points.length - 1)
    const pts = t.points.map((v, i) => {
      const x = X0 + (i / n) * (X1 - X0)
      const y = Y1 - (v / yMax.value) * (Y1 - Y0)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
    return { pts, stroke: t.busted ? '#fb7185' : '#34d399' }
  })
)
const startY = computed(() => Y1 - (props.result.startCredits / yMax.value) * (Y1 - Y0))
const summary = computed(() =>
  `${props.result.sampleTrajectories.length} example bankroll paths; rose paths busted, green survived.`
)
</script>

<template>
  <ChartFrame
    title="Sample sessions"
    :summary="summary"
  >
    <line
      :x1="X0"
      :y1="startY"
      :x2="X1"
      :y2="startY"
      stroke="#404040"
      stroke-width="1"
      stroke-dasharray="3 3"
    />
    <polyline
      v-for="(c, i) in curves"
      :key="i"
      :points="c.pts"
      fill="none"
      :stroke="c.stroke"
      stroke-width="1.5"
      opacity="0.85"
    />
  </ChartFrame>
</template>
