<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { floorIntel } from '~/utils/floorIntel'
import { formatCents, formatOdds, formatPercent } from '~/utils/format'
import type { MachineDef } from '~/engine'

const props = defineProps<{ def: MachineDef }>()
const store = useSlotsStore()

const FAMILY_LABEL: Record<MachineDef['family'], string> = {
  'video': 'Video', 'stepper': 'Stepper', 'bally-em': 'Vintage Bally', 'pachislo': 'Pachislo'
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
  const value = prog.kind === 'percent' ? prog.value : prog.kind === 'single' ? prog.value : Math.max(prog.upper, prog.lower)
  return Math.floor(value) * props.def.denominationCents
})

const intel = computed(() => store.settings.xray ? floorIntel(props.def) : null)

function play() {
  store.selectMachine(props.def.id)
  navigateTo('/game')
}
</script>

<template>
  <button
    class="rounded-xl border border-neutral-800 bg-neutral-900/70 hover:border-amber-500/40 transition-all p-4 text-left space-y-2"
    @click="play"
  >
    <div class="flex items-start justify-between gap-2">
      <div>
        <div class="font-bold text-neutral-100">
          {{ def.name }}
        </div>
        <div class="text-[10px] uppercase tracking-wider text-neutral-500">
          {{ FAMILY_LABEL[def.family] }} · {{ formatCents(def.denominationCents) }}/credit
        </div>
      </div>
      <UIcon
        name="i-lucide-play"
        class="w-4 h-4 text-amber-500/70 shrink-0 mt-1"
      />
    </div>
    <div
      v-if="jackpotCents !== null"
      class="text-sm"
    >
      <span class="text-neutral-500">Jackpot </span>
      <span class="text-amber-400 font-mono">{{ formatCents(jackpotCents) }}</span>
    </div>
    <div
      v-if="intel"
      class="pt-2 border-t border-neutral-800/70 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] font-mono"
    >
      <span class="text-neutral-500">RTP</span><span class="text-emerald-400 text-right">{{ formatPercent(intel.rtp, 4) }}</span>
      <span class="text-neutral-500">Hit freq</span><span class="text-neutral-300 text-right">{{ formatPercent(intel.hitFrequency) }}</span>
      <span class="text-neutral-500">Volatility</span><span class="text-neutral-300 text-right">{{ intel.sdPerCoin.toFixed(2) }} sd/coin</span>
      <template v-if="intel.topAwardProbability !== null">
        <span class="text-neutral-500">Top award</span><span class="text-neutral-300 text-right">{{ formatOdds(intel.topAwardProbability) }}</span>
      </template>
    </div>
  </button>
</template>
