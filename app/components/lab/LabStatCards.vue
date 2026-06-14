<!-- app/components/lab/LabStatCards.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { SimLabResult } from '~/engine/sessions'
import { FLOOR } from '~/machines'
import { formatCents, formatPercent } from '~/utils/format'

const props = defineProps<{ result: SimLabResult }>()
const denom = computed(() => FLOOR.find(m => m.id === props.result.machineId)?.denominationCents ?? 1)
const toCents = (credits: number): number => Math.round(credits * denom.value)

const cards = computed(() => [
  { label: 'Risk of ruin', value: formatPercent(props.result.riskOfRuin), tone: 'rose' },
  { label: 'Ended ahead', value: formatPercent(props.result.pctAhead), tone: 'emerald' },
  { label: 'Median end', value: formatCents(toCents(props.result.medianEnd)), tone: 'neutral' },
  { label: 'Mean end', value: formatCents(toCents(props.result.meanEnd)), tone: 'neutral' },
  { label: 'Avg session length', value: `${Math.round(props.result.avgSpins)} spins`, tone: 'neutral' },
  { label: 'Avg max drawdown', value: formatCents(toCents(props.result.avgMaxDrawdown)), tone: 'amber' },
  { label: 'Empirical RTP', value: formatPercent(props.result.empiricalRtp, 2), tone: 'neutral' },
  { label: 'House edge', value: formatPercent(props.result.houseEdge, 2), tone: 'amber' }
])
const toneClass: Record<string, string> = {
  rose: 'text-rose-400', emerald: 'text-emerald-400', amber: 'text-amber-400', neutral: 'text-neutral-200'
}
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
    <div
      v-for="c in cards"
      :key="c.label"
      class="rounded-xl bg-neutral-900/70 border border-neutral-800 px-3 py-2"
    >
      <div class="text-[10px] uppercase tracking-widest text-neutral-400">
        {{ c.label }}
      </div>
      <div
        class="text-lg font-mono"
        :class="toneClass[c.tone]"
      >
        {{ c.value }}
      </div>
    </div>
  </div>
</template>
