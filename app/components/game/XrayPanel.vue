<script setup lang="ts">
import { computed } from 'vue'
import { useSlotsStore } from '~/stores/slots'

const store = useSlotsStore()
const def = computed(() => store.currentDef)
</script>

<template>
  <div
    v-if="store.settings.xray && def"
    class="rounded-xl bg-neutral-900 border border-amber-500/25 p-4"
    data-test="xray"
  >
    <GameXrayContent />
  </div>
</template>
