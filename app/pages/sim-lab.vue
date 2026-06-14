<!-- app/pages/sim-lab.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { FLOOR } from '~/machines'
import { useSimWorker } from '~/composables/useSimWorker'

const machineId = ref(FLOOR[0]!.id)
const startCredits = ref(200)
const bet = ref(1)
const spinCap = ref(500)
const sessions = ref(10_000)

const { running, progress, result, error, run, cancel } = useSimWorker()

function start(): void {
  run({
    machineId: machineId.value,
    startCredits: startCredits.value,
    bet: bet.value,
    spinCap: spinCap.value,
    progressiveMode: 'static',
    sessions: sessions.value,
    seed: 1
  })
}
</script>

<template>
  <div class="px-4 py-8 max-w-[1100px] mx-auto space-y-6">
    <h1 class="text-3xl font-bold">
      <span class="text-amber-400">Sim</span> Lab
    </h1>
    <div class="flex flex-wrap items-end gap-3">
      <label class="text-sm">Machine
        <select
          v-model="machineId"
          data-test="machine"
          class="block bg-neutral-900 border border-neutral-700 rounded px-2 py-1"
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
      <UButton
        data-test="run"
        :disabled="running"
        @click="start"
      >
        Run
      </UButton>
      <UButton
        v-if="running"
        data-test="cancel"
        color="error"
        @click="cancel"
      >
        Cancel
      </UButton>
    </div>

    <p
      v-if="running"
      data-test="progress"
    >
      Running… {{ Math.round(progress * 100) }}%
    </p>
    <p
      v-if="error"
      class="text-rose-400"
    >
      {{ error }}
    </p>

    <pre
      v-if="result"
      data-test="result"
      class="text-xs"
    >{{ JSON.stringify({
      riskOfRuin: result.riskOfRuin, medianEnd: result.medianEnd, pctAhead: result.pctAhead
    }, null, 2) }}</pre>
  </div>
</template>
