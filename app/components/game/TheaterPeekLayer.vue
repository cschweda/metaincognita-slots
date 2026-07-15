<!-- app/components/game/TheaterPeekLayer.vue -->
<!-- The truth layer. Hold ` (or press-and-hold the glass) and this washes over
     the cabinet: the guts the casino never shows. Winning paylines already draw
     on the reel face, so this adds the pays + the X-ray, not the lines. -->
<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { useTheater } from '~/composables/useTheater'
import { summariseWins } from '~/utils/winLines'
import { formatCredits } from '~/utils/format'

const store = useSlotsStore()
const { peeking } = useTheater()

// Temple of Gold (cascade) is free play — spinOnce short-circuits for it, so
// store.lastOutcome never populates and the shared X-ray reads blank. Cascade
// keeps its own truth panel (CascadeXray, reading the local tumble trace).
const isCascade = computed(() => store.currentDef?.family === 'cascade')

// summariseWins returns WinLine[]: { count, symbolName, pluralName, payout,
// color, cells, kind, ... } — see app/utils/winLines.ts. NOT { label, credits }.
const pays = computed(() => {
  const def = store.currentDef
  if (def === null || store.lastOutcome === null) return []
  return summariseWins(def, store.lastOutcome)
})
</script>

<template>
  <div
    v-if="peeking"
    class="theater-peek"
    data-test="peek-layer"
  >
    <div class="theater-peek-inner">
      <div
        v-if="pays.length"
        class="theater-peek-pays"
      >
        <span
          v-for="(p, i) in pays"
          :key="i"
          class="theater-peek-pay"
          :style="{ color: p.color }"
        >
          {{ p.count }}× {{ p.pluralName }} · {{ formatCredits(p.payout) }}
        </span>
      </div>
      <GameCascadeXray v-if="isCascade" />
      <GameXrayContent v-else />
    </div>
  </div>
</template>

<style scoped>
.theater-peek {
  position: absolute; inset: 0; z-index: 3; display: flex; align-items: flex-end;
  justify-content: center; pointer-events: none;
}
.theater-peek-inner {
  pointer-events: auto; width: min(680px, 92%); max-height: 78%; overflow-y: auto;
  margin-bottom: 3vh; padding: 16px 18px; border-radius: 16px;
  background: rgba(8, 11, 20, 0.82); backdrop-filter: blur(8px);
  border: 1px solid rgba(212, 168, 71, 0.4); box-shadow: 0 0 40px rgba(0, 0, 0, 0.6);
}
.theater-peek-pays { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-bottom: 12px;
  font: 700 13px ui-monospace, monospace; }
</style>
