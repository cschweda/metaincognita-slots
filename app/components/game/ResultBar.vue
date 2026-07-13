<!-- app/components/game/ResultBar.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCredits, formatCents, formatSignedCredits } from '~/utils/format'
import { summariseWins } from '~/utils/winLines'
import { bankrollSeries } from '~/utils/bankrollSeries'
import type { SeriesPoint, SpinKind } from '~/utils/bankrollSeries'
import type { SpinOutcome } from '~/engine'

const store = useSlotsStore()

/**
 * "Held until next spin" — literally, and it has to be.
 *
 * spinOnce() resolves the engine and books the outcome the INSTANT you press
 * Spin; the reels are only animation, and revealDone() flips `spinning` off when
 * they land. So store.lastOutcome — and the bankroll, and the history behind the
 * sparkline — are already the NEW result while the reels are still turning.
 * Rendering them live would spoil the spin you are watching. So we snapshot on
 * every settled beat and draw the snapshot: the card keeps showing the PREVIOUS
 * result until the reels land on the new one.
 *
 * It also means the card never unmounts — which is the point. The Spin button
 * sits directly beneath it, and a card that vanished mid-spin dragged Spin out
 * from under the pointer on every single pull.
 */
const held = ref<{ out: SpinOutcome, series: SeriesPoint[] } | null>(null)

watch(
  [() => store.spinning, () => store.lastOutcome],
  () => {
    if (store.spinning) return // reels still turning: keep holding the old result
    const out = store.lastOutcome
    held.value = out !== null && out.machineId === store.currentMachineId
      ? { out, series: bankrollSeries(store.history, store.bankrollCents, 30) }
      : null
  },
  { immediate: true }
)

const out = computed(() => held.value?.out ?? null)
const won = computed(() => (out.value?.totalPayout ?? 0) > 0)
// The honest result: payout minus what the spin actually cost. A win whose
// payout is under the bet (a "loss disguised as a win") lands here negative,
// matching the bankroll sparkline beside it.
const net = computed(() => (out.value?.totalPayout ?? 0) - (out.value?.coinsIn ?? 0))
const netClass = computed(() =>
  net.value > 0 ? 'text-emerald-400' : net.value < 0 ? 'text-rose-400' : 'text-neutral-400')
const chips = computed(() => store.currentDef && out.value ? summariseWins(store.currentDef, out.value) : [])

/** One dot per spin, coloured by what it did to the BANKROLL — not by what the
 *  machine celebrated. Amber is the whole lesson: the cabinet sang, you still lost. */
const DOT: Record<SpinKind, string> = {
  win: '#34d399', // emerald — the bankroll rose
  ldw: '#fbbf24', // amber — paid, and the bankroll fell anyway
  loss: '#fb7185' // rose — no pay at all
}
const DOT_LABEL: Record<SpinKind, string> = {
  win: 'won',
  ldw: 'paid under the bet — still down',
  loss: 'no pay'
}

const spark = computed(() => {
  const series = held.value?.series ?? []
  if (series.length < 2) return null
  const w = 240
  const h = 48
  const pad = 6
  const cents = series.map(p => p.cents)
  const min = Math.min(...cents)
  const max = Math.max(...cents)
  const rng = (max - min) || 1
  const pts = series.map((p, i) => ({
    x: pad + (w - 2 * pad) * (i / (series.length - 1)),
    y: h - pad - (h - 2 * pad) * ((p.cents - min) / rng),
    kind: p.kind
  }))
  return {
    w,
    h,
    line: pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
    // the line takes the trend's colour; the dots carry the per-spin truth
    color: cents[cents.length - 1]! >= cents[0]! ? '#34d399' : '#fb7185',
    dots: pts.filter((p): p is { x: number, y: number, kind: SpinKind } => p.kind !== null)
  }
})

const sparkLabel = computed(() => {
  const dots = spark.value?.dots ?? []
  const n = (k: SpinKind) => dots.filter(d => d.kind === k).length
  return `Bankroll across the last ${dots.length} ${dots.length === 1 ? 'spin' : 'spins'}: `
    + `${n('win')} won, ${n('ldw')} paid but still lost money, ${n('loss')} paid nothing.`
})
</script>

