<!-- app/pages/sim-lab.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSimWorker } from '~/composables/useSimWorker'
import type { SimRunParams } from '~/composables/useSimWorker'
import { useExactRtp } from '~/composables/useExactRtp'
import { edgeOpts } from '~/utils/floorIntel'
import { labExpectedMath } from '~/utils/labMath'
import { FLOOR } from '~/machines'
import LabForm from '~/components/lab/LabForm.vue'
import LabExpectedMath from '~/components/lab/LabExpectedMath.vue'
import LabProgress from '~/components/lab/LabProgress.vue'
import LabStatCards from '~/components/lab/LabStatCards.vue'
import SurvivalCurve from '~/components/lab/SurvivalCurve.vue'
import EndHistogram from '~/components/lab/EndHistogram.vue'
import SampleCurves from '~/components/lab/SampleCurves.vue'
import DrawdownHistogram from '~/components/lab/DrawdownHistogram.vue'

const { running, progress, completed, total, result, error, run, cancel } = useSimWorker()

// Live expected math (§2.5): recomputed as the form changes, before any run.
const params = ref<SimRunParams | null>(null)
const def = computed(() => params.value === null ? null : FLOOR.find(m => m.id === params.value!.machineId) ?? null)
const report = useExactRtp(() => def.value, () => def.value === null ? {} : edgeOpts(def.value, params.value?.bet))
const model = computed(() => {
  if (def.value === null || report.value === null || params.value === null) return null
  return labExpectedMath(def.value, report.value, params.value)
})

// The histogram overlay reflects the params the run STARTED with, not live edits.
const runExpectedEndCredits = ref<number | null>(null)
function onRun(p: SimRunParams): void {
  runExpectedEndCredits.value = model.value === null || def.value === null
    ? null
    : model.value.capExpectedEndCents / def.value.denominationCents
  run(p)
}
</script>

<template>
  <div class="px-4 py-8 max-w-[1100px] mx-auto space-y-6">
    <header class="space-y-1">
      <h1 class="text-3xl font-bold">
        <span class="text-amber-400">Sim</span> Lab
      </h1>
      <p class="text-neutral-400 text-sm max-w-2xl">
        Run thousands of bankrolls against a machine until they bust or hit a spin cap, and see what
        variance actually does to your money. Every figure comes from the same engine that runs the floor.
      </p>
    </header>

    <LabForm
      :running="running"
      @run="onRun"
      @change="params = $event"
    />
    <LabExpectedMath
      :def="def"
      :model="model"
      :result="result"
    />
    <LabProgress
      v-if="running"
      :progress="progress"
      :completed="completed"
      :total="total"
      @cancel="cancel"
    />
    <p
      v-if="error"
      class="text-rose-400 text-sm"
    >
      {{ error }}
    </p>

    <template v-if="result">
      <LabStatCards :result="result" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SurvivalCurve :result="result" />
        <EndHistogram
          :result="result"
          :expected-end-credits="runExpectedEndCredits"
        />
        <SampleCurves :result="result" />
        <DrawdownHistogram :result="result" />
      </div>
    </template>
  </div>
</template>
