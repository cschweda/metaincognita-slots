<script setup lang="ts">
import { ref } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { formatCents } from '~/utils/format'

const store = useSlotsStore()
const bankrollCents = ref(100_000)
const hasSave = ref(false)
hasSave.value = store.peekSavedSession()

function start() {
  store.startSession(bankrollCents.value)
}
function resume() {
  if (!store.resume()) hasSave.value = false
}
</script>

<template>
  <div class="rounded-2xl bg-neutral-900/80 border border-neutral-800 shadow-2xl shadow-black/40 p-6 sm:p-8 space-y-6 max-w-[520px] mx-auto">
    <h2 class="text-lg font-semibold text-amber-400 tracking-wide uppercase">
      Walk onto the floor
    </h2>
    <UFormField
      label="Bankroll"
      help="Play money. It stays play money."
    >
      <div class="flex items-center gap-4">
        <USlider
          v-model="bankrollCents"
          :min="10_000"
          :max="1_000_000"
          :step="10_000"
          color="primary"
          class="flex-1"
        />
        <span class="text-emerald-400 font-mono text-lg min-w-[6rem] text-right">{{ formatCents(bankrollCents) }}</span>
      </div>
    </UFormField>
    <div class="flex items-center gap-3">
      <UButton
        color="primary"
        size="lg"
        icon="i-lucide-coins"
        @click="start"
      >
        Start session
      </UButton>
      <UButton
        v-if="hasSave"
        color="neutral"
        variant="outline"
        size="lg"
        icon="i-lucide-history"
        @click="resume"
      >
        Resume saved session
      </UButton>
    </div>
  </div>
</template>
