<!-- app/components/game/BlackjackControls.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useBlackjackReel } from '~/composables/useBlackjackReel'

const store = useSlotsStore()
const { phase, canDeal, canHit, canStand, deal, hit, stand } = useBlackjackReel()

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
    class="flex items-center gap-2"
  >
    <span class="font-mono text-xs text-neutral-400 mr-1">{{ anteDisplay }}</span>

    <UButton
      data-test="deal"
      color="primary"
      size="lg"
      icon="i-lucide-play"
      :disabled="!canDeal"
      @click="deal"
    >
      Deal
    </UButton>

    <UButton
      data-test="hit"
      color="neutral"
      variant="solid"
      size="lg"
      icon="i-lucide-plus"
      :disabled="!canHit"
      :class="canHit ? 'ring-1 ring-amber-400/60' : ''"
      @click="hit"
    >
      Hit
    </UButton>

    <UButton
      data-test="stand"
      color="neutral"
      variant="outline"
      size="lg"
      icon="i-lucide-hand"
      :disabled="!canStand"
      @click="stand"
    >
      Stand
    </UButton>

    <span
      v-if="phase === 'dealt'"
      class="text-[10px] text-amber-400 uppercase tracking-wider ml-1"
    >Hand in play</span>
    <span
      v-else-if="phase === 'resolved'"
      class="text-[10px] text-neutral-400 uppercase tracking-wider ml-1"
    >Hand resolved — deal again?</span>
  </div>
</template>
