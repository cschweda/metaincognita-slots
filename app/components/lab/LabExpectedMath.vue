<!-- app/components/lab/LabExpectedMath.vue -->
<script setup lang="ts">
// Presentation-only (guidelines §2.5 "see the math instantly"): the page owns
// the exact report + labExpectedMath; this renders the MODEL numbers and, after
// a run, reconciles them against the MEASURED mean without hand-waving.
import { computed } from 'vue'
import type { MachineDef } from '~/engine'
import type { SimLabResult } from '~/engine/sessions'
import type { LabExpectedMathModel } from '~/utils/labMath'
import { formatCents, formatCentsExact } from '~/utils/format'

const props = defineProps<{
  def: MachineDef | null
  model: LabExpectedMathModel | null
  result: SimLabResult | null
}>()

const spins = (n: number): string => `${Math.round(n).toLocaleString('en-US')} spins`

const cells = computed(() => {
  const m = props.model
  if (m === null) return []
  const end = m.capExpectedEndCents
  return [
    { label: 'Per spin', value: `${formatCentsExact(m.perSpinCostCents)} in · ${formatCentsExact(m.perSpinLossCents)} kept by the house`, gloss: 'Bet size, and the house edge\'s expected toll on each spin' },
    { label: 'If every spin plays', value: `${formatCents(m.capCoinInCents)} wagered · expect to lose ${formatCents(m.capExpectedLossCents)}`, gloss: 'Coin-in and expected loss over the full spin cap, before variance has its say' },
    end >= 0
      ? { label: 'Expected end (model)', value: formatCents(end), gloss: 'Starting bankroll minus the expected loss, if no bust cuts the session short' }
      : { label: 'Expectation busts you first', value: m.expectationBustSpins === null ? '—' : `~${spins(m.expectationBustSpins)}`, gloss: 'At pure expectation the bankroll hits $0 before the spin cap' },
    { label: '±1σ of luck', value: formatCents(m.sessionSigmaCents), gloss: 'One standard deviation of a session\'s ending bankroll — how loudly variance talks over the edge' },
    { label: 'Edge outgrows luck after', value: m.n0Spins === null ? 'never (no edge)' : `~${spins(m.n0Spins)}`, gloss: 'Spins until the expected loss exceeds one standard deviation of luck — before this, variance dominates' }
  ]
})

const measuredEndCents = computed(() => {
  if (props.result === null || props.def === null) return null
  return Math.round(props.result.meanEnd * props.def.denominationCents)
})
</script>

<template>
  <section class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-4 space-y-3">
    <div class="flex items-baseline gap-2">
      <h2 class="text-sm font-bold text-neutral-100">
        The math, before you spin
      </h2>
      <span class="text-[10px] uppercase tracking-widest text-amber-400/80 border border-amber-500/30 rounded px-1.5 py-0.5">model</span>
    </div>
    <p
      v-if="model === null"
      class="text-xs text-neutral-400"
    >
      Computing this machine's exact math…
    </p>
    <div
      v-else
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3"
    >
      <div
        v-for="c in cells"
        :key="c.label"
        data-test="lab-model"
        :title="c.gloss"
        class="space-y-0.5"
      >
        <div class="text-[10px] uppercase tracking-widest text-neutral-400">
          {{ c.label }}
        </div>
        <div class="text-sm font-mono text-neutral-200">
          {{ c.value }}
        </div>
      </div>
    </div>
    <p
      v-if="model !== null && measuredEndCents !== null"
      class="text-xs text-neutral-400"
    >
      Model expected end
      <span class="font-mono text-amber-300">{{ formatCents(Math.max(0, model.capExpectedEndCents)) }}</span>
      vs measured mean end
      <span class="font-mono text-neutral-200">{{ formatCents(measuredEndCents) }}</span>
      — sessions that bust stop losing early, so the measured mean sits above the
      no-bust model. That gap is bust truncation, not luck.
    </p>
    <p
      v-if="def !== null && (def.family === 'video' || def.family === 'pachislo')"
      class="text-[10px] text-neutral-500"
    >
      {{ def.family === 'video'
        ? 'Volatility figure uses the machine\'s max-lines exact math.'
        : 'Volatility figure is the attribution model at the default operator setting.' }}
    </p>
  </section>
</template>
