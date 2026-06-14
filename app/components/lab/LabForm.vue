<!-- app/components/lab/LabForm.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FLOOR } from '~/machines'
import type { SimRunParams } from '~/composables/useSimWorker'

defineProps<{ running: boolean }>()
const emit = defineEmits<{ run: [SimRunParams] }>()

const machineId = ref(FLOOR[0]!.id)
const def = computed(() => FLOOR.find(m => m.id === machineId.value)!)
const bankrollDollars = ref(50)
const bet = ref(def.value.maxCoins)
const spinCap = ref(500)
const sessions = ref(10_000)

// Re-clamp bet to the new machine's range when the machine changes.
watch(machineId, () => {
  bet.value = Math.min(Math.max(1, bet.value), def.value.maxCoins)
})

const warn = computed(() => sessions.value > 50_000)

function emitRun(): void {
  const startCredits = Math.max(1, Math.round((bankrollDollars.value * 100) / def.value.denominationCents))
  emit('run', {
    machineId: machineId.value,
    startCredits,
    bet: Math.min(Math.max(1, Math.floor(bet.value)), def.value.maxCoins),
    spinCap: Math.max(1, Math.floor(spinCap.value)),
    progressiveMode: 'static',
    sessions: Math.max(1, Math.floor(sessions.value)),
    seed: 1
  })
}
</script>

<template>
  <div class="rounded-xl bg-neutral-900/70 border border-neutral-800 p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
    <label
      for="lab-machine"
      class="text-xs text-neutral-400 col-span-2 sm:col-span-1"
    >
      Machine
      <select
        id="lab-machine"
        v-model="machineId"
        data-test="machine"
        name="machine"
        class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm text-neutral-200"
      >
        <option
          v-for="m in FLOOR"
          :key="m.id"
          :value="m.id"
        >
          {{ m.name }}
        </option>
      </select>
    </label>
    <label
      for="lab-bankroll"
      class="text-xs text-neutral-400"
    >
      Bankroll ($)
      <input
        id="lab-bankroll"
        v-model.number="bankrollDollars"
        data-test="bankroll"
        name="bankroll"
        type="number"
        min="1"
        class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200"
      >
    </label>
    <label
      for="lab-bet"
      class="text-xs text-neutral-400"
    >
      Bet (coins)
      <input
        id="lab-bet"
        v-model.number="bet"
        data-test="bet"
        name="bet"
        type="number"
        min="1"
        :max="def.maxCoins"
        class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200"
      >
    </label>
    <label
      for="lab-cap"
      class="text-xs text-neutral-400"
    >
      Spin cap
      <input
        id="lab-cap"
        v-model.number="spinCap"
        data-test="cap"
        name="spin-cap"
        type="number"
        min="1"
        class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200"
      >
    </label>
    <label
      for="lab-sessions"
      class="text-xs text-neutral-400"
    >
      Sessions
      <input
        id="lab-sessions"
        v-model.number="sessions"
        data-test="sessions"
        name="sessions"
        type="number"
        min="1"
        class="mt-1 block w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm font-mono text-neutral-200"
      >
    </label>
    <div class="col-span-2 sm:col-span-5 flex items-center gap-3">
      <UButton
        data-test="run"
        :disabled="running"
        @click="emitRun"
      >
        Run simulation
      </UButton>
      <span
        v-if="warn"
        class="text-xs text-amber-400"
      >Large run — this may take a while.</span>
    </div>
  </div>
</template>
