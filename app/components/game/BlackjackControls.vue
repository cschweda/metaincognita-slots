<!-- app/components/game/BlackjackControls.vue -->
<!-- Lucky 21 — STOP / CASH OUT / DEAL controls (Task 9). -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'

const store = useSlotsStore()
const { phase, canDeal, canStop, canCash, deal, stop, cashOut, cashValueDollars } = useBlackjackReel()

const def = computed(() => {
  const d = store.currentDef
  return d?.family === 'blackjack-reel' ? d : null
})

const anteDisplay = computed(() => {
  if (def.value === null) return ''
  const coins = store.currentBet
  const cents = coins * def.value.denominationCents
  return `Ante: ${coins} coin${coins !== 1 ? 's' : ''} ($${(cents / 100).toFixed(2)})`
})
</script>

<template>
  <div
    v-if="def"
    class="flex flex-wrap items-center justify-end gap-2"
  >
    <span class="font-mono text-xs text-neutral-400 mr-1">{{ anteDisplay }}</span>

    <!-- DEAL — shown when idle or resolved -->
    <UButton
      v-if="phase === 'idle' || phase === 'resolved'"
      data-test="deal"
      color="primary"
      size="lg"
      icon="i-lucide-play"
      :disabled="!canDeal"
      aria-label="Deal — start a new hand"
      @click="deal"
    >
      Deal
    </UButton>

    <!-- STOP — locks the next reel -->
    <UButton
      data-test="stop"
      color="warning"
      variant="solid"
      size="lg"
      icon="i-lucide-circle-stop"
      :disabled="!canStop"
      :class="canStop ? 'ring-1 ring-amber-400/60' : ''"
      aria-label="Stop — lock the next reel"
      @click="stop"
    >
      Stop
      <span class="block text-[11px] font-mono mt-0.5 opacity-80">
        reel {{ (store.currentState?.blackjackReel?.idx ?? 0) + 1 }}
      </span>
    </UButton>

    <!-- CASH OUT -->
    <UButton
      data-test="cash-out"
      color="success"
      variant="solid"
      size="lg"
      icon="i-lucide-banknote"
      :disabled="!canCash"
      aria-label="Cash out — take current winnings"
      @click="cashOut"
    >
      Cash Out
      <span
        v-if="canCash"
        class="block text-[11px] font-mono mt-0.5 opacity-85"
        data-test="cash-val"
      >
        take {{ cashValueDollars }}
      </span>
    </UButton>

    <span
      v-if="phase === 'spinning'"
      class="text-[10px] text-amber-400 uppercase tracking-wider ml-1"
    >Hand in play</span>
    <span
      v-else-if="phase === 'resolved'"
      class="text-[10px] text-neutral-400 uppercase tracking-wider ml-1"
    >Hand resolved — deal again?</span>
  </div>
</template>
