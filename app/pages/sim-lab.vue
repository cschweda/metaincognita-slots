<!-- app/pages/sim-lab.vue -->
<script setup lang="ts">
import { useSimWorker } from '~/composables/useSimWorker'
import type { SimRunParams } from '~/composables/useSimWorker'
import LabForm from '~/components/lab/LabForm.vue'
import LabProgress from '~/components/lab/LabProgress.vue'
import LabStatCards from '~/components/lab/LabStatCards.vue'
import SurvivalCurve from '~/components/lab/SurvivalCurve.vue'
import EndHistogram from '~/components/lab/EndHistogram.vue'
import SampleCurves from '~/components/lab/SampleCurves.vue'
import DrawdownHistogram from '~/components/lab/DrawdownHistogram.vue'

const { running, progress, completed, total, result, error, run, cancel } = useSimWorker()
const onRun = (params: SimRunParams): void => run(params)
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
        <EndHistogram :result="result" />
        <SampleCurves :result="result" />
        <DrawdownHistogram :result="result" />
      </div>
    </template>
  </div>
</template>
