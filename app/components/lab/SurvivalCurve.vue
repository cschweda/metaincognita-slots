<!-- app/components/lab/SurvivalCurve.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import { formatPercent } from '~/utils/format'
import ChartFrame from './ChartFrame.vue'

const props = defineProps<{ result: SimLabResult }>()

// plot area inside the 320x170 viewBox
const X0 = 34
const X1 = 312
const Y0 = 10
const Y1 = 148
const maxSpins = computed(() => props.result.spinCap || 1)

const points = computed(() =>
  props.result.survival.map((s) => {
    const x = X0 + (s.spins / maxSpins.value) * (X1 - X0)
    const y = Y1 - s.fraction * (Y1 - Y0)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
)
const finalRate = computed(() => props.result.survival.at(-1)?.fraction ?? 0)
const summary = computed(() =>
  `Share of bankrolls still solvent over ${props.result.spinCap} spins, ending at ${formatPercent(finalRate.value)} survival.`
)
</script>

<template>
  <ChartFrame
    title="Survival curve"
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
    <line
      :x1="X0"
      :y1="Y0"
      :x2="X0"
      :y2="Y1"
      stroke="#404040"
      stroke-width="1"
    />
    <polyline
      :points="points"
      fill="none"
      stroke="#34d399"
      stroke-width="2"
    />
    <text
      :x="X0"
      :y="Y0 - 2"
      fill="#737373"
      font-size="8"
    >
      100%
    </text>
    <text
      :x="X1"
      :y="Y1 + 12"
      fill="#737373"
      font-size="8"
      text-anchor="end"
    >
      {{ result.spinCap }} spins
    </text>
  </ChartFrame>
</template>
