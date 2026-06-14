<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'
import { chromeFor } from '~/components/game/chrome/registry'
import { chromeTheme } from '~/components/game/chrome/theme'

const store = useSlotsStore()
const machineId = computed(() => store.currentMachineId ?? '')
const chrome = computed(() => chromeFor(machineId.value))
const stageStyle = computed(() => {
  const t = chromeTheme(machineId.value)
  return {
    '--chrome-accent': t.accent,
    '--chrome-secondary': t.secondary,
    '--chrome-glow': t.glow,
    '--chrome-backdrop': t.backdrop,
    'background': `radial-gradient(130% 100% at 50% 0%, ${t.accent}1a, ${t.backdrop})`
  }
})
</script>

<template>
  <div
    class="chrome-stage"
    :style="stageStyle"
  >
    <div class="chrome-inner">
      <slot />
    </div>
    <component
      :is="chrome"
      :key="machineId"
      class="chrome-frame"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.chrome-stage {
  position: relative;
  padding: clamp(12px, 4vw, 40px);
  border-radius: 1.25rem;
  overflow: hidden;
}
.chrome-inner {
  position: relative;
  z-index: 1;
}
/* The chrome module root receives this class + sits above the reels but is
   inert; its center is transparent so the reels show through. */
.chrome-frame {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  border-radius: inherit;
}
@media (max-width: 640px) {
  .chrome-stage { padding: clamp(8px, 3vw, 16px); }
}
</style>
