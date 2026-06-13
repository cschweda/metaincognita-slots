<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCents, formatCredits } from '~/utils/format'

const store = useSlotsStore()
const lastWin = computed(() => {
  const out = store.lastOutcome
  return out === null ? 0 : out.totalPayout
})
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
    <div class="text-right">
      <div class="text-[10px] uppercase tracking-widest text-neutral-400">
        Last win
      </div>
      <div
        class="text-xl"
        :class="lastWin > 0 ? 'text-emerald-400' : 'text-neutral-600'"
      >
        {{ formatCredits(lastWin) }}
      </div>
    </div>
  </div>
</template>
