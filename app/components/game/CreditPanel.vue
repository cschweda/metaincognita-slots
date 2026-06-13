<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCents, formatCredits } from '~/utils/format'
import { denominationLabel } from '~/utils/denomination'

const store = useSlotsStore()
// Mirror ResultBar: hold the win figure until the reels land (not while spinning)
// and only for the current machine's own outcome, so it never spoils the result.
const showWin = computed(() => !store.spinning && store.lastOutcome !== null
  && store.lastOutcome.machineId === store.currentMachineId)
const lastWin = computed(() => store.lastOutcome?.totalPayout ?? 0)
const denomTag = computed(() => store.currentDef ? denominationLabel(store.currentDef.denominationCents) : '')
</script>

<template>
  <div class="flex items-center justify-between rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-2.5 font-mono">
    <div class="flex items-baseline gap-6">
      <div>
        <div class="text-[10px] uppercase tracking-widest text-neutral-400">
          Credits
        </div>
        <div class="text-2xl text-amber-300">
          {{ formatCredits(store.creditBalance) }}
        </div>
      </div>
      <div>
        <div class="text-[10px] uppercase tracking-widest text-neutral-400">
          Bankroll
        </div>
        <div class="text-sm text-emerald-400">
          {{ formatCents(store.bankrollCents) }}
        </div>
      </div>
    </div>
    <div class="flex items-center gap-4">
      <div class="text-right">
        <div class="text-[10px] uppercase tracking-widest text-neutral-400">
          Last win
        </div>
        <div
          data-test="last-win"
          class="text-xl"
          :class="showWin && lastWin > 0 ? 'text-emerald-400' : 'text-neutral-600'"
        >
          {{ showWin ? formatCredits(lastWin) : '—' }}
        </div>
      </div>
      <span
        v-if="denomTag"
        data-test="denom-tag"
        class="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs font-semibold text-neutral-300"
      >{{ denomTag }}</span>
    </div>
  </div>
</template>
