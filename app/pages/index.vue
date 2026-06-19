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
})).filter(group => group.machines.length > 0))
</script>

<template>
  <div class="floor-page min-h-screen">
    <div class="px-4 py-8 max-w-[1100px] mx-auto space-y-8">
      <div class="text-center space-y-2">
        <h1 class="floor-title text-5xl font-bold tracking-tight">
          SLOTS SIMULATOR
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

        <h2 class="floor-title text-2xl font-bold tracking-widest pt-2">
          CHOOSE YOUR MACHINE
        </h2>

        <section
          v-for="group in groups"
          :key="group.family"
          class="space-y-3"
        >
          <h3 class="text-xs uppercase tracking-widest text-neutral-400">
            {{ group.heading }}
          </h3>
          <div class="floor-grid">
            <FloorMachineCard
              v-for="def in group.machines"
              :key="def.id"
              :def="def"
            />
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── Vegas-kitsch floor backdrop + neon header ── */
.floor-page {
  background:
    radial-gradient(900px 500px at 15% -10%, rgba(255, 124, 74, .12), transparent 60%),
    radial-gradient(900px 500px at 85% -10%, rgba(56, 232, 255, .12), transparent 60%),
    linear-gradient(180deg, #0a0f1c, #05070d);
}

.floor-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
@media (min-width: 640px) { .floor-grid { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 980px) { .floor-grid { grid-template-columns: repeat(3, 1fr); } }

.floor-title {
  font-family: 'Bungee', sans-serif;
  text-align: center;
  letter-spacing: 2px;
  background: linear-gradient(180deg, #fff6c8, #ffd24a 45%, #b8860b);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 16px rgba(255, 210, 74, .5));
  animation: floor-glow 2.4s ease-in-out infinite alternate;
}
@keyframes floor-glow {
  from { filter: drop-shadow(0 0 8px rgba(255, 210, 74, .35)); }
  to   { filter: drop-shadow(0 0 22px rgba(255, 210, 74, .8)); }
}
@media (prefers-reduced-motion: reduce) {
  .floor-title { animation: none; }
}
</style>
