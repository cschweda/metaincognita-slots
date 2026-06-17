<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { floorIntel } from '~/utils/floorIntel'
import { formatCents, formatOdds, formatPercent } from '~/utils/format'
import type { MachineDef } from '~/engine'

const props = defineProps<{ def: MachineDef }>()
const store = useSlotsStore()

const FAMILY_LABEL: Record<MachineDef['family'], string> = {
  'video': 'Video', 'stepper': 'Stepper', 'bally-em': 'Vintage Bally', 'pachislo': 'Pachislo', 'blackjack-reel': 'Blackjack reel'
}

// Per-family top accent colors — light tint that reads clearly on neutral-900
const FAMILY_COLOR: Record<MachineDef['family'], string> = {
  'video': '#6366f1',
  'stepper': '#f59e0b',
  'bally-em': '#ec4899',
  'pachislo': '#22d3ee',
  'blackjack-reel': '#46e08a'
}

// Per-family decorative glyph (pure text, no external assets, CSP-clean)
const FAMILY_GLYPH: Record<MachineDef['family'], string> = {
  'video': '🎰',
  'stepper': '⚙',
  'bally-em': '★',
  'pachislo': '◎',
  'blackjack-reel': '♠'
}

const jackpotCents = computed<number | null>(() => {
  const state = store.machineStates[props.def.id]
  const prog = state?.progressive ?? null
  if (props.def.progressive === null) return null
  if (prog === null) {
    const cfg = props.def.progressive
    const reset = cfg.kind === 'percent' ? cfg.reset : cfg.kind === 'single' ? cfg.meter.reset : cfg.upper.reset
    return reset * props.def.denominationCents
  }
  const value = prog.kind === 'percent' ? prog.value : prog.kind === 'single' ? prog.value : prog.live === 'upper' ? prog.upper : prog.lower
  return Math.floor(value) * props.def.denominationCents
})

// Floor xray headline: report at the bet dialed in for this machine (defaults
// to maxCoins) so the per-spin hit frequency/volatility match the in-game
// sidebar for 'lines' machines.
const intel = computed(() =>
  store.settings.xray
    ? floorIntel(props.def, { coins: store.settings.betsByMachine[props.def.id] ?? props.def.maxCoins })
    : null)

function play() {
  store.selectMachine(props.def.id)
  navigateTo('/game')
}
</script>

<template>
  <button
    class="mc-card rounded-xl border border-neutral-800 bg-neutral-900/70 hover:border-amber-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-all p-4 text-left space-y-2"
    :style="{ '--mc-accent': FAMILY_COLOR[def.family] }"
    :aria-label="`Play ${def.name}`"
    @click="play"
  >
    <!-- Per-family top accent rail -->
    <div
      class="mc-rail"
      aria-hidden="true"
    />
    <div class="flex items-start justify-between gap-2">
      <div>
        <div class="font-bold text-neutral-100">
          {{ def.name }}
        </div>
        <div class="text-[10px] uppercase tracking-wider text-neutral-400">
          {{ FAMILY_LABEL[def.family] }} · {{ formatCents(def.denominationCents) }}/credit
        </div>
      </div>
      <span
        class="mc-glyph"
        aria-hidden="true"
      >{{ FAMILY_GLYPH[def.family] }}</span>
    </div>
    <div
      v-if="jackpotCents !== null"
      class="text-sm"
    >
      <span class="text-neutral-400">Jackpot </span>
      <span class="text-amber-400 font-mono">{{ formatCents(jackpotCents) }}</span>
    </div>
    <div
      v-if="intel"
      class="pt-2 border-t border-neutral-800/70 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono"
    >
      <span class="text-neutral-400">RTP</span><span class="text-emerald-400 text-right">{{ formatPercent(intel.rtp, 4) }}</span>
      <span class="text-neutral-400">Hit freq</span><span class="text-neutral-300 text-right">{{ formatPercent(intel.hitFrequency) }}</span>
      <span class="text-neutral-400">Volatility</span><span class="text-neutral-300 text-right">{{ intel.sdPerCoin.toFixed(2) }} sd/coin</span>
      <template v-if="intel.topAwardProbability !== null">
        <span class="text-neutral-400">Top award</span><span class="text-neutral-300 text-right">{{ formatOdds(intel.topAwardProbability) }}</span>
      </template>
    </div>
  </button>
</template>

<style scoped>
/* ── Machine card chrome ── */
.mc-card {
  --mc-accent: #6366f1; /* fallback; overridden per-family via inline style */
  position: relative;
  overflow: hidden;
  background: linear-gradient(160deg, rgba(255,255,255,.03) 0%, transparent 60%);
  box-shadow: 0 1px 4px rgba(0,0,0,.45);
  transition: box-shadow .18s, border-color .18s, background .18s;
}
.mc-card:hover {
  box-shadow: 0 2px 12px rgba(0,0,0,.6), 0 0 0 1px var(--mc-accent, #6366f1);
  background: linear-gradient(160deg, rgba(255,255,255,.05) 0%, transparent 60%);
}

/* Thin top accent rail tinted per machine family */
.mc-rail {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--mc-accent, #6366f1), transparent 80%);
  opacity: .7;
  border-radius: 12px 12px 0 0;
  pointer-events: none;
}

/* Decorative family glyph — replaces the UIcon play arrow */
.mc-glyph {
  font-size: 16px;
  line-height: 1;
  opacity: .45;
  flex-shrink: 0;
  margin-top: 2px;
  color: var(--mc-accent, #6366f1);
  transition: opacity .18s;
  user-select: none;
}
.mc-card:hover .mc-glyph {
  opacity: .85;
}
</style>