<template>
  <div
    data-test="result-bar"
    class="rb rounded-xl border px-4 py-3"
    :class="out && won
      ? 'border-amber-500/45 bg-gradient-to-r from-amber-500/15 to-emerald-500/10'
      : 'border-neutral-800 bg-neutral-950'"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.18em] text-neutral-400">
      {{ store.spinning ? 'Last result · reels still turning' : 'Last result · held until next spin' }}
    </div>

    <!-- Idle: nothing has landed on this machine yet. It still holds the slot, so
         Spin sits at the same y from the very first pull. -->
    <div
      v-if="!out"
      data-test="result-idle"
      class="rb-body flex items-center gap-3"
    >
      <!-- neutral-500 on neutral-950 is 4.2:1 — fine for this 24px black text
           (large-text floor is 3:1), but the 12px hint beside it needs 4.5:1. -->
      <span class="font-mono text-2xl font-black text-neutral-500">Ready</span>
      <span class="text-xs text-neutral-400">Hit SPIN — the result lands here and stays put.</span>
    </div>

    <div
      v-else
      class="rb-body flex items-center justify-between gap-4"
    >
      <div>
        <span
          class="font-mono text-2xl font-black"
          :class="won ? 'text-amber-300' : 'text-neutral-500'"
        >{{ won ? `WIN +${formatCredits(out.totalPayout)}` : 'No win' }}</span>
        <span
          aria-hidden="true"
          class="mx-1.5 text-neutral-600"
        >·</span>
        <span
          data-test="net"
          class="font-mono text-sm font-bold"
          :class="netClass"
        >net {{ formatSignedCredits(net) }}</span>
        <div class="mt-0.5 text-xs font-semibold text-neutral-300">
          Bankroll now <span class="font-bold text-emerald-400">{{ formatCredits(store.creditBalance) }}</span>
          credits · {{ formatCents(store.bankrollCents) }}
        </div>
      </div>

      <div
        v-if="spark"
        class="flex shrink-0 flex-col items-end gap-1"
      >
        <svg
          :viewBox="`0 0 ${spark.w} ${spark.h}`"
          :width="spark.w"
          :height="spark.h"
          role="img"
          :aria-label="sparkLabel"
        >
          <polyline
            :points="spark.line"
            fill="none"
            :stroke="spark.color"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            opacity="0.55"
          />
          <circle
            v-for="(d, i) in spark.dots"
            :key="i"
            data-test="spark-dot"
            :data-kind="d.kind"
            :cx="d.x"
            :cy="d.y"
            r="2.6"
            :fill="DOT[d.kind]"
            stroke="#05070d"
            stroke-width="0.8"
          ><title>{{ DOT_LABEL[d.kind] }}</title></circle>
        </svg>
        <div class="flex items-center gap-2.5 text-[9px] font-semibold text-neutral-400">
          <span class="rb-key"><i :style="{ background: DOT.win }" />win</span>
          <span class="rb-key"><i :style="{ background: DOT.ldw }" />paid, still down</span>
          <span class="rb-key"><i :style="{ background: DOT.loss }" />no pay</span>
        </div>
      </div>
    </div>

    <!-- The chips row is ALWAYS present and exactly one row tall: a big multi-line
         win used to grow the card and shove Spin down the page mid-rattle. -->
    <div class="rb-chips flex items-center gap-2">
      <span
        v-for="(c, i) in chips"
        :key="i"
        class="grid shrink-0 grid-cols-[26px_12px_auto] items-center gap-2 rounded-full py-1 pl-1 pr-3 text-xs font-bold"
        :style="{ background: c.color + '22', color: '#e5e5e5' }"
      >
        <span
          v-if="c.lineNumber !== null"
          class="rounded-md py-0.5 text-center text-[10px] font-extrabold text-neutral-950"
          :style="{ background: c.color }"
        >L{{ c.lineNumber }}</span>
        <span v-else />
        <span class="text-right font-extrabold">{{ c.count }}</span>
        <span class="whitespace-nowrap">{{ c.pluralName }}{{ c.kind === 'ways' ? ' — any position' : '' }}</span>
      </span>
    </div>
  </div>
</template>

<style scoped>
/* Every row below the eyebrow holds a FIXED height, in every state — idle,
   spinning, resolved, win, no-win. The Spin button lives directly under this
   card, and it must never move out from under a rattling finger. */
.rb-body {
  margin-top: 4px;
  min-height: 66px; /* sparkline (48) + its legend */
}

.rb-chips {
  margin-top: 10px;
  height: 28px; /* reserved whether or not there are chips; one row, never wraps */
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}
.rb-chips::-webkit-scrollbar {
  display: none;
}

.rb-key {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  white-space: nowrap;
}
.rb-key i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
</style>
