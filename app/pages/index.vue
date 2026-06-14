<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { FLOOR } from '~/machines'
import { formatCents } from '~/utils/format'

const store = useSlotsStore()

onMounted(() => {
  // direct navigation after reload: bring the session back silently
  if (store.phase === 'floor' && store.peekSavedSession()) store.resume()
})

const FAMILY_ORDER = ['video', 'stepper', 'bally-em', 'pachislo'] as const
const FAMILY_HEADING: Record<string, string> = {
  'video': 'Video slots',
  'stepper': 'Telnaes steppers (1984)',
  'bally-em': 'Vintage Bally Series E (1979)',
  'pachislo': 'Pachislo skill-stop'
}
const groups = computed(() => FAMILY_ORDER.map(family => ({
  family,
  heading: FAMILY_HEADING[family]!,
  machines: FLOOR.filter(def => def.family === family)
})))
</script>

<template>
  <div class="px-4 py-8 max-w-[1100px] mx-auto space-y-8">
    <div class="text-center space-y-2">
      <h1 class="text-4xl font-bold tracking-tight">
        <span class="text-amber-400">Slots</span>
        <span class="text-neutral-300"> Simulator</span>
      </h1>
      <p class="text-neutral-400 text-sm">
        Nine authentic machines. Every number computed, never asserted — flip the X-ray on and see the guts.
      </p>
    </div>

    <FloorBankrollSetup v-if="store.phase === 'floor'" />

    <template v-else>
      <div class="flex items-center justify-between rounded-xl bg-neutral-900/70 border border-neutral-800 px-4 py-2.5">
        <div class="text-sm">
          <span class="text-neutral-400">Bankroll </span>
          <span class="text-emerald-400 font-mono">{{ formatCents(store.bankrollCents) }}</span>
          <span class="text-neutral-400 font-mono text-xs ml-3">{{ store.stats.spins.toLocaleString() }} games this session</span>
        </div>
        <div class="flex items-center gap-3">
          <UButton
            :color="store.settings.xray ? 'primary' : 'neutral'"
            :variant="store.settings.xray ? 'solid' : 'outline'"
            :aria-pressed="store.settings.xray"
            size="xs"
            icon="i-lucide-scan-line"
            @click="store.setXray(!store.settings.xray)"
          >
            X-ray {{ store.settings.xray ? 'on' : 'off' }}
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            size="xs"
            icon="i-lucide-rotate-ccw"
            @click="store.resetSession()"
          >
            End session
          </UButton>
        </div>
      </div>

      <section
        v-for="group in groups"
        :key="group.family"
        class="space-y-3"
      >
        <h2 class="text-xs uppercase tracking-widest text-neutral-400">
          {{ group.heading }}
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <FloorMachineCard
            v-for="def in group.machines"
            :key="def.id"
            :def="def"
          />
        </div>
      </section>
    </template>
  </div>
</template>
