<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { nextSpinCost } from '~/engine'

const store = useSlotsStore()

const def = computed(() => store.currentDef)
const fixedReason = computed<string | null>(() => {
  const d = def.value
  if (d === null) return null
  if (d.family === 'video' && d.betMode.kind === 'ways') return 'Fixed bet — buys all 243 ways'
  if (d.family === 'video' && d.fixedBet) return 'Fixed bet — feature eligibility requires full coverage'
  if (d.family === 'pachislo') return 'Full bet required — stock-era machines gate bonuses by full bet'
  return null
})
const betLabel = computed(() => {
  const d = def.value
  if (d === null) return ''
  if (d.family === 'video' && d.betMode.kind === 'lines' && !d.fixedBet) return `${store.currentBet} lines`
  if (d.family === 'pachislo') return `${store.currentBet} tokens`
  if (d.family === 'bally-em' && d.payMode === 'lines') {
    return store.currentBet === 1 ? '1 line' : `${store.currentBet} lines`
  }
  return `${store.currentBet} coins`
})
const costCents = computed(() => {
  const d = def.value
  const s = store.currentState
  if (d === null || s === null) return 0
  return nextSpinCost(d, s, store.currentBet) * d.denominationCents
})
const canSpin = computed(() =>
  def.value !== null && !store.spinning && costCents.value <= store.bankrollCents)
const inFeature = computed(() => {
  const s = store.currentState
  return s !== null && (s.videoFeature !== null || (s.pachislo !== null && s.pachislo.bonus !== null))
})

function spin() {
  store.spinOnce()
}
</script>

<template>
  <div
    v-if="def"
    class="flex items-center justify-between rounded-xl bg-neutral-900 border border-neutral-800 px-4 py-3 gap-4"
  >
    <div class="flex items-center gap-2">
      <template v-if="fixedReason === null">
        <UButton
          data-test="bet-down"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-minus"
          :disabled="store.spinning"
          aria-label="Decrease bet"
          @click="store.setBet(store.currentBet - 1)"
        />
        <span class="font-mono text-sm text-neutral-200 min-w-[5.5rem] text-center">{{ betLabel }}</span>
        <UButton
          data-test="bet-up"
          color="neutral"
          variant="outline"
          size="xs"
          icon="i-lucide-plus"
          :disabled="store.spinning"
          aria-label="Increase bet"
          @click="store.setBet(store.currentBet + 1)"
        />
      </template>
      <template v-else>
        <span class="font-mono text-sm text-neutral-200">{{ betLabel }}</span>
        <span class="text-[10px] text-neutral-400">{{ fixedReason }}</span>
      </template>
    </div>

    <div class="flex items-center gap-3">
      <span
        v-if="inFeature"
        class="text-[10px] text-amber-400 uppercase tracking-wider motion-safe:animate-pulse"
      >Feature in play</span>
      <span
        v-if="!canSpin && !store.spinning"
        class="text-[10px] text-red-400"
      >
        {{ inFeature ? 'Out of credits — bonus stalled' : 'Out of credits' }}
      </span>
      <UButton
        v-if="def.family !== 'pachislo'"
        data-test="spin"
        color="primary"
        size="lg"
        icon="i-lucide-refresh-cw"
        :disabled="!canSpin"
        @click="spin"
      >
        {{ inFeature ? 'Play feature game' : 'Spin' }}
      </UButton>
      <slot name="pachislo-controls" />
    </div>
  </div>
</template>
