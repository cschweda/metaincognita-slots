<!-- app/components/game/ResultBar.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCredits, formatCents } from '~/utils/format'
import { summariseWins } from '~/utils/winLines'
import { bankrollSeries } from '~/utils/bankrollSeries'

const store = useSlotsStore()

const show = computed(() => !store.spinning && store.lastOutcome !== null
  && store.lastOutcome.machineId === store.currentMachineId)
const out = computed(() => store.lastOutcome)
const won = computed(() => (out.value?.totalPayout ?? 0) > 0)
const chips = computed(() => store.currentDef && out.value ? summariseWins(store.currentDef, out.value) : [])

const spark = computed(() => {
  const s = bankrollSeries(store.history, store.bankrollCents, 30)
  if (s.length < 2) return null
  const w = 172, h = 44, pad = 4
  const min = Math.min(...s), max = Math.max(...s), rng = (max - min) || 1
  const pts = s.map((v, i) => {
    const x = pad + (w - 2 * pad) * (i / (s.length - 1))
    const y = h - pad - (h - 2 * pad) * ((v - min) / rng)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
  const up = s[s.length - 1]! >= s[0]!
  return { pts, w, h, color: up ? '#34d399' : '#fb7185' }
})
</script>

<template>
  <div
    v-if="show && out"
    data-test="result-bar"
    class="rounded-xl border px-4 py-3"
    :class="won ? 'border-amber-500/45 bg-gradient-to-r from-amber-500/15 to-emerald-500/10' : 'border-neutral-800 bg-neutral-950'"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
      Last result · held until next spin
    </div>
    <div class="mt-1 flex items-center justify-between gap-4">
      <div>
        <span
          class="font-mono text-2xl font-black"
          :class="won ? 'text-amber-300' : 'text-neutral-500'"
        >{{ won ? `WIN +${formatCredits(out.totalPayout)}` : 'No win' }}</span>
        <div class="mt-0.5 text-xs font-semibold text-neutral-300">
          Bankroll now <span class="font-bold text-emerald-400">{{ formatCredits(store.creditBalance) }}</span>
          credits · {{ formatCents(store.bankrollCents) }}
        </div>
      </div>
      <svg
        v-if="spark"
        :viewBox="`0 0 ${spark.w} ${spark.h}`"
        :width="spark.w"
        :height="spark.h"
        class="shrink-0"
        aria-hidden="true"
      >
        <polyline
          :points="spark.pts"
          fill="none"
          :stroke="spark.color"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <div
      v-if="chips.length"
      class="mt-2.5 flex flex-wrap gap-2"
    >
      <span
        v-for="(c, i) in chips"
        :key="i"
        class="grid grid-cols-[26px_12px_auto] items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-bold"
        :style="{ background: c.color + '22', color: '#e5e5e5' }"
      >
        <span
          v-if="c.lineNumber !== null"
          class="rounded-md py-0.5 text-center text-[10px] font-extrabold text-neutral-950"
          :style="{ background: c.color }"
        >L{{ c.lineNumber }}</span>
        <span v-else />
        <span class="text-right font-extrabold">{{ c.count }}</span>
        <span>{{ c.pluralName }}{{ c.kind === 'ways' ? ' — any position' : '' }}</span>
      </span>
    </div>
  </div>
</template>
