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
  { label: 'Risk of ruin', value: formatPercent(props.result.riskOfRuin), tone: 'rose', gloss: 'The share of simulated sessions that lost the whole bankroll before stopping' },
  { label: 'Ended ahead', value: formatPercent(props.result.pctAhead), tone: 'emerald', gloss: 'The share of sessions that walked away with more than they started' },
  { label: 'Median end', value: formatCents(toCents(props.result.medianEnd)), tone: 'neutral', gloss: 'Half the sessions ended with less than this, half with more' },
  { label: 'Mean end', value: formatCents(toCents(props.result.meanEnd)), tone: 'neutral', gloss: 'The average ending bankroll across all simulated sessions' },
  { label: 'Avg session length', value: `${Math.round(props.result.avgSpins)} spins`, tone: 'neutral', gloss: 'Average paid spins before a session ended (bust, goal, or spin cap)' },
  { label: 'Avg max drawdown', value: formatCents(toCents(props.result.avgMaxDrawdown)), tone: 'amber', gloss: 'Average deepest dip below a session\'s best point — the stomach-drop number' },
  { label: 'Empirical RTP', value: formatPercent(props.result.empiricalRtp, 2), tone: 'neutral', gloss: 'What these simulated sessions actually paid back, as a share of all coin-in' },
  { label: 'House edge', value: formatPercent(props.result.houseEdge, 2), tone: 'amber', gloss: 'One minus RTP: the share of every wager the machine keeps, on average' }
])
const toneClass: Record<string, string> = {
  rose: 'text-rose-400', emerald: 'text-emerald-400', amber: 'text-amber-400', neutral: 'text-neutral-200'
}
</script>

<template>
  <div class="space-y-2">
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div
        v-for="c in cards"
        :key="c.label"
        data-test="lab-stat"
        :title="c.gloss"
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
    <p class="text-[10px] text-neutral-500">
      Hover any card for a plain-English definition — or read the
      <NuxtLink
        to="/learn/glossary"
        class="text-amber-400/80 hover:text-amber-300 underline underline-offset-2"
      >glossary</NuxtLink>.
    </p>
  </div>
</template>
