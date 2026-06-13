<!-- app/components/game/MachineMarquee.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { marqueeArtFor } from '~/components/game/marquee/art'

const store = useSlotsStore()
const art = computed(() => store.currentDef
  ? marqueeArtFor(store.currentDef.id, store.currentDef.family, store.currentDef.denominationCents)
  : null)
</script>

<template>
  <div
    v-if="store.currentDef && art"
    class="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-amber-900/40 px-5 py-3"
    :style="{ background: `radial-gradient(130% 200% at 0% 0%, ${art.accent}22, transparent 58%), linear-gradient(#15151a,#0e0e12)` }"
  >
    <div
      class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2"
      :style="{ borderColor: art.accent, boxShadow: `0 0 14px ${art.accent}59`, background: 'radial-gradient(circle at 35% 30%, #2a2350, #140f2e)' }"
    >
      <GameSymbolIcon
        :icon="art.heroIcon"
        :label="store.currentDef.name"
        :size="34"
      />
    </div>
    <div>
      <div
        class="font-mono text-2xl font-black tracking-[0.12em]"
        :style="{ color: art.accent }"
      >
        {{ store.currentDef.name.toUpperCase() }}
      </div>
      <div class="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/60">
        {{ art.tagline }}
      </div>
    </div>
    <div
      class="absolute inset-x-0 bottom-0 h-0.5"
      :style="{ background: `linear-gradient(90deg, transparent, ${art.accent}, transparent)` }"
    />
  </div>
</template>
